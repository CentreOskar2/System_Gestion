import { useState } from 'react'
import { initials } from '../Students/utils/studentHelpers'
import { formatFrenchDate, accountingDayBucket } from './monthUtils'
import './RegistrationFeeModal.css'

const money = (value) => `${Number(value || 0).toLocaleString('fr-FR')} DH`

// Encaissement des frais d'inscription, partagé par les pages Frais de
// scolarité et Frais de formation. La secrétaire peut :
//   - ajuster le montant dû (ex. 50 DH au lieu de 100 DH) ;
//   - encaisser tout le reste, ou seulement une avance qu'elle saisit.
// `fee` est la ligne de l'année (withPaymentSummary) ou null si rien n'existe.
export default function RegistrationFeeModal({ name, code, schoolYear, fee, defaultAmount, note, error, saving, onClose, onSubmit }) {
  const alreadyPaid = fee?.paidTotal || 0
  const [dueInput, setDueInput] = useState(String(fee?.amount || defaultAmount || 0))
  const [mode, setMode] = useState('full')
  const [advanceInput, setAdvanceInput] = useState('')

  const due = Number(dueInput)
  const dueValid = dueInput.trim() !== '' && Number.isFinite(due) && due >= alreadyPaid
  const remaining = dueValid ? Math.max(0, due - alreadyPaid) : 0
  const advance = Number(advanceInput)
  const advanceValid = advanceInput.trim() !== '' && Number.isFinite(advance) && advance > 0 && advance <= remaining
  const paidNow = mode === 'full' ? remaining : advanceValid ? advance : 0

  let problem = ''
  if (!dueValid) {
    problem = alreadyPaid > 0
      ? `Le montant ne peut pas être inférieur à ce qui est déjà payé (${money(alreadyPaid)}).`
      : 'Saisissez un montant valide.'
  } else if (remaining <= 0) {
    problem = 'Il ne reste rien à payer.'
  } else if (mode === 'advance' && advanceInput.trim() !== '' && !advanceValid) {
    problem = `L'avance doit être comprise entre 1 et ${money(remaining)}.`
  }
  const canSubmit = !saving && !problem && paidNow > 0

  const submit = (event) => {
    event.preventDefault()
    if (canSubmit) onSubmit({ dueAmount: due, paidAmount: paidNow })
  }

  return (
    <div className="fee-overlay" onMouseDown={() => !saving && onClose()}>
      <form className="payment-modal registration-fee-modal" onMouseDown={(e) => e.stopPropagation()} onSubmit={submit}>
        <button type="button" className="modal-close" onClick={onClose} disabled={saving} aria-label="Fermer">×</button>
        <h2>Frais d'inscription — {schoolYear}</h2>
        <div className="payment-person">
          <i>{initials(name)}</i>
          <span><b>{name}</b><small>{code}</small></span>
        </div>

        <label className="registration-fee-field">
          Montant des frais d'inscription
          <span className="registration-fee-input">
            <input
              type="number"
              min={alreadyPaid}
              step="1"
              inputMode="numeric"
              value={dueInput}
              onChange={(e) => setDueInput(e.target.value)}
              disabled={saving}
            />
            <em>DH</em>
          </span>
          <small>Modifiable : par défaut {money(defaultAmount)}.</small>
        </label>

        {fee?.payments?.length > 0 && (
          <div className="registration-fee-history">
            <b>Déjà payé : {money(alreadyPaid)}</b>
            {fee.payments.map((payment) => (
              <span key={payment.id}>
                {formatFrenchDate(accountingDayBucket(payment.paid_at))} — {money(payment.amount)}
              </span>
            ))}
          </div>
        )}

        <div className="payment-amount">
          <span>Reste à payer</span>
          <strong>{money(remaining)}</strong>
        </div>

        <fieldset className="registration-fee-modes" disabled={saving || remaining <= 0}>
          <label className={mode === 'full' ? 'active' : ''}>
            <input type="radio" name="registration-fee-mode" checked={mode === 'full'} onChange={() => setMode('full')} />
            <span><b>Tout payer</b><small>Encaisser {money(remaining)} maintenant</small></span>
          </label>
          <label className={mode === 'advance' ? 'active' : ''}>
            <input type="radio" name="registration-fee-mode" checked={mode === 'advance'} onChange={() => setMode('advance')} />
            <span><b>Payer une avance</b><small>Le reste sera payé plus tard</small></span>
          </label>
        </fieldset>

        {mode === 'advance' && remaining > 0 && (
          <label className="registration-fee-field">
            Montant payé aujourd'hui
            <span className="registration-fee-input">
              <input
                type="number"
                min="1"
                max={remaining}
                step="1"
                inputMode="numeric"
                value={advanceInput}
                onChange={(e) => setAdvanceInput(e.target.value)}
                disabled={saving}
                autoFocus
              />
              <em>DH</em>
            </span>
            {advanceValid && <small>Restera à payer : {money(remaining - advance)}</small>}
          </label>
        )}

        {note && <p className="registration-fee-note">{note}</p>}
        {(problem || error) && <p className="registration-fee-problem">{problem || error}</p>}

        <button type="submit" className="validate-button" disabled={!canSubmit}>
          {saving ? 'Enregistrement...' : paidNow > 0 ? `Valider le paiement de ${money(paidNow)}` : 'Valider le paiement'}
        </button>
      </form>
    </div>
  )
}
