import { Document } from '@react-pdf/renderer'
import { ThermalReceiptPage, ThermalInfo, ThermalSeparator, ThermalLines, ThermalTotal, ThermalStatus } from './ThermalReceipt'

function FeeReceiptPage({ receipt, dateLabel }) {
  const { student, lines, total, month } = receipt

  return (
    <ThermalReceiptPage
      tagline="Cours particuliers — Agadir"
      title="Reçu de paiement mensuel"
      code={student.code}
      date={dateLabel}
    >
      <ThermalInfo label="Élève" value={student.name} />
      <ThermalInfo label="Niveau" value={student.level} />
      <ThermalInfo label="Mois réglé" value={month} />
      <ThermalSeparator />

      <ThermalLines title="Détail des matières" lines={lines} />
      <ThermalTotal label="Total payé" amount={total} />

      <ThermalStatus>{`Paiement reçu en espèces\nle ${dateLabel}`}</ThermalStatus>
    </ThermalReceiptPage>
  )
}

export default function FeeReceiptPdf({ receipt, dateLabel }) {
  return (
    <Document>
      <FeeReceiptPage receipt={receipt} dateLabel={dateLabel} />
    </Document>
  )
}

// Plusieurs mois (paiement d'avance) en un seul travail d'impression :
// un ticket par mois.
export function FeeReceiptsPdf({ receipts, dateLabelFor }) {
  return (
    <Document>
      {receipts.map((receipt) => (
        <FeeReceiptPage key={receipt.monthKey || receipt.month} receipt={receipt} dateLabel={dateLabelFor(receipt)} />
      ))}
    </Document>
  )
}
