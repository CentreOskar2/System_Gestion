import { supabase } from '../../supabaseClient'
import { fetchAllRows } from '../../utils/fetchAllRows'
import { accountingDayBucket } from './monthUtils'

// Les frais d'inscription d'une année = un montant DÛ (registration_fees.amount,
// négociable élève par élève) et des VERSEMENTS (registration_fee_payments) :
// l'élève peut verser une avance puis le reste un autre jour. Voir la
// migration 042.
const FEE_COLUMNS =
  'id, student_id, school_year, amount, status, paid_at, validated_by, registration_fee_payments(id, amount, paid_at, paid_by)'

const toAmount = (value) => {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : 0
}

// Complète une ligne avec ses versements triés, le total versé, le reste et un
// statut recalculé d'après les versements (la colonne status n'en est qu'un reflet).
export function withPaymentSummary(row) {
  if (!row) return null
  const payments = (row.registration_fee_payments || row.payments || [])
    .map((payment) => ({ ...payment, amount: toAmount(payment.amount) }))
    .sort((a, b) => String(a.paid_at).localeCompare(String(b.paid_at)))
  const amount = toAmount(row.amount)
  const paidTotal = payments.reduce((sum, payment) => sum + payment.amount, 0)
  // Ancienne ligne marquée payée sans versement enregistré (avant la
  // migration 042) : elle reste soldée.
  const settled =
    (paidTotal >= amount && (paidTotal > 0 || amount === 0)) || (row.status === 'paid' && payments.length === 0)
  const remaining = settled ? 0 : Math.max(0, amount - paidTotal)
  return {
    ...row,
    amount,
    payments,
    paidTotal,
    remaining,
    status: settled ? 'paid' : paidTotal > 0 ? 'partial' : 'unpaid',
  }
}

export async function fetchRegistrationFees(schoolYear) {
  if (!schoolYear) return {}
  const { data, error } = await supabase
    .from('registration_fees')
    .select(FEE_COLUMNS)
    .eq('school_year', schoolYear)

  // Before the registration_fees migration has been applied, behave as if no fee
  // has been recorded yet — every student simply shows as "Impayé".
  if (error) {
    console.error(error)
    return {}
  }
  return Object.fromEntries((data || []).map((row) => [row.student_id, withPaymentSummary(row)]))
}

export async function fetchRegistrationFee(studentId, schoolYear) {
  if (!studentId || !schoolYear) return null
  const { data, error } = await supabase
    .from('registration_fees')
    .select(FEE_COLUMNS)
    .eq('student_id', studentId)
    .eq('school_year', schoolYear)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return withPaymentSummary(data)
}

// Enregistre les frais d'inscription d'un élève pour une année :
//   - dueAmount  : montant dû (modifiable), par défaut celui déjà enregistré ;
//   - paidAmount : somme encaissée maintenant (0 = payer plus tard). Elle est
//     plafonnée au reste à payer.
// Renvoie { fee, paidNow, paidAt } : la ligne à jour et ce versement-ci.
export async function recordRegistrationFeePayment({ studentId, schoolYear, dueAmount, paidAmount = 0, userId = null }) {
  const existing = await fetchRegistrationFee(studentId, schoolYear)

  // Les frais se paient UNE FOIS par élève et par année scolaire. Un élève
  // inscrit d'abord en formation seule, puis rattaché à un cycle, ne doit pas
  // les régler une seconde fois : déjà soldés, ils sont rendus tels quels.
  if (existing?.status === 'paid') return { fee: existing, paidNow: 0, paidAt: null }

  const alreadyPaid = existing?.paidTotal || 0
  const due = dueAmount == null || dueAmount === '' ? existing?.amount || 0 : Number(dueAmount)
  if (!Number.isFinite(due) || due < 0) throw new Error("Le montant des frais d'inscription est invalide.")
  if (due < alreadyPaid) {
    throw new Error(`Le montant dû ne peut pas être inférieur à ce qui est déjà payé (${alreadyPaid.toLocaleString('fr-FR')} DH).`)
  }
  const paidNow = Math.min(toAmount(paidAmount), due - alreadyPaid)

  let feeId = existing?.id
  if (!feeId) {
    const { data, error } = await supabase
      .from('registration_fees')
      .upsert({ student_id: studentId, school_year: schoolYear, amount: due, status: 'unpaid' }, { onConflict: 'student_id,school_year' })
      .select('id')
      .single()
    if (error) throw new Error(error.message)
    feeId = data.id
  }

  let paidAt = null
  if (paidNow > 0) {
    const { data, error } = await supabase
      .from('registration_fee_payments')
      .insert({ registration_fee_id: feeId, student_id: studentId, amount: paidNow, paid_by: userId })
      .select('paid_at')
      .single()
    if (error) throw new Error(error.message)
    paidAt = data.paid_at
  }

  const paidTotal = alreadyPaid + paidNow
  const status = paidTotal >= due ? 'paid' : paidTotal > 0 ? 'partial' : 'unpaid'
  const { error } = await supabase
    .from('registration_fees')
    .update({
      amount: due,
      status,
      paid_at: status === 'paid' ? paidAt || existing?.paid_at || new Date().toISOString() : null,
      validated_by: status === 'paid' ? (paidNow > 0 ? userId : existing?.validated_by || null) : null,
    })
    .eq('id', feeId)
  if (error) throw new Error(error.message)

  return { fee: await fetchRegistrationFee(studentId, schoolYear), paidNow, paidAt }
}

// Versements des frais d'inscription comme encaissements de caisse, pour les
// pages qui les additionnent aux mensualités (tableau de bord, résultat net) :
// chaque versement compte dans le mois où il a été reçu.
export async function fetchRegistrationFeeRevenue() {
  const { data, error } = await fetchAllRows(() =>
    supabase.from('registration_fee_payments').select('id, student_id, amount, paid_at').order('paid_at').order('id')
  )
  if (error) throw new Error(error.message)
  return (data || []).map((payment) => ({
    student_id: payment.student_id,
    amount: toAmount(payment.amount),
    status: 'paid',
    month: `${accountingDayBucket(payment.paid_at).slice(0, 7)}-01`,
  }))
}

// Versements d'une année, au format des encaissements de la caisse journalière.
export function registrationFeeCashPayments(fees, keepStudent = () => true) {
  return Object.values(fees || {})
    .filter((fee) => keepStudent(fee.student_id))
    .flatMap((fee) =>
      (fee.payments || []).map((payment) => ({
        id: `registration-${payment.id}`,
        student_id: fee.student_id,
        amount: payment.amount,
        paid_at: payment.paid_at,
        status: 'paid',
        // Encaisseur du versement, aligné sur le paid_by des mensualités.
        paid_by: payment.paid_by || null,
      }))
    )
}

// Ligne d'état des frais d'inscription sur le reçu d'inscription.
// fee = { due, paidNow, remaining } tel qu'enregistré à l'inscription.
export function registrationFeeStatusLabel(fee, dateLabel) {
  const money = (value) => `${Number(value || 0).toLocaleString('fr-FR')} DH`
  if (fee.remaining > 0 && fee.paidNow > 0) return `Avance de ${money(fee.paidNow)} payée le ${dateLabel}\nReste à payer : ${money(fee.remaining)}`
  if (fee.remaining > 0) return 'En attente de paiement'
  return fee.paidNow > 0 ? `Payé le ${dateLabel}` : 'Déjà réglé'
}
