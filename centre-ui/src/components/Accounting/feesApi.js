import { supabase } from '../../supabaseClient'
import { fetchAllRows } from '../../utils/fetchAllRows'
import { fetchCatalog, isPackageLevel } from '../Students/enrollment/enrollmentApi'
import { academicYearStart, normalizeMonthKey } from './monthUtils'

export { academicYearStart }

export const MONTHS = ['Sept', 'Oct', 'Nov', 'Déc', 'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août']

const FEES_CACHE_KEY = 'fees_cache_version'
const cacheSubscribers = new Set()
let cacheVersion = 0

export function invalidateFeesCache() {
  cacheVersion += 1
  try {
    localStorage.setItem(FEES_CACHE_KEY, String(cacheVersion))
  } catch {
    /* storage unavailable (private mode etc.) — in-app subscribers still notified */
  }
  for (const callback of cacheSubscribers) callback(cacheVersion)
}

export function subscribeFeesCache(callback) {
  cacheSubscribers.add(callback)
  return () => cacheSubscribers.delete(callback)
}

function monthNumber(index) {
  const month = index + 9
  return month > 12 ? month - 12 : month
}

export function monthDate(index, yearStart = academicYearStart()) {
  const year = index >= 4 ? yearStart + 1 : yearStart
  return `${year}-${String(monthNumber(index)).padStart(2, '0')}-01`
}

export function isFutureMonth(index) {
  const now = new Date()
  const start = academicYearStart()
  const year = index >= 4 ? start + 1 : start
  const first = new Date(year, monthNumber(index) - 1, 1)
  const current = new Date(now.getFullYear(), now.getMonth(), 1)
  return first > current
}

export function priceFor(catalog, student, subjectName, details = student?.subjectDetails?.[subjectName]) {
  if (details?.priceType === 'manual' && details.manualPrice != null) {
    const manual = Number(details.manualPrice)
    if (Number.isFinite(manual) && manual >= 0) return manual
  }
  const subjectId = catalog?.subjectsByName?.[subjectName]?.id
  if (student?.level_id && subjectId) {
    const tariff = catalog?.tariffsByLevelSubject?.[student.level_id]?.[subjectId]
    if (tariff != null) return Number(tariff)
  }
  return 0
}

export function studentLineItems(student, catalog) {
  // Cycles au forfait : une seule ligne, le prix couvre tout le niveau.
  if (isPackageLevel(catalog, student.level)) {
    return [{ name: `Forfait ${student.level} — toutes matières`, amount: student.du_mois }]
  }
  if (!student.chosen.length) return [{ name: 'Forfait tout inclus', amount: student.du_mois }]
  return student.chosen.map((name) => ({ name, amount: priceFor(catalog, student, name) }))
}

// Les encaissements portent l'identifiant de qui les a validés (paid_by pour les
// mensualités, validated_by pour les frais d'inscription). L'historique de l'admin
// doit afficher un nom, pas un UUID : on charge la liste des utilisateurs pour la
// jointure côté client.
//
// Une secrétaire n'a pas forcément le droit de lire la table users ; ce n'est pas
// bloquant, elle ne voit que ses propres lignes et n'a donc aucun nom à résoudre.
export async function fetchAccountingUsers() {
  const { data, error } = await supabase.from('users').select('id, first_name, last_name')
  if (error) {
    console.error(error)
    return []
  }
  return data || []
}

// Une ligne student_payments est-elle un paiement « en bloc » (avance, 1er
// mois réglé à l'inscription, paiement antérieur au détail par matière) ou le
// simple résumé « mois complet » d'un mois réglé matière par matière ?
//
// Le résumé est toujours écrit APRÈS les lignes par matière qu'il résume :
// au moins une d'elles est datée au plus tard à son paid_at. Un paiement en
// bloc, lui, précède toute ligne par matière du mois (une matière ajoutée
// ensuite, par exemple).
export function isBlockPayment(payment, monthSubjectRows) {
  if (!payment) return false
  const rows = monthSubjectRows || []
  if (!payment.paid_at) return rows.length === 0
  const paidAt = new Date(payment.paid_at).getTime()
  return !rows.some((row) => !row.paid_at || new Date(row.paid_at).getTime() <= paidAt)
}

export async function recordFirstMonthPayment({ studentId, month, amount, userId = null }) {
  const { error } = await supabase.from('student_payments').upsert(
    { student_id: studentId, month, amount, status: 'paid', paid_at: new Date().toISOString(), paid_by: userId },
    { onConflict: 'student_id,month' }
  )
  if (error) throw new Error(error.message)
}

export async function fetchFeesData(branchId = null) {
  const catalog = await fetchCatalog()

  const studentsQuery = () => {
    let query = supabase
      .from('students')
      .select('id, first_name, last_name, registration_number, registration_date, created_at, phone1, phone2, status, level_id, cycle_id, du_mois, branch_id, levels(name, cycle_id, cycles(name)), study_branches(name)')
      .order('created_at', { ascending: false })
      .order('id')
    if (branchId && branchId !== 'all') query = query.eq('branch_id', branchId)
    return query
  }

  // Tables qui dépassent 1000 lignes : lues par pages (voir fetchAllRows).
  const [studentsRes, subsRes, paymentsRes, paymentSubjectsRes] = await Promise.all([
    fetchAllRows(studentsQuery),
    fetchAllRows(() =>
      supabase
        .from('student_subscriptions')
        .select('student_id, subject_id, teacher_id, group_id, pricing_type, monthly_price, started_at, subjects(name), teachers(first_name,last_name), groups(name)')
        .order('id')
    ),
    fetchAllRows(() =>
      supabase
        .from('student_payments')
        .select('student_id, month, amount, status, paid_at, paid_by')
        .order('month')
        .order('student_id')
    ),
    fetchAllRows(() =>
      supabase
        .from('student_payment_subjects')
        .select('id, student_id, subject_id, month, amount, paid_at, paid_by')
        .order('id')
    ),
  ])

  const firstError = [studentsRes, subsRes, paymentsRes, paymentSubjectsRes].find((r) => r.error)
  if (firstError) throw new Error(firstError.error.message)

  const subsByStudent = {}
  for (const sub of subsRes.data || []) {
    if (!subsByStudent[sub.student_id]) subsByStudent[sub.student_id] = []
    subsByStudent[sub.student_id].push(sub)
  }

  const students = (studentsRes.data || []).map((s) => {
    const list = subsByStudent[s.id] || []
    const chosen = []
    const subjectDetails = {}
    let derived = 0
    for (const x of list) {
      const subjectName = x.subjects?.name
      if (!subjectName) continue
      derived += Number(x.monthly_price || 0)
      chosen.push(subjectName)
      subjectDetails[subjectName] = {
        subject_id: x.subject_id,
        teacher: x.teachers ? `${x.teachers.first_name} ${x.teachers.last_name}` : '',
        // L'id fait foi : plusieurs groupes portent le même nom, une recherche
        // par nom prendrait le premier venu. Le nom reste pour l'affichage.
        group_id: x.group_id || '',
        group: x.groups?.name || '',
        priceType: x.pricing_type || 'standard',
        manualPrice: x.pricing_type === 'manual' ? Number(x.monthly_price) : undefined,
        // null = suivie depuis l'inscription ; sinon matière ajoutée en cours
        // d'année, due seulement à partir de ce moment (migration 039).
        startedAt: x.started_at || null,
      }
    }
    const stored = Number(s.du_mois)
    return {
      id: s.id,
      name: `${s.first_name} ${s.last_name}`.trim(),
      firstName: s.first_name || '',
      lastName: s.last_name || '',
      code: s.registration_number,
      level: s.levels?.name || '',
      cycle: s.levels?.cycles?.name || '',
      level_id: s.level_id,
      cycle_id: s.cycle_id,
      branch_id: s.branch_id,
      active: s.status === 'active',
      registrationDate: s.registration_date || (s.created_at || '').slice(0, 10),
      createdAt: s.created_at || '',
      phone: s.phone1 || '',
      phone2: s.phone2 || '',
      filiere: s.study_branches?.name || '',
      chosen,
      subjectDetails,
      du_mois: Number.isFinite(stored) && stored > 0 ? stored : derived,
    }
  })

  const paymentsByStudent = {}
  for (const p of paymentsRes.data || []) {
    if (!paymentsByStudent[p.student_id]) paymentsByStudent[p.student_id] = []
    paymentsByStudent[p.student_id].push({
      month: normalizeMonthKey(p.month),
      amount: Number(p.amount),
      status: p.status || 'paid',
      paid_at: p.paid_at,
      paid_by: p.paid_by,
    })
  }

  // Détail par matière : sert au calendrier "segmenté" et à la modale de
  // validation. student_payments (ci-dessus) reste la source de vérité pour
  // "le mois est-il intégralement réglé" — inchangée pour ne rien casser
  // ailleurs (Dashboard, Rapports, Retards & Impayés, Salaires).
  const paymentSubjectsByStudent = {}
  for (const p of paymentSubjectsRes.data || []) {
    if (!paymentSubjectsByStudent[p.student_id]) paymentSubjectsByStudent[p.student_id] = []
    paymentSubjectsByStudent[p.student_id].push({
      subject_id: p.subject_id,
      month: normalizeMonthKey(p.month),
      amount: Number(p.amount),
      paid_at: p.paid_at,
      paid_by: p.paid_by,
    })
  }

  // Encaissements réels, un par somme reçue, chacun à SA date : c'est ce que
  // la caisse du jour et l'historique journalier additionnent.
  //   - chaque matière réglée (student_payment_subjects) ;
  //   - chaque paiement en bloc (student_payments sans détail qui le précède).
  // Le résumé « mois complet » n'y figure pas : il est supprimé quand on
  // décoche une matière, recréé quand le mois se complète, et son montant
  // couvre des matières payées à des jours différents. L'additionner faisait
  // bouger les montants des jours passés.
  const rowsByStudentMonth = {}
  for (const row of paymentSubjectsRes.data || []) {
    const key = `${row.student_id}:${normalizeMonthKey(row.month)}`
    if (!rowsByStudentMonth[key]) rowsByStudentMonth[key] = []
    rowsByStudentMonth[key].push(row)
  }
  const cashPayments = [
    ...(paymentSubjectsRes.data || []).map((row) => ({
      id: `subject-${row.id}`,
      student_id: row.student_id,
      subject_id: row.subject_id,
      month: normalizeMonthKey(row.month),
      amount: Number(row.amount),
      status: 'paid',
      paid_at: row.paid_at,
      paid_by: row.paid_by,
    })),
    ...(paymentsRes.data || [])
      .filter((payment) => isBlockPayment(payment, rowsByStudentMonth[`${payment.student_id}:${normalizeMonthKey(payment.month)}`]))
      .map((payment) => ({
        id: `month-${payment.student_id}-${normalizeMonthKey(payment.month)}`,
        student_id: payment.student_id,
        month: normalizeMonthKey(payment.month),
        amount: Number(payment.amount),
        status: payment.status || 'paid',
        paid_at: payment.paid_at,
        paid_by: payment.paid_by,
      })),
  ]

  return {
    students,
    paymentsByStudent,
    paymentSubjectsByStudent,
    payments: paymentsRes.data || [],
    cashPayments,
    catalog,
  }
}
