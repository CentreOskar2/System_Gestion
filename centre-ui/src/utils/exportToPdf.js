import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

export const safeFilename = (value) => String(value || 'document').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/(^-|-$)/g, '').toLowerCase()

/** Captures a DOM element and downloads it as a fitted A4 portrait PDF. */
export async function exportToPdf(element, filename = 'document.pdf') {
  if (!element) throw new Error('Un élément à exporter est requis.')
  const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false })
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const margin = 10
  const pageWidth = pdf.internal.pageSize.getWidth() - margin * 2
  const pageHeight = pdf.internal.pageSize.getHeight() - margin * 2
  const ratio = Math.min(pageWidth / canvas.width, pageHeight / canvas.height)
  const width = canvas.width * ratio
  const height = canvas.height * ratio
  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', (pdf.internal.pageSize.getWidth() - width) / 2, margin, width, height, undefined, 'FAST')
  pdf.save(filename.endsWith('.pdf') ? filename : `${safeFilename(filename)}.pdf`)
}
