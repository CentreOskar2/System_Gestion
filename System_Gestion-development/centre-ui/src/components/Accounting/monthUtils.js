export const ACADEMIC_YEAR = 2026

const MONTH_NAMES = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

// Calendar months (1-12, Janvier→Décembre), independent of any school year — for filters
// that let a month be picked on its own (e.g. "Charges" page).
export function calendarMonthOptions() {
  return MONTH_NAMES.map((label, index) => ({ value: String(index + 1), label }))
}

// "2026-08-05" -> "05/08/2026"
export function formatShortDate(value) {
  const [year, month, day] = String(value || '').split('-')
  return year && month && day ? `${day}/${month}/${year}` : '—'
}

export function academicYearStart() {
  return ACADEMIC_YEAR
}

export function schoolYearLabel(startYear) {
  const year = Number(startYear)
  if (!Number.isFinite(year)) return String(startYear || '')
  return `${year}-${year + 1}`
}

// "2026-2027" -> 2026. Accepts a bare start year ("2026" / 2026) too.
export function schoolYearStartOf(label) {
  const match = /^(\d{4})/.exec(String(label || '').trim())
  return match ? Number(match[1]) : null
}

export function schoolYearOptions(referenceStart = academicYearStart(), span = 4) {
  const current = Number(referenceStart) || academicYearStart()
  const years = []
  for (let year = current - span; year <= current + 1; year += 1) {
    years.push({ value: String(year), label: schoolYearLabel(year) })
  }
  return years
}

export function currentMonthKey(now = new Date()) {
  const start = academicYearStart()
  if (now.getFullYear() === start && now.getMonth() < 8) return `${start}-09-01`
  const month = now.getMonth() + 1
  return `${now.getFullYear()}-${String(month).padStart(2, '0')}-01`
}

export function academicMonths() {
  const start = academicYearStart()
  const months = []
  for (let i = 0; i < 12; i += 1) {
    const month = ((i + 8) % 12) + 1
    const year = start + (i >= 4 ? 1 : 0)
    months.push({
      key: `${year}-${String(month).padStart(2, '0')}-01`,
      label: `${MONTH_NAMES[month - 1]} ${year}`,
    })
  }
  return months
}

export function monthLabelOf(key) {
  const match = /^(\d{4})-(\d{2})-01$/.exec(String(key))
  if (!match) return String(key)
  const month = Number(match[2])
  const label = MONTH_NAMES[month - 1]
  return label ? `${label} ${match[1]}` : String(key)
}

export function normalizeMonthKey(value) {
  const match = /^(\d{4})-(\d{2})/.exec(String(value || ''))
  return match ? `${match[1]}-${match[2]}-01` : String(value || '')
}

export function enrollmentDateOf(student) {
  const value =
    student?.registrationDate ||
    student?.enrolledAt ||
    (student?.createdAt ? String(student.createdAt).slice(0, 10) : '')
  return value ? String(value).slice(0, 10) : ''
}

export function enrollmentMonthKeyOf(student) {
  const match = /^(\d{4})-(\d{2})/.exec(enrollmentDateOf(student))
  return match ? `${match[1]}-${match[2]}-01` : ''
}

export function parseLocalDate(value) {
  const text = String(value || '').trim()
  if (!text) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text)
  if (!match) return null
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatFrenchDate(value) {
  const date = value instanceof Date ? value : parseLocalDate(value)
  if (!date) return '—'
  return new Intl.DateTimeFormat('fr-MA').format(date)
}

export function receiptDateFromRegistration(registrationDate, monthKey) {
  const regDate = parseLocalDate(registrationDate)
  const monthDate = parseLocalDate(monthKey)
  if (!regDate && !monthDate) return null
  if (!regDate) return monthDate
  if (!monthDate) return regDate
  return new Date(monthDate.getFullYear(), monthDate.getMonth(), regDate.getDate())
}

export function accountingDayBucket(value = new Date()) {
  const date = value instanceof Date ? new Date(value) : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  if (date.getHours() < 3) date.setDate(date.getDate() - 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function accountingDayStart(value = new Date()) {
  const bucket = accountingDayBucket(value)
  return bucket ? new Date(`${bucket}T03:00:00`) : null
}

export function formatAccountingDay(value) {
  const date = parseLocalDate(value)
  if (!date) return '—'
  return new Intl.DateTimeFormat('fr-MA', { day: '2-digit', month: 'long', year: 'numeric' }).format(date)
}

export function isEnrolledInMonth(student, monthKey) {
  const enrolled = enrollmentMonthKeyOf(student)
  return !enrolled || enrolled <= String(monthKey || '').slice(0, 10)
}
