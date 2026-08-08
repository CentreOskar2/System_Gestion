export const ACADEMIC_YEAR = 2026

const MONTH_NAMES = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

export function academicYearStart() {
  return ACADEMIC_YEAR
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
