import { ThermalReceipt, ThermalInfo, ThermalSeparator, ThermalLines, ThermalTotal, ThermalStatus } from './ThermalReceipt'

export default function EnrollmentReceiptPdf({ form, lines, total, dateLabel, registrationFee, registrationFeePaid, firstMonthPaid }) {
  return (
    <ThermalReceipt
      tagline="Centre de soutien scolaire — Agadir"
      title="Reçu d'inscription"
      code={form.code}
      date={dateLabel}
    >
      <ThermalInfo label="Élève" value={`${form.firstName || 'Élève'} ${form.lastName || ''}`.trim()} />
      <ThermalInfo label="Niveau" value={form.level} />
      <ThermalInfo label="Cycle" value={form.cycle} />
      <ThermalSeparator />

      <ThermalLines title="Matières inscrites (prix mensuel)" lines={lines} />
      <ThermalTotal label="Total mensuel" amount={total} />
      <ThermalStatus>{firstMonthPaid ? `Payé le ${dateLabel}` : 'En attente de paiement'}</ThermalStatus>

      {registrationFee != null && (
        <>
          <ThermalSeparator />
          <ThermalLines title="Frais d'inscription (une seule fois)" lines={[{ name: "Frais d'inscription", amount: registrationFee }]} />
          <ThermalStatus>{registrationFeePaid ? `Payé le ${dateLabel}` : 'En attente de paiement'}</ThermalStatus>
        </>
      )}
    </ThermalReceipt>
  )
}
