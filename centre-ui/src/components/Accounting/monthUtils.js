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

// Les 12 mois d'une année scolaire, de septembre à août. L'année de départ est
// paramétrable : sans cela, un écran filtré sur 2025-2026 afficherait quand
// même les mois de l'année académique en cours.
export function academicMonths(startYear = academicYearStart()) {
  const start = Number(startYear) || academicYearStart()
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

function daysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate()
}

// Le cycle de facturation d'un élève est ancré sur son jour d'inscription, pas sur une
// date fixe du mois : inscrit le 26/07, il doit régler le 26 de chaque mois suivant.
// Les mois plus courts que le jour d'inscription (le 31 en février) basculent sur leur
// dernier jour.
export function billingDueDate(registrationDate, monthKey) {
  const regDate = parseLocalDate(registrationDate)
  const monthDate = parseLocalDate(normalizeMonthKey(monthKey))
  if (!regDate || !monthDate) return null
  const year = monthDate.getFullYear()
  const monthIndex = monthDate.getMonth()
  return new Date(year, monthIndex, Math.min(regDate.getDate(), daysInMonth(year, monthIndex)))
}

// Année scolaire en cours : elle démarre en septembre, donc janvier→août appartient
// encore à l'année ouverte l'automne précédent.
export function currentSchoolYearStart(now = new Date()) {
  return now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1
}

export function receiptDateFromRegistration(registrationDate, monthKey) {
  const regDate = parseLocalDate(registrationDate)
  const monthDate = parseLocalDate(monthKey)
  if (!regDate && !monthDate) return null
  if (!regDate) return monthDate
  if (!monthDate) return regDate
  return billingDueDate(registrationDate, monthKey) || monthDate
}

// Le jour comptable se calcule TOUJOURS à l'heure du centre, jamais à celle de
// l'ordinateur qui affiche la page. Avant, un PC réglé sur un mauvais fuseau
// horaire (ou dont l'heure a été corrigée) faisait glisser tout l'historique
// d'un jour : les 7 000 DH encaissés le 22 apparaissaient le 21.
const CENTER_TIME_ZONE = 'Africa/Casablanca'
const centerClock = new Intl.DateTimeFormat('en-CA', {
  timeZone: CENTER_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  hourCycle: 'h23',
})

export function accountingDayBucket(value = new Date()) {
  // Une date seule ("2026-10-01") est déjà un jour : la convertir en instant
  // la ferait tomber à minuit UTC, donc la veille après le décalage de 3h.
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const parts = Object.fromEntries(centerClock.formatToParts(date).map((part) => [part.type, part.value]))
  // Les encaissements saisis avant 3h du matin comptent pour la veille.
  const shift = Number(parts.hour) < 3 ? 1 : 0
  const day = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day) - shift))
  return `${day.getUTCFullYear()}-${String(day.getUTCMonth() + 1).padStart(2, '0')}-${String(day.getUTCDate()).padStart(2, '0')}`
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
