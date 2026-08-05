import { supabase } from '../../supabaseClient'
import { fetchCatalog } from '../Students/enrollment/enrollmentApi'

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

export function academicYearStart(now = new Date()) {
  return now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1
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
  const start = academicYearStart(now)
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
  if (!student.chosen.length) return [{ name: 'Forfait tout inclus', amount: student.du_mois }]
  return student.chosen.map((name) => ({ name, amount: priceFor(catalog, student, name) }))
}

export async function fetchFeesData() {
  const catalog = await fetchCatalog()

  const [studentsRes, subsRes, paymentsRes] = await Promise.all([
    supabase
      .from('students')
      .select('id, first_name, last_name, registration_number, registration_date, phone1, phone2, status, level_id, cycle_id, du_mois, levels(name, cycle_id, cycles(name)), filieres(name)')
      .order('created_at', { ascending: false }),
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
      code: s.registration_number,
      level: s.levels?.name || '',
      cycle: s.levels?.cycles?.name || '',
      level_id: s.level_id,
      cycle_id: s.cycle_id,
      active: s.status === 'active',
      registrationDate: s.registration_date || '',
      phone: s.phone1 || '',
      phone2: s.phone2 || '',
      filiere: s.filieres?.name || '',
      chosen,
      subjectDetails,
      du_mois: Number.isFinite(stored) && stored > 0 ? stored : derived,
    }
  })

  const paymentsByStudent = {}
  for (const p of paymentsRes.data || []) {
    if (!paymentsByStudent[p.student_id]) paymentsByStudent[p.student_id] = []
    paymentsByStudent[p.student_id].push({
      month: p.month,
      amount: Number(p.amount),
      status: p.status || 'paid',
      paid_at: p.paid_at,
      paid_by: p.paid_by,
    })
  }

  return { students, paymentsByStudent, catalog }
}
