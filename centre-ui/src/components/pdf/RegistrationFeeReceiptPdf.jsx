import { ThermalReceipt, ThermalInfo, ThermalSeparator, ThermalLines, ThermalTotal, ThermalStatus } from './ThermalReceipt'

export default function RegistrationFeeReceiptPdf({ student, amount, schoolYear, dateLabel }) {
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

      <ThermalLines title="Détail" lines={[{ name: `Frais d'inscription — ${schoolYear}`, amount }]} />
      <ThermalTotal label="Total payé" amount={amount} />

      <ThermalStatus>{`Paiement reçu en espèces\nle ${dateLabel}`}</ThermalStatus>
    </ThermalReceipt>
  )
}
