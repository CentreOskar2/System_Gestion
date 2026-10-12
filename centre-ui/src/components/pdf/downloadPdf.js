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

// Iframe de la dernière impression. On ne la retire qu'à l'impression suivante :
// la supprimer pendant que la boîte d'impression est ouverte annulerait le
// travail dans certains navigateurs.
let printFrame = null

function clearPrintFrame() {
  if (!printFrame) return
  URL.revokeObjectURL(printFrame.src)
  printFrame.remove()
  printFrame = null
}

// Imprime un PDF sans le télécharger : il est chargé dans une iframe invisible
// et on ouvre directement la boîte d'impression du navigateur dessus.
export async function printPdfDocument(documentElement) {
  const blob = await pdf(documentElement).toBlob()
  clearPrintFrame()

  const frame = document.createElement('iframe')
  frame.setAttribute('aria-hidden', 'true')
  // Ni display:none ni taille nulle : le lecteur PDF de Chrome ne se chargerait
  // pas et rien ne s'imprimerait.
  frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:10px;height:10px;border:0;opacity:0'
  printFrame = frame

  await new Promise((resolve, reject) => {
    frame.onload = resolve
    frame.onerror = () => reject(new Error("Le reçu n'a pas pu être chargé pour l'impression."))
    frame.src = URL.createObjectURL(blob)
    document.body.appendChild(frame)
  })

  frame.contentWindow.focus()
  frame.contentWindow.print()
}
