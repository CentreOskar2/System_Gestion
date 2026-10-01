import { supabase } from '../../supabaseClient'
import { fetchAllRows } from '../../utils/fetchAllRows'
import { isEnrolledInMonth } from './monthUtils'
import { calculateSalary } from './salaryUtils'
import { fetchTeacherAdvances, indexAdvances } from './advancesApi'

/* Calcul de la paie, partagé par les pages Salaires, Charges et Bénéfice net.
 *
 * Un salaire au pourcentage dépend des élèves inscrits ce mois-là : il évolue
 * jusqu'à la fin du mois (une inscription de dernière semaine l'augmente, une
 * désactivation le réduit). Les écrans doivent donc lire le même calcul, sinon
 * les charges annonceraient un montant que la page Salaires contredit.
 */

// Une seule des données lues dépend du mois : la liste des salaires déjà
// validés. Tout le reste (professeurs, groupes, affectations, tarifs, élèves)
// est commun. Le contexte est donc chargé une fois, puis rejoué mois par mois
// — sinon un écran couvrant l'année scolaire déclencherait douze fois ces
// treize requêtes.
export async function fetchSalaryContext() {
  // Un professeur n'appartient a aucune succursale : il enseigne dans plusieurs
  // cycles et dans plusieurs succursales. On charge donc toujours tout le corps
  // enseignant, et `branchId` ne sert plus qu'aux ecrans appelants.
  const teachersQuery = supabase.from('teachers').select('*').eq('status', 'active').order('last_name')
  const groupsQuery = supabase.from('groups').select('id, name, subject_id, level_id, branch_id, formation_level_id')

  const [teachersRes, cyclesRes, levelsRes, branchesRes, subjectsRes, groupsRes, tgRes, tgnRes, studentSubjectsRes, subscriptionsRes, groupStudentsRes, studentsRes, salaryRes, tariffsRes] = await Promise.all([
    teachersQuery,
    supabase.from('cycles').select('id, name, has_fixed_price, fixed_price'),
    supabase.from('levels').select('id, name, cycle_id, fixed_price'),
    supabase.from('branches').select('id, name'),
    supabase.from('subjects').select('id, name'),
    groupsQuery,
    supabase.from('teacher_group_subjects').select('teacher_id, group_id, subject_id'),
    supabase.from('teacher_groups').select('teacher_id, group_id'),
    // Tables qui dépassent 1000 lignes : lues par pages (voir fetchAllRows).
    fetchAllRows(() => supabase.from('student_group_subjects').select('group_id, student_id, subject_id').order('student_id').order('group_id').order('subject_id')),
    // Le prix réellement facturé à chaque élève. Un prix manuel (une remise)
    // ne figure QUE là : la table tariffs ne connaît que le prix standard.
    fetchAllRows(() => supabase.from('student_subscriptions').select('student_id, group_id, subject_id, monthly_price').order('id')),
    fetchAllRows(() => supabase.from('group_students').select('group_id, student_id').order('student_id').order('group_id')),
    fetchAllRows(() => supabase.from('students').select('id, first_name, last_name, status, registration_date, created_at, branch_id').order('id')),
    fetchAllRows(() => supabase.from('teacher_salaries').select('teacher_id, month, amount').eq('status', 'paid').order('teacher_id').order('month')),
    supabase.from('tariffs').select('level_id, subject_id, price'),
  ])

  const firstError = [teachersRes, cyclesRes, levelsRes, branchesRes, subjectsRes, groupsRes, tgRes, tgnRes, studentSubjectsRes, subscriptionsRes, groupStudentsRes, studentsRes, salaryRes, tariffsRes].find((r) => r.error)
  if (firstError) throw new Error(firstError.error.message)

  const paymentsIndex = await fetchPaymentsIndex()

  const cycleMap = Object.fromEntries((cyclesRes.data || []).map((c) => [c.id, c.name]))
  const levelMap = Object.fromEntries((levelsRes.data || []).map((l) => [l.id, l.name]))
  const levelById = Object.fromEntries((levelsRes.data || []).map((l) => [l.id, l]))
  const cycleById = Object.fromEntries((cyclesRes.data || []).map((c) => [c.id, c]))
  const branchMap = Object.fromEntries((branchesRes.data || []).map((b) => [b.id, b.name]))
  const subjectMap = Object.fromEntries((subjectsRes.data || []).map((s) => [s.id, s.name]))
  const groupById = Object.fromEntries((groupsRes.data || []).map((g) => [g.id, g]))
  const studentMap = Object.fromEntries((studentsRes.data || []).map((s) => [s.id, `${s.first_name} ${s.last_name}`.trim()]))
  const studentRowById = Object.fromEntries((studentsRes.data || []).map((s) => [s.id, s]))

  const tariffsByLevelSubject = {}
  for (const row of tariffsRes.data || []) {
    if (!tariffsByLevelSubject[row.level_id]) tariffsByLevelSubject[row.level_id] = {}
    tariffsByLevelSubject[row.level_id][row.subject_id] = Number(row.price)
  }

  // Tarifs des niveaux de formation : un groupe de formation rapporte le prix
  // de son niveau par élève, comme un groupe au forfait. Table absente tant que
  // la migration 031 n'a pas été passée — les salaires se calculent alors comme
  // avant, sans les formations.
  // Avances sur salaire : déduites du net à verser du mois concerné. Table
  // absente tant que la migration 038 n'a pas été passée — la paie se calcule
  // alors comme avant, sans avance.
  const { advances } = await fetchTeacherAdvances().catch((advancesError) => {
    console.error(advancesError)
    return { advances: [] }
  })
  const advancesIndex = indexAdvances(advances)

  const formationLevelsRes = await supabase.from('formation_levels').select('id, price')
  if (formationLevelsRes.error) console.error(formationLevelsRes.error)
  const formationPriceByLevel = Object.fromEntries(
    (formationLevelsRes.data || []).map((row) => [row.id, Number(row.price || 0)])
  )

  // Cycles au forfait : le groupe rapporte le prix du niveau par élève,
  // toutes matières comprises — il n'y a pas de tarif par matière à cumuler.
  const isPackageGroup = (groupId) => {
    const group = groupById[groupId]
    // Un groupe de formation se facture comme un forfait : un prix par élève,
    // sans matière à cumuler.
    if (group?.formation_level_id) return true
    const level = levelById[group?.level_id]
    return Boolean(cycleById[level?.cycle_id]?.has_fixed_price)
  }
  const priceForGroup = (groupId, subjectId) => {
    const group = groupById[groupId]
    if (!group) return 0
    if (group.formation_level_id) return formationPriceByLevel[group.formation_level_id] || 0
    const level = levelById[group.level_id]
    if (isPackageGroup(groupId)) return level?.fixed_price != null ? Number(level.fixed_price) : 0
    const tariff = tariffsByLevelSubject[group.level_id]?.[subjectId || group.subject_id]
    if (tariff != null) return tariff
    return 0
  }

  const assignmentsByTeacher = {}
  for (const row of tgRes.data || []) {
    if (!row.teacher_id || !row.group_id) continue
    if (!assignmentsByTeacher[row.teacher_id]) assignmentsByTeacher[row.teacher_id] = []
    const subjectId = row.subject_id || groupById[row.group_id]?.subject_id
    const key = `${row.group_id}:${subjectId || ''}`
    if (!assignmentsByTeacher[row.teacher_id].some((assignment) => assignment.key === key)) {
      assignmentsByTeacher[row.teacher_id].push({ groupId: row.group_id, subjectId, key })
    }
  }
  // Affectations sans matière : le professeur assure tout le groupe.
  for (const row of tgnRes.data || []) {
    if (!row.teacher_id || !row.group_id) continue
    if (!assignmentsByTeacher[row.teacher_id]) assignmentsByTeacher[row.teacher_id] = []
    const key = `${row.group_id}:`
    if (!assignmentsByTeacher[row.teacher_id].some((assignment) => assignment.key === key)) {
      assignmentsByTeacher[row.teacher_id].push({ groupId: row.group_id, subjectId: null, key })
    }
  }

  // Montant figé le jour de la validation : c'est lui qui fait foi pour un mois
  // clôturé, même si les inscriptions ont bougé depuis.
  const validatedByMonth = {}
  for (const row of salaryRes.data || []) {
    const key = String(row.month).slice(0, 7)
    if (!validatedByMonth[key]) validatedByMonth[key] = {}
    validatedByMonth[key][row.teacher_id] = Number(row.amount) || 0
  }

  // Prix réellement facturé, par (élève, groupe, matière). Un prix manuel — une
  // remise accordée à l'inscription — n'existe que dans student_subscriptions ;
  // la table tariffs ne porte que le prix standard du niveau.
  const priceByStudentGroupSubject = {}
  for (const row of subscriptionsRes.data || []) {
    if (!row.group_id) continue
    const amount = Number(row.monthly_price)
    if (!Number.isFinite(amount)) continue
    priceByStudentGroupSubject[`${row.student_id}:${row.group_id}:${row.subject_id || ''}`] = amount
  }

  // Repli, sans le groupe : le prix d'un élève POUR UNE MATIÈRE.
  //
  // L'abonnement et l'appartenance au groupe ne pointent pas toujours sur le
  // même group_id — un même nom de groupe existe parfois en double, et
  // d'anciennes écritures résolvaient le groupe par son nom. La recherche
  // exacte échoue alors et le calcul retombait sur le tarif du catalogue,
  // ignorant la remise accordée à l'élève.
  //
  // Un élève n'a qu'un seul prix par matière : ce repli est donc sans
  // ambiguïté. Par prudence, une matière facturée à deux prix différents au
  // même élève est écartée du repli plutôt que d'en choisir un au hasard.
  const priceByStudentSubject = {}
  const ambiguousStudentSubject = new Set()
  for (const row of subscriptionsRes.data || []) {
    if (!row.subject_id) continue
    const amount = Number(row.monthly_price)
    if (!Number.isFinite(amount)) continue
    const key = `${row.student_id}:${row.subject_id}`
    if (key in priceByStudentSubject && priceByStudentSubject[key] !== amount) {
      ambiguousStudentSubject.add(key)
      continue
    }
    priceByStudentSubject[key] = amount
  }
  for (const key of ambiguousStudentSubject) delete priceByStudentSubject[key]

  return {
    teacherRows: teachersRes.data || [],
    studentSubjectRows: studentSubjectsRes.data || [],
    priceByStudentGroupSubject,
    priceByStudentSubject,
    groupStudentRows: groupStudentsRes.data || [],
    validatedByMonth,
    cycleMap,
    levelMap,
    levelById,
    branchMap,
    subjectMap,
    groupById,
    studentMap,
    studentRowById,
    isPackageGroup,
    priceForGroup,
    assignmentsByTeacher,
    advancesIndex,
    paymentsIndex,
  }
}

// Date d'inscription affichée dans le journal ('AAAA-MM-JJ') : même repli sur
// created_at que isEnrolledInMonth, pour montrer la date qui a réellement servi.
function studentRegistrationDate(student) {
  return String(student.registration_date || student.created_at || '').slice(0, 10)
}

// Statuts qui valent encaissement (l'ancien code écrivait parfois « validé »).
const PAID_STATUSES = new Set(['paid', 'validé'])
const monthOf = (value) => String(value || '').slice(0, 7)

// Encaissements, indexés pour répondre vite à « cet élève a-t-il payé cette
// matière ce mois-ci, et combien ? ». Le professeur au pourcentage n'est payé
// que sur ce qui a été réellement encaissé (décision du centre, 01/10).
async function fetchPaymentsIndex() {
  const [monthRes, subjectRes, formationsRes, formationPaymentsRes] = await Promise.all([
    fetchAllRows(() => supabase.from('student_payments').select('student_id, month, amount, status').order('month').order('student_id')),
    fetchAllRows(() => supabase.from('student_payment_subjects').select('student_id, subject_id, month, amount').order('id')),
    fetchAllRows(() => supabase.from('student_formations').select('id, student_id, group_id').order('id')),
    fetchAllRows(() => supabase.from('formation_payments').select('student_formation_id, month, amount, status').order('month').order('id')),
  ])
  for (const res of [monthRes, subjectRes]) {
    if (res.error) throw new Error(res.error.message)
  }
  // Tables des formations absentes tant que la migration 031 n'a pas été passée.
  if (formationsRes.error) console.error(formationsRes.error)
  if (formationPaymentsRes.error) console.error(formationPaymentsRes.error)

  // Mois réglé en entier (student_payments) : « élève:AAAA-MM » → montant.
  const monthPaid = {}
  for (const row of monthRes.data || []) {
    if (PAID_STATUSES.has(row.status || 'paid')) monthPaid[`${row.student_id}:${monthOf(row.month)}`] = Number(row.amount) || 0
  }
  // Détail par matière : « élève:matière:AAAA-MM » → montant encaissé.
  const subjectPaid = {}
  // Mois pour lesquels l'élève a un détail par matière.
  const hasSubjectDetail = new Set()
  for (const row of subjectRes.data || []) {
    subjectPaid[`${row.student_id}:${row.subject_id}:${monthOf(row.month)}`] = Number(row.amount) || 0
    hasSubjectDetail.add(`${row.student_id}:${monthOf(row.month)}`)
  }
  // Formations : « élève:groupe:AAAA-MM » → montant encaissé.
  const enrollmentById = Object.fromEntries((formationsRes.data || []).map((row) => [row.id, row]))
  const formationPaid = {}
  for (const row of formationPaymentsRes.data || []) {
    const enrollment = enrollmentById[row.student_formation_id]
    if (!enrollment?.group_id || !PAID_STATUSES.has(row.status || 'paid')) continue
    formationPaid[`${enrollment.student_id}:${enrollment.group_id}:${monthOf(row.month)}`] = Number(row.amount) || 0
  }
  return { monthPaid, subjectPaid, hasSubjectDetail, formationPaid }
}

// Montant encaissé pour cet élève dans ce groupe ce mois-ci, ou null s'il n'a
// pas encore payé. Par matière : une matière réglée compte pour le prof de
// cette matière, même si l'élève doit encore les autres.
function paidAmountFor(paymentsIndex, { studentId, groupId, subjectId, isFormation, isPackage, price }, month) {
  if (!paymentsIndex) return price
  const key = monthOf(month)
  if (isFormation) {
    const amount = paymentsIndex.formationPaid[`${studentId}:${groupId}:${key}`]
    return amount === undefined ? null : amount
  }
  const monthAmount = paymentsIndex.monthPaid[`${studentId}:${key}`]
  if (isPackage) return monthAmount === undefined ? null : monthAmount
  const subjectAmount = paymentsIndex.subjectPaid[`${studentId}:${subjectId}:${key}`]
  if (subjectAmount !== undefined) return subjectAmount
  // Mois payé en bloc sans détail par matière (avance, ou paiement antérieur
  // au détail par matière) : toutes les matières sont réglées, au prix prévu.
  if (monthAmount !== undefined && !paymentsIndex.hasSubjectDetail.has(`${studentId}:${key}`)) return price
  return null
}

// Rejoue le contexte sur un mois donné. Retourne, par professeur, le détail des
// groupes, le montant calculé, et le montant qui fait foi pour ce mois
// (`effectiveAmount`) : le montant figé si la paie a été validée, le calcul en
// cours sinon.
export function computeTeacherSalaries(context, month) {
  const {
    teacherRows, studentSubjectRows, groupStudentRows,
    priceByStudentGroupSubject, priceByStudentSubject, validatedByMonth,
    cycleMap, levelMap, levelById, branchMap, subjectMap, groupById,
    studentMap, studentRowById, isPackageGroup, priceForGroup, assignmentsByTeacher,
    advancesIndex = {},
    paymentsIndex = null,
  } = context

  const validatedAmountByTeacher = validatedByMonth[String(month).slice(0, 7)] || {}

  const studentsByGroupSubject = {}
  for (const row of studentSubjectRows) {
    const group = groupById[row.group_id]
    const student = studentRowById[row.student_id]
    if (!group || !student || !row.subject_id) continue
    const name = studentMap[row.student_id]
    if (!name) continue
    if (student.status !== 'active') continue
    if (!isEnrolledInMonth({ registrationDate: student.registration_date, createdAt: student.created_at }, month)) continue
    if (group.branch_id && student.branch_id && group.branch_id !== student.branch_id) continue
    // The teacher earns for every active enrolled student, including when
    // the student's tuition payment is still pending or unpaid.
    const key = `${row.group_id}:${row.subject_id}`
    if (!studentsByGroupSubject[key]) studentsByGroupSubject[key] = []
    if (!studentsByGroupSubject[key].some((entry) => entry.id === row.student_id)) {
      // Prix réellement facturé à CET élève. Repli sur le tarif standard pour un
      // élève rattaché au groupe sans abonnement — sinon il compterait pour zéro.
      // 1. le prix de cet élève dans CE groupe pour CETTE matière ;
      // 2. sinon son prix pour cette matière, quel que soit le groupe ;
      // 3. sinon le tarif du catalogue.
      const exact = priceByStudentGroupSubject[`${row.student_id}:${row.group_id}:${row.subject_id}`]
      const bySubject = priceByStudentSubject[`${row.student_id}:${row.subject_id}`]
      const price = Number.isFinite(exact)
        ? exact
        : Number.isFinite(bySubject)
          ? bySubject
          : priceForGroup(row.group_id, row.subject_id)
      const paidAmount = paidAmountFor(paymentsIndex, { studentId: row.student_id, groupId: row.group_id, subjectId: row.subject_id, price }, month)
      studentsByGroupSubject[key].push({
        id: row.student_id,
        name,
        price,
        paid: paidAmount !== null,
        paidAmount: paidAmount ?? 0,
        registrationDate: studentRegistrationDate(student),
      })
    }
  }
  // Au forfait l'élève n'a pas de ligne par matière : son appartenance au
  // groupe suffit à le compter pour le professeur qui en a la charge.
  for (const row of groupStudentRows) {
    const group = groupById[row.group_id]
    const student = studentRowById[row.student_id]
    if (!group || !student || !isPackageGroup(row.group_id)) continue
    const name = studentMap[row.student_id]
    if (!name) continue
    if (student.status !== 'active') continue
    if (!isEnrolledInMonth({ registrationDate: student.registration_date, createdAt: student.created_at }, month)) continue
    if (group.branch_id && student.branch_id && group.branch_id !== student.branch_id) continue
    const key = `${row.group_id}:`
    if (!studentsByGroupSubject[key]) studentsByGroupSubject[key] = []
    if (!studentsByGroupSubject[key].some((entry) => entry.id === row.student_id)) {
      // Au forfait le prix est celui du niveau, le même pour tout le groupe.
      const price = priceForGroup(row.group_id)
      const paidAmount = paidAmountFor(
        paymentsIndex,
        { studentId: row.student_id, groupId: row.group_id, isFormation: Boolean(group.formation_level_id), isPackage: true, price },
        month
      )
      studentsByGroupSubject[key].push({
        id: row.student_id,
        name,
        price,
        paid: paidAmount !== null,
        paidAmount: paidAmount ?? 0,
        registrationDate: studentRegistrationDate(student),
      })
    }
  }

  const teachers = teacherRows.map((t) => {
    const cycleIds = t.cycle_ids || []
    const groups = (assignmentsByTeacher[t.id] || [])
      .map((assignment) => {
        const group = groupById[assignment.groupId]
        if (!group) return null
        const cycleId = levelById[group.level_id]?.cycle_id
        const rate = t.remuneration_type === 'pourcentage' ? Number(t.cycle_rates?.[cycleId] ?? 0) : 0
        const roster = studentsByGroupSubject[assignment.key] || []
        const students = roster.map((entry) => entry.name)
        // Somme réellement ENCAISSÉE ce mois-ci : c'est elle qui sert au calcul
        // du salaire. Un élève qui n'a pas encore payé compte pour 0 DH ; le
        // salaire augmente au fil des validations de paiement. Une remise ou un
        // demi-mois s'y reflète puisque c'est le montant encaissé qui compte.
        const revenue = roster.reduce((sum, entry) => sum + (Number(entry.paidAmount) || 0), 0)
        return {
          id: assignment.key,
          name: group.name,
          subject: isPackageGroup(group.id)
            ? 'Toutes les matières'
            : subjectMap[assignment.subjectId || group.subject_id] || '—',
          level: levelMap[group.level_id] || '—',
          branch: branchMap[group.branch_id] || '—',
          cycleId,
          rate,
          price: priceForGroup(group.id, assignment.subjectId),
          students,
          studentsCount: students.length,
          paidCount: roster.filter((entry) => entry.paid).length,
          revenue,
          // Prix par élève, pour le journal imprimé : il doit montrer ce que
          // l'élève paie vraiment, pas le tarif du catalogue.
          // `price` est ce qui a été encaissé (0 tant que l'élève n'a pas payé),
          // `expectedPrice` ce qu'il doit.
          studentPrices: roster.map((entry) => ({
            name: entry.name,
            price: Number(entry.paidAmount) || 0,
            expectedPrice: Number(entry.price) || 0,
            paid: entry.paid,
            registrationDate: entry.registrationDate,
          })),
        }
      })
      .filter(Boolean)
    const levels = [...new Set(groups.map((g) => g.level).filter((level) => level !== '—'))]
    const validated = Object.prototype.hasOwnProperty.call(validatedAmountByTeacher, t.id)
    const monthAdvances = advancesIndex[t.id]?.[String(month).slice(0, 7)] || []
    const advancesTotal = monthAdvances.reduce((sum, advance) => sum + advance.amount, 0)
    const computed = calculateSalary(
      {
        paymentType: t.remuneration_type,
        fixed_salary: t.fixed_salary,
        remuneration_amount: t.remuneration_amount,
        cycle_rates: t.cycle_rates || {},
      },
      groups
    )
    const effectiveAmount = validated ? validatedAmountByTeacher[t.id] : computed
    return {
      id: t.id,
      name: `${t.first_name} ${t.last_name}`.trim(),
      phone: t.phone || '',
      branch_id: t.branch_id,
      paymentType: t.remuneration_type,
      type: t.remuneration_type === 'fixe' ? 'Fixe' : 'Pourcentage',
      fixed_salary: t.fixed_salary,
      remuneration_amount: t.remuneration_amount,
      cycle_rates: t.cycle_rates || {},
      cycles: cycleIds.map((id) => cycleMap[id]).filter(Boolean),
      levels,
      groups,
      validated,
      amount: computed,
      effectiveAmount,
      // Avances versées sur le salaire de ce mois : déduites du net à verser
      // (voir netToPay dans salaryUtils).
      advances: monthAdvances,
      advancesTotal,
    }
  })

  return {
    teachers,
    branchMap,
    validatedTeacherIds: Object.keys(validatedAmountByTeacher),
    validatedAmountByTeacher,
  }
}

// Raccourci pour les écrans qui n'ont besoin que d'un mois.
export async function fetchTeacherSalaries({ month }) {
  const context = await fetchSalaryContext()
  return computeTeacherSalaries(context, month)
}
