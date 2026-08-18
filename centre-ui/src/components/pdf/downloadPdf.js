import { pdf } from '@react-pdf/renderer'
import { safeFilename } from '../../utils/exportToPdf'

export async function downloadPdfDocument(documentElement, filename = 'document.pdf') {
  const blob = await pdf(documentElement).toBlob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename.endsWith('.pdf') ? filename : `${safeFilename(filename)}.pdf`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
