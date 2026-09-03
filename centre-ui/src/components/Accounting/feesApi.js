import { supabase } from '../../supabaseClient'
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

export async function recordFirstMonthPayment({ studentId, month, amount, userId = null }) {
  const { error } = await supabase.from('student_payments').upsert(
    { student_id: studentId, month, amount, status: 'paid', paid_at: new Date().toISOString(), paid_by: userId },
    { onConflict: 'student_id,month' }
  )
  if (error) throw new Error(error.message)
}

export async function fetchFeesData(branchId = null) {
  const catalog = await fetchCatalog()

  let studentsQuery = supabase
    .from('students')
    .select('id, first_name, last_name, registration_number, registration_date, created_at, phone1, phone2, status, level_id, cycle_id, du_mois, branch_id, levels(name, cycle_id, cycles(name)), study_branches(name)')
    .order('created_at', { ascending: false })
  if (branchId && branchId !== 'all') studentsQuery = studentsQuery.eq('branch_id', branchId)

  const [studentsRes, subsRes, paymentsRes] = await Promise.all([
    studentsQuery,
    supabase
      .from('student_subscriptions')
      .select('student_id, subject_id, teacher_id, group_id, pricing_type, monthly_price, subjects(name), teachers(first_name,last_name), groups(name)'),
    supabase
      .from('student_payments')
      .select('student_id, month, amount, status, paid_at, paid_by')
      .order('month'),
  ])

  const firstError = [studentsRes, subsRes, paymentsRes].find((r) => r.error)
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
        group: x.groups?.name || '',
        priceType: x.pricing_type || 'standard',
        manualPrice: x.pricing_type === 'manual' ? Number(x.monthly_price) : undefined,
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

  return { students, paymentsByStudent, payments: paymentsRes.data || [], catalog }
}
