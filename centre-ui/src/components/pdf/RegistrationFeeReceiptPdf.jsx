import { formatMoney } from './pdfStyles'
import { ThermalReceipt, ThermalInfo, ThermalSeparator, ThermalLines, ThermalTotal, ThermalStatus } from './ThermalReceipt'

// amount = somme encaissée par CE reçu. dueAmount / paidBefore / remaining
// décrivent les frais de l'année quand ils sont payés en plusieurs fois ; sans
// eux, le reçu est celui d'un paiement en une fois.
export default function RegistrationFeeReceiptPdf({ student, amount, schoolYear, dateLabel, dueAmount = amount, paidBefore = 0, remaining = 0 }) {
  const lines = [{ name: `Frais d'inscription — ${schoolYear}`, amount: dueAmount }]
  if (paidBefore > 0) lines.push({ name: 'Déjà payé avant', amount: -paidBefore })

  return (
    <ThermalReceipt
      tagline="Cours particuliers — Agadir"
      title="Reçu de frais d'inscription"
      code={student.code}
      date={dateLabel}
    >
      <ThermalInfo label="Élève" value={student.name} />
      <ThermalInfo label="Niveau" value={student.level} />
      <ThermalInfo label="Année" value={schoolYear} />
      <ThermalSeparator />

      <ThermalLines title="Détail" lines={lines} />
      <ThermalTotal label={remaining > 0 ? 'Avance payée' : 'Total payé'} amount={amount} />

      <ThermalStatus>
        {remaining > 0
          ? `Avance reçue le ${dateLabel}\nReste à payer : ${formatMoney(remaining)}`
          : paidBefore > 0
            ? `Frais d'inscription soldés\nle ${dateLabel}`
            : `Paiement reçu en espèces\nle ${dateLabel}`}
      </ThermalStatus>
    </ThermalReceipt>
  )
}
