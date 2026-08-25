import { supabase } from '../../supabaseClient'
import { fetchFeesData } from '../Accounting/feesApi'
import { calculateSalary } from '../Accounting/salaryUtils'
import { academicMonths, academicYearStart, formatShortDate, isEnrolledInMonth, schoolYearLabel } from '../Accounting/monthUtils'

const PAID_STATUSES = ['paid', 'validé']
const TYPE_LABELS = { Auto: 'Auto', Manuel: 'Manuel', recurring_fixed: 'Fixe récurrente' }

function slugify(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .toLowerCase()
}

export function branchSlug(branchName) {
  return branchName ? slugify(branchName) : 'toutes-succursales'
}

const MONTH_SLUGS = ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre']

// A report always needs one definite month to work with — if the "Mois" or "Année"
// filter is left empty, fall back to the current one rather than leaving it undefined.
export function resolvePeriod(filterMonth, filterYear) {
  const now = new Date()
  const month = Number(filterMonth) || now.getMonth() + 1
  const yearStart = Number(filterYear) || academicYearStart()
  const calendarYear = month >= 9 ? yearStart : yearStart + 1
  const monthKey = `${calendarYear}-${String(month).padStart(2, '0')}-01`
  const slug = `${MONTH_SLUGS[month - 1]}-${calendarYear}`
  return { month, yearStart, calendarYear, monthKey, slug }
}

const sum = (items, pick) => items.reduce((total, item) => total + (Number(pick(item)) || 0), 0)
const sameMonth = (a, b) => String(a).slice(0, 7) === String(b).slice(0, 7)
const withFallback = (rows, placeholder) => (rows.length > 0 ? rows : [placeholder])

// ---------------------------------------------------------------------------
// 1. Élèves par groupe
// ---------------------------------------------------------------------------
export async function buildGroupsReport({ branchId, branchName, monthKey, slug }) {
  let groupsQuery = supabase.from('groups').select('id, name, teacher_id, branch_id, status').eq('status', 'active')
  if (branchId) groupsQuery = groupsQuery.eq('branch_id', branchId)

  const [groupsRes, teachersRes, levelsRes, subsRes, paymentsRes] = await Promise.all([
    groupsQuery,
    supabase.from('teachers').select('id, first_name, last_name'),
    supabase.from('levels').select('id, name'),
    supabase
      .from('student_subscriptions')
      .select('student_id, group_id, monthly_price, students(first_name, last_name, registration_number, phone1, phone2, level_id, status)'),
    supabase.from('student_payments').select('student_id, status').eq('month', monthKey),
  ])

  const teacherMap = Object.fromEntries((teachersRes.data || []).map((t) => [t.id, `${t.first_name} ${t.last_name}`.trim()]))
  const levelMap = Object.fromEntries((levelsRes.data || []).map((l) => [l.id, l.name]))
  const paidStudentIds = new Set(
    (paymentsRes.data || []).filter((p) => PAID_STATUSES.includes(p.status)).map((p) => p.student_id)
  )

  const groups = groupsRes.data || []
  const subsByGroup = {}
  for (const row of subsRes.data || []) {
    if (!row.students || row.students.status !== 'active') continue
    if (!subsByGroup[row.group_id]) subsByGroup[row.group_id] = []
    subsByGroup[row.group_id].push(row)
  }

  const summaryRows = groups.map((g) => ({
    Groupe: g.name,
    Professeur: teacherMap[g.teacher_id] || '—',
    "Nombre d'élèves": (subsByGroup[g.id] || []).length,
  }))

  const sheets = [{ name: 'Récapitulatif', data: withFallback(summaryRows, { Groupe: 'Aucun groupe actif' }) }]
  for (const g of groups) {
    const rows = (subsByGroup[g.id] || []).map((row) => ({
      Nom: row.students.last_name,
      Prénom: row.students.first_name,
      Matricule: row.students.registration_number,
      Niveau: levelMap[row.students.level_id] || '—',
      'Téléphone 1': row.students.phone1 || '',
      'Téléphone 2': row.students.phone2 || '',
      'Prix de la matière': Number(row.monthly_price) || 0,
      'Statut de paiement': paidStudentIds.has(row.student_id) ? 'Payé' : 'Impayé',
    }))
    sheets.push({ name: g.name || `Groupe ${g.id}`, data: withFallback(rows, { Nom: 'Aucun élève' }) })
  }

  return { sheets, fileName: `eleves-par-groupe_${branchSlug(branchName)}_${slug}` }
}

// ---------------------------------------------------------------------------
// 2. Professeurs
// ---------------------------------------------------------------------------
export async function buildTeachersReport({ branchId, branchName, monthKey, slug }) {
  let teachersQuery = supabase.from('teachers').select('*').eq('status', 'active').order('last_name')
  let groupsQuery = supabase.from('groups').select('id, level_id, subject_id, branch_id')
  if (branchId) {
    teachersQuery = teachersQuery.eq('branch_id', branchId)
    groupsQuery = groupsQuery.eq('branch_id', branchId)
  }

  const [
    teachersRes, cyclesRes, levelsRes, branchesRes, subjectsRes, groupsRes,
    tgRes, gsRes, studentsRes, salaryRes, tariffsRes, paymentsRes, teacherBranchesRes,
  ] = await Promise.all([
    teachersQuery,
    supabase.from('cycles').select('id, name, has_fixed_price, fixed_price'),
    supabase.from('levels').select('id, name, cycle_id'),
    supabase.from('branches').select('id, name'),
    supabase.from('subjects').select('id, name'),
    groupsQuery,
    supabase.from('teacher_group_subjects').select('teacher_id, group_id, subject_id'),
    supabase.from('group_students').select('group_id, student_id'),
    supabase.from('students').select('id, status, registration_date, created_at'),
    supabase.from('teacher_salaries').select('teacher_id').eq('month', monthKey).eq('status', 'paid'),
    supabase.from('tariffs').select('level_id, subject_id, price'),
    supabase.from('student_payments').select('student_id, status').eq('month', monthKey),
    supabase.from('teacher_branches').select('teacher_id, branch_id'),
  ])

  const cycleMap = Object.fromEntries((cyclesRes.data || []).map((c) => [c.id, c.name]))
  const levelById = Object.fromEntries((levelsRes.data || []).map((l) => [l.id, l]))
  const cycleById = Object.fromEntries((cyclesRes.data || []).map((c) => [c.id, c]))
  const branchMap = Object.fromEntries((branchesRes.data || []).map((b) => [b.id, b.name]))
  const subjectMap = Object.fromEntries((subjectsRes.data || []).map((s) => [s.id, s.name]))
  const groupById = Object.fromEntries((groupsRes.data || []).map((g) => [g.id, g]))
  const studentById = Object.fromEntries((studentsRes.data || []).map((s) => [s.id, s]))
  const paidStudentIds = new Set(
    (paymentsRes.data || []).filter((p) => PAID_STATUSES.includes(p.status)).map((p) => p.student_id)
  )
  const paidTeacherIds = new Set((salaryRes.data || []).map((r) => r.teacher_id))

  const tariffsByLevelSubject = {}
  for (const row of tariffsRes.data || []) {
    if (!tariffsByLevelSubject[row.level_id]) tariffsByLevelSubject[row.level_id] = {}
    tariffsByLevelSubject[row.level_id][row.subject_id] = Number(row.price)
  }
  const priceForGroup = (groupId) => {
    const group = groupById[groupId]
    if (!group) return 0
    const tariff = tariffsByLevelSubject[group.level_id]?.[group.subject_id]
    if (tariff != null) return tariff
    const cycle = cycleById[levelById[group.level_id]?.cycle_id]
    if (cycle?.has_fixed_price && cycle.fixed_price != null) return Number(cycle.fixed_price)
    return 0
  }

  const groupIdsByTeacher = {}
  const subjectIdsByTeacher = {}
  for (const row of tgRes.data || []) {
    if (!groupIdsByTeacher[row.teacher_id]) groupIdsByTeacher[row.teacher_id] = []
    if (!groupIdsByTeacher[row.teacher_id].includes(row.group_id)) groupIdsByTeacher[row.teacher_id].push(row.group_id)
    if (!subjectIdsByTeacher[row.teacher_id]) subjectIdsByTeacher[row.teacher_id] = new Set()
    subjectIdsByTeacher[row.teacher_id].add(row.subject_id)
  }
  const branchIdsByTeacher = {}
  for (const row of teacherBranchesRes.data || []) {
    if (!branchIdsByTeacher[row.teacher_id]) branchIdsByTeacher[row.teacher_id] = new Set()
    branchIdsByTeacher[row.teacher_id].add(row.branch_id)
  }
  const studentsByGroup = {}
  for (const row of gsRes.data || []) {
    const student = studentById[row.student_id]
    if (!student || student.status !== 'active') continue
    if (!isEnrolledInMonth({ registrationDate: student.registration_date, createdAt: student.created_at }, monthKey)) continue
    if (!paidStudentIds.has(row.student_id)) continue
    if (!studentsByGroup[row.group_id]) studentsByGroup[row.group_id] = []
    studentsByGroup[row.group_id].push(row.student_id)
  }

  const rows = (teachersRes.data || []).map((t) => {
    const groups = (groupIdsByTeacher[t.id] || [])
      .map((groupId) => {
        const group = groupById[groupId]
        if (!group) return null
        return {
          cycleId: levelById[group.level_id]?.cycle_id,
          price: priceForGroup(groupId),
          studentsCount: (studentsByGroup[groupId] || []).length,
        }
      })
      .filter(Boolean)

    const amount = calculateSalary(
      { paymentType: t.remuneration_type, fixed_salary: t.fixed_salary, remuneration_amount: t.remuneration_amount, cycle_rates: t.cycle_rates || {} },
      groups
    )

    const subjectNames = [...(subjectIdsByTeacher[t.id] || [])].map((id) => subjectMap[id]).filter(Boolean).join(', ')
    const branchIds = branchIdsByTeacher[t.id]?.size ? [...branchIdsByTeacher[t.id]] : [t.branch_id].filter(Boolean)
    const branchNames = branchIds.map((id) => branchMap[id]).filter(Boolean).join(', ')
    const rateLabel = t.remuneration_type === 'fixe'
      ? `${Number(t.fixed_salary || t.remuneration_amount || 0).toLocaleString('fr-FR')} DH (fixe)`
      : Object.entries(t.cycle_rates || {}).map(([cycleId, rate]) => `${cycleMap[cycleId] || '?'} : ${rate}%`).join(', ') || '—'

    return {
      Nom: t.last_name,
      Prénom: t.first_name,
      CIN: t.cin || '',
      Téléphone: t.phone || '',
      'Matière(s)': subjectNames || '—',
      'Succursale(s)': branchNames || '—',
      'Type de rémunération': t.remuneration_type === 'fixe' ? 'Fixe' : 'Pourcentage',
      'Taux ou montant fixe': rateLabel,
      'Salaire calculé': amount,
      Statut: paidTeacherIds.has(t.id) ? 'Validé' : 'En attente',
    }
  })

  return {
    sheets: [{ name: 'Professeurs', data: withFallback(rows, { Nom: 'Aucun professeur actif' }) }],
    fileName: `professeurs_${branchSlug(branchName)}_${slug}`,
  }
}

// ---------------------------------------------------------------------------
// 3. Bénéfice net
// ---------------------------------------------------------------------------
export async function buildNetProfitReport({ branchId, branchName, monthKey }) {
  let studentsQuery = supabase.from('students').select('id, branch_id')
  let expensesQuery = supabase.from('expenses').select('branch_id, month, amount, type')
  let teachersQuery = supabase.from('teachers').select('id, branch_id')
  if (branchId) {
    studentsQuery = studentsQuery.eq('branch_id', branchId)
    expensesQuery = expensesQuery.eq('branch_id', branchId)
    teachersQuery = teachersQuery.eq('branch_id', branchId)
  }

  const [paymentsRes, studentsRes, expensesRes, salariesRes, teachersRes, branchesRes] = await Promise.all([
    supabase.from('student_payments').select('student_id, month, amount, status'),
    studentsQuery,
    expensesQuery,
    supabase.from('teacher_salaries').select('teacher_id, month, amount, status'),
    teachersQuery,
    supabase.from('branches').select('id, name, status'),
  ])

  const studentBranch = Object.fromEntries((studentsRes.data || []).map((s) => [s.id, s.branch_id]))
  const teacherBranch = Object.fromEntries((teachersRes.data || []).map((t) => [t.id, t.branch_id]))

  let paidPayments = (paymentsRes.data || []).filter((p) => PAID_STATUSES.includes(p.status))
  let manualExpenses = (expensesRes.data || []).filter((e) => e.type !== 'Auto')
  let validatedSalaries = (salariesRes.data || []).filter((s) => s.status === 'paid' || s.status === 'validated')
  if (branchId) {
    paidPayments = paidPayments.filter((p) => studentBranch[p.student_id] === branchId)
    manualExpenses = manualExpenses.filter((e) => e.branch_id === branchId)
    validatedSalaries = validatedSalaries.filter((s) => teacherBranch[s.teacher_id] === branchId)
  }

  const aggregate = (mKey) => {
    const ca = sum(paidPayments.filter((p) => sameMonth(p.month, mKey)), (p) => p.amount)
    const charges = sum(manualExpenses.filter((e) => sameMonth(e.month, mKey)), (e) => e.amount)
    const salaries = sum(validatedSalaries.filter((s) => sameMonth(s.month, mKey)), (s) => s.amount)
    return { ca, charges, salaries, net: ca - charges - salaries }
  }

  const summary = aggregate(monthKey)
  const summaryRows = [{
    'CA encaissé': summary.ca,
    'Total charges': summary.charges,
    'Total salaires': summary.salaries,
    'Bénéfice net': summary.net,
  }]

  const activeBranches = (branchesRes.data || []).filter((b) => b.status === 'active' && (!branchId || b.id === branchId))
  const branchRows = activeBranches.map((b) => {
    const ca = sum(paidPayments.filter((p) => studentBranch[p.student_id] === b.id && sameMonth(p.month, monthKey)), (p) => p.amount)
    const charges = sum(manualExpenses.filter((e) => e.branch_id === b.id && sameMonth(e.month, monthKey)), (e) => e.amount)
    const salaries = sum(validatedSalaries.filter((s) => teacherBranch[s.teacher_id] === b.id && sameMonth(s.month, monthKey)), (s) => s.amount)
    return { Succursale: b.name, 'CA encaissé': ca, 'Total charges': charges, 'Total salaires': salaries, 'Bénéfice net': ca - charges - salaries }
  })

  const monthlyRows = academicMonths().map((m) => {
    const a = aggregate(m.key)
    return { Mois: m.label, 'CA encaissé': a.ca, Charges: a.charges, Salaires: a.salaries, 'Bénéfice net': a.net }
  })

  return {
    sheets: [
      { name: 'Résumé global', data: summaryRows },
      { name: 'Par succursale', data: withFallback(branchRows, { Succursale: 'Aucune succursale active' }) },
      { name: 'Évolution mensuelle', data: monthlyRows },
    ],
    fileName: `benefice-net_${branchSlug(branchName)}_${schoolYearLabel(academicYearStart())}`,
  }
}

// ---------------------------------------------------------------------------
// 4. Frais de scolarité
// ---------------------------------------------------------------------------
export async function buildTuitionReport({ branchId, branchName, monthKey, slug }) {
  const [{ students, paymentsByStudent }, branchesRes] = await Promise.all([
    fetchFeesData(branchId),
    supabase.from('branches').select('id, name'),
  ])
  const branchMap = Object.fromEntries((branchesRes.data || []).map((b) => [b.id, b.name]))

  const rows = students.filter((s) => s.active).map((s) => {
    const payment = (paymentsByStudent[s.id] || []).find((p) => p.month === monthKey)
    const paid = Boolean(payment && PAID_STATUSES.includes(payment.status))
    return {
      Nom: s.lastName || '',
      Prénom: s.firstName || '',
      Matricule: s.code,
      Niveau: s.level,
      Succursale: branchMap[s.branch_id] || '—',
      'Montant dû': s.du_mois,
      Statut: paid ? 'Payé' : 'Impayé',
      'Date de paiement': paid ? formatShortDate(String(payment.paid_at || '').slice(0, 10)) : '',
    }
  })

  return {
    sheets: [{ name: 'Frais de scolarité', data: withFallback(rows, { Nom: 'Aucun élève actif' }) }],
    fileName: `frais-scolarite_${branchSlug(branchName)}_${slug}`,
  }
}

// ---------------------------------------------------------------------------
// 5. Charges
// ---------------------------------------------------------------------------
export async function buildExpensesReport({ branchId, branchName, monthKey, slug }) {
  let expensesQuery = supabase.from('expenses').select('*').eq('month', monthKey)
  let teachersQuery = supabase
    .from('teachers')
    .select('id, first_name, last_name, branch_id, remuneration_type, fixed_salary, remuneration_amount')
    .eq('status', 'active')
  if (branchId) {
    expensesQuery = expensesQuery.eq('branch_id', branchId)
    teachersQuery = teachersQuery.eq('branch_id', branchId)
  }

  const [expensesRes, teachersRes, branchesRes] = await Promise.all([
    expensesQuery,
    teachersQuery,
    supabase.from('branches').select('id, name'),
  ])
  const branchMap = Object.fromEntries((branchesRes.data || []).map((b) => [b.id, b.name]))
  const persisted = expensesRes.data || []
  const validatedTeacherIds = new Set(persisted.filter((e) => e.type === 'Auto' && e.teacher_id).map((e) => e.teacher_id))

  const autoRows = (teachersRes.data || [])
    .filter((t) => t.remuneration_type === 'fixe' && !validatedTeacherIds.has(t.id))
    .map((t) => ({
      Intitulé: `Salaire fixe – ${`${t.first_name} ${t.last_name}`.trim()}`,
      Type: 'Auto',
      Montant: Number(t.fixed_salary || t.remuneration_amount || 0),
      Date: '—',
      Succursale: branchMap[t.branch_id] || '—',
    }))

  const persistedRows = persisted.map((e) => ({
    Intitulé: e.title,
    Type: TYPE_LABELS[e.type] || e.type,
    Montant: Number(e.amount),
    Date: formatShortDate(e.charge_date || e.month),
    Succursale: branchMap[e.branch_id] || '—',
  }))

  return {
    sheets: [{ name: 'Charges', data: withFallback([...autoRows, ...persistedRows], { Intitulé: 'Aucune charge' }) }],
    fileName: `charges_${branchSlug(branchName)}_${slug}`,
  }
}
