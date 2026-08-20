import * as XLSX from 'xlsx'

// Excel sheet names: max 31 chars, and : \ / ? * [ ] are forbidden.
function safeSheetName(name, index) {
  const cleaned = String(name || `Feuille ${index + 1}`).replace(/[:\\/?*[\]]/g, '-').trim()
  return (cleaned || `Feuille ${index + 1}`).slice(0, 31)
}

export function exportToExcel(sheets, fileName) {
  const workbook = XLSX.utils.book_new()
  const usedNames = new Set()
  sheets.forEach(({ name, data }, index) => {
    let safeName = safeSheetName(name, index)
    let suffix = 1
    while (usedNames.has(safeName.toLowerCase())) {
      suffix += 1
      const marker = `-${suffix}`
      safeName = `${safeSheetName(name, index).slice(0, 31 - marker.length)}${marker}`
    }
    usedNames.add(safeName.toLowerCase())
    const worksheet = XLSX.utils.json_to_sheet(data)
    XLSX.utils.book_append_sheet(workbook, worksheet, safeName)
  })
  XLSX.writeFile(workbook, `${fileName}.xlsx`)
}
