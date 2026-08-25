import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

export const safeFilename = (value) => String(value || 'document').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/(^-|-$)/g, '').toLowerCase()

/**
 * Captures a DOM element and downloads it as A4 portrait PDF pages.
 * Scrollable elements are temporarily expanded so the complete document is exported.
 */
export async function exportToPdf(element, filename = 'document.pdf') {
  if (!element) throw new Error('Un élément à exporter est requis.')

  const previous = { maxHeight: element.style.maxHeight, height: element.style.height, overflow: element.style.overflow, scrollTop: element.scrollTop }
  element.style.maxHeight = 'none'
  element.style.height = 'auto'
  element.style.overflow = 'visible'
  element.scrollTop = 0

  let canvas
  try {
    canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      width: element.scrollWidth,
      height: element.scrollHeight,
    })
  } finally {
    element.style.maxHeight = previous.maxHeight
    element.style.height = previous.height
    element.style.overflow = previous.overflow
    element.scrollTop = previous.scrollTop
  }

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const margin = 10
  const printableWidth = pdf.internal.pageSize.getWidth() - margin * 2
  const printableHeight = pdf.internal.pageSize.getHeight() - margin * 2
  const ratio = printableWidth / canvas.width
  const sourcePageHeight = Math.floor(printableHeight / ratio)

  for (let sourceY = 0, page = 0; sourceY < canvas.height; sourceY += sourcePageHeight, page += 1) {
    const sliceHeight = Math.min(sourcePageHeight, canvas.height - sourceY)
    const slice = document.createElement('canvas')
    slice.width = canvas.width
    slice.height = sliceHeight
    slice.getContext('2d').drawImage(canvas, 0, sourceY, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight)
    if (page > 0) pdf.addPage()
    pdf.addImage(slice.toDataURL('image/png'), 'PNG', margin, margin, printableWidth, sliceHeight * ratio, undefined, 'FAST')
  }

  pdf.save(filename.endsWith('.pdf') ? filename : `${safeFilename(filename)}.pdf`)
}
