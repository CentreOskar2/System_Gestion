import { ThermalReceipt, ThermalInfo, ThermalSeparator, ThermalLines, ThermalTotal, ThermalStatus } from './ThermalReceipt'

// Reçu d'une mensualité de formation. Volontairement proche de FeeReceiptPdf :
// c'est le même geste au comptoir, le parent doit reconnaître le document.
// La différence tient au détail — une formation et son niveau, là où la
// scolarité liste les matières suivies.
export default function FormationFeeReceiptPdf({ student, formationName, levelName, groupName, monthLabel, amount, dateLabel }) {
  return (
    <ThermalReceipt
      tagline="Cours particuliers — Agadir"
      title="Reçu de frais de formation"
      code={student.code}
      date={dateLabel}
    >
      <ThermalInfo label="Élève" value={student.name} />
      <ThermalInfo label="Formation" value={formationName} />
      <ThermalInfo label="Niveau" value={levelName} />
      {groupName ? <ThermalInfo label="Groupe" value={groupName} /> : null}
      <ThermalSeparator />

      <ThermalLines title="Détail" lines={[{ name: `${formationName} — ${levelName} · ${monthLabel}`, amount }]} />
      <ThermalTotal label="Total payé" amount={amount} />

      <ThermalStatus>{`Paiement reçu en espèces\nle ${dateLabel}`}</ThermalStatus>
    </ThermalReceipt>
  )
}
