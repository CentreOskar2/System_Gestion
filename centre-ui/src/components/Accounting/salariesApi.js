import { supabase } from '../../supabaseClient'
import { isEnrolledInMonth } from './monthUtils'
import { calculateSalary } from './salaryUtils'

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
export async function fetchSalaryContext({ branchId = null } = {}) {
  let teachersQuery = supabase.from('teachers').select('*').eq('status', 'active').order('last_name')
  const groupsQuery = supabase.from('groups').select('id, name, subject_id, level_id, branch_id')
  if (branchId) {
    teachersQuery = teachersQuery.eq('branch_id', branchId)
  }

  const [teachersRes, cyclesRes, levelsRes, branchesRes, subjectsRes, groupsRes, tgRes, tgnRes, studentSubjectsRes, groupStudentsRes, studentsRes, salaryRes, tariffsRes] = await Promise.all([
    teachersQuery,
    supabase.from('cycles').select('id, name, has_fixed_price, fixed_price'),
    supabase.from('levels').select('id, name, cycle_id, fixed_price'),
    supabase.from('branches').select('id, name'),
    supabase.from('subjects').select('id, name'),
    groupsQuery,
    supabase.from('teacher_group_subjects').select('teacher_id, group_id, subject_id'),
    supabase.from('teacher_groups').select('teacher_id, group_id'),
    supabase.from('student_group_subjects').select('group_id, student_id, subject_id'),
    supabase.from('group_students').select('group_id, student_id'),
    supabase.from('students').select('id, first_name, last_name, status, registration_date, created_at, branch_id'),
    supabase.from('teacher_salaries').select('teacher_id, month, amount').eq('status', 'paid'),
    supabase.from('tariffs').select('level_id, subject_id, price'),
  ])

  const firstError = [teachersRes, cyclesRes, levelsRes, branchesRes, subjectsRes, groupsRes, tgRes, tgnRes, studentSubjectsRes, groupStudentsRes, studentsRes, salaryRes, tariffsRes].find((r) => r.error)
  if (firstError) throw new Error(firstError.error.message)

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

  // Cycles au forfait : le groupe rapporte le prix du niveau par élève,
  // toutes matières comprises — il n'y a pas de tarif par matière à cumuler.
  const isPackageGroup = (groupId) => {
    const level = levelById[groupById[groupId]?.level_id]
    return Boolean(cycleById[level?.cycle_id]?.has_fixed_price)
  }
  const priceForGroup = (groupId, subjectId) => {
    const group = groupById[groupId]
    if (!group) return 0
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

  return {
    teacherRows: teachersRes.data || [],
    studentSubjectRows: studentSubjectsRes.data || [],
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
  }
}

// Rejoue le contexte sur un mois donné. Retourne, par professeur, le détail des
// groupes, le montant calculé, et le montant qui fait foi pour ce mois
// (`effectiveAmount`) : le montant figé si la paie a été validée, le calcul en
// cours sinon.
export function computeTeacherSalaries(context, month) {
  const {
    teacherRows, studentSubjectRows, groupStudentRows, validatedByMonth,
    cycleMap, levelMap, levelById, branchMap, subjectMap, groupById,
    studentMap, studentRowById, isPackageGroup, priceForGroup, assignmentsByTeacher,
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
      studentsByGroupSubject[key].push({ id: row.student_id, name })
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
      studentsByGroupSubject[key].push({ id: row.student_id, name })
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
        const students = (studentsByGroupSubject[assignment.key] || []).map((entry) => entry.name)
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
        }
      })
      .filter(Boolean)
    const levels = [...new Set(groups.map((g) => g.level).filter((level) => level !== '—'))]
    const validated = Object.prototype.hasOwnProperty.call(validatedAmountByTeacher, t.id)
    const computed = calculateSalary(
      {
        paymentType: t.remuneration_type,
        fixed_salary: t.fixed_salary,
        remuneration_amount: t.remuneration_amount,
        cycle_rates: t.cycle_rates || {},
      },
      groups
    )
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
      effectiveAmount: validated ? validatedAmountByTeacher[t.id] : computed,
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
export async function fetchTeacherSalaries({ month, branchId = null }) {
  const context = await fetchSalaryContext({ branchId })
  return computeTeacherSalaries(context, month)
}
