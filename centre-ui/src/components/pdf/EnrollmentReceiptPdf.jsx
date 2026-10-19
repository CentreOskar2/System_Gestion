import { registrationFeeStatusLabel } from '../Accounting/registrationFeesApi'
import { firstMonthStatusLabel } from '../Accounting/subjectPaymentsApi'
import { ThermalReceipt, ThermalInfo, ThermalSeparator, ThermalLines, ThermalTotal, ThermalStatus } from './ThermalReceipt'

// registrationFee = { due, paidNow, remaining } (frais enregistrés à l'inscription) ou null.
// firstMonth = plan du 1er mois payé à l'inscription (firstMonthPlan) ou null.
export default function EnrollmentReceiptPdf({ form, lines, total, dateLabel, registrationFee, firstMonth }) {
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
      <ThermalInfo label="Paiement" value={form.paymentDay ? `le ${form.paymentDay} de chaque mois` : ''} />
      <ThermalSeparator />

      <ThermalLines title="Matières inscrites (prix mensuel)" lines={lines} />
      <ThermalTotal label="Total mensuel" amount={total} />
      <ThermalStatus>{firstMonthStatusLabel(firstMonth, dateLabel)}</ThermalStatus>

      {registrationFee != null && (
        <>
          <ThermalSeparator />
          <ThermalLines title="Frais d'inscription (une seule fois)" lines={[{ name: "Frais d'inscription", amount: registrationFee.due }]} />
          <ThermalStatus>{registrationFeeStatusLabel(registrationFee, dateLabel)}</ThermalStatus>
        </>
      )}
    </ThermalReceipt>
  )
}
