const MONTH_NAMES = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

function academicYearStart(now = new Date()) {
  return now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1
}

export function currentMonthKey(now = new Date()) {
  const month = now.getMonth() + 1
  return `${now.getFullYear()}-${String(month).padStart(2, '0')}-01`
}

export function academicMonths(now = new Date()) {
  const start = academicYearStart(now)
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
