import { getPrice } from '../enrollmentApi'
import { monthLabelOf, normalizeMonthKey } from '../../../Accounting/monthUtils'

export default function Step4Billing({ form, catalog, set, registrationFee, schoolYear, editing }) {
  const amountFor = (subject) => {
    const details = form.subjectDetails?.[subject]
    return details?.priceType === 'manual' ? Number(details.manualPrice || 0) : getPrice(catalog, form.level, subject)
  }
  const total = form.chosen.reduce((acc, subject) => acc + amountFor(subject), 0)
  const studentName = `${form.firstName} ${form.lastName}`.trim() || '—'
  const cursus = [form.cycle, form.level, form.track].filter(Boolean).join(' > ')
  const avatar = studentName === '—' ? '??' : studentName.split(' ').map((name) => name[0]).join('').slice(0, 2)
  const showRegistrationFee = !editing && registrationFee != null
  const showFirstMonthChoice = !editing
  const firstMonthLabel = form.registrationDate ? monthLabelOf(normalizeMonthKey(form.registrationDate)) : ''

  return <>
    <h2>Génération de la facture</h2>
    <p>Vérifiez le récapitulatif avant de finaliser.</p>
    <div className="billing-summary">
      <article className="billing-student">
        <small>ÉLÈVE</small>
        <div className="billing-student-name"><span>{avatar}</span><div><strong>{studentName}</strong><em>{form.code}</em></div></div>
        <p>Cursus : <b>{cursus || '—'}</b></p>
      </article>
      <article className="billing-fees">
        <small>DÉTAIL DES FRAIS</small>
        {form.chosen.map((subject) => <p key={subject}><span>{subject}</span><strong>{amountFor(subject).toLocaleString('fr-FR')} DH</strong></p>)}
        <div className="billing-total"><b>Total mensuel</b><strong>{total.toLocaleString('fr-FR')} DH</strong></div>

        {showFirstMonthChoice && (
          <div className="billing-first-month">
            <span>Paiement du 1er mois {firstMonthLabel && <em>({firstMonthLabel})</em>}</span>
            <div className="billing-registration-choice">
              <label className={form.firstMonthPaidNow ? 'active' : ''}>
                <input
                  type="radio"
                  name="first-month-timing"
                  checked={form.firstMonthPaidNow}
                  onChange={() => set('firstMonthPaidNow', true)}
                />
                <span>Payer aujourd'hui</span>
              </label>
              <label className={!form.firstMonthPaidNow ? 'active' : ''}>
                <input
                  type="radio"
                  name="first-month-timing"
                  checked={!form.firstMonthPaidNow}
                  onChange={() => set('firstMonthPaidNow', false)}
                />
                <span>Payer plus tard</span>
              </label>
            </div>
          </div>
        )}

        {showRegistrationFee && (
          <div className="billing-registration">
            <div className="billing-registration-line">
              <span>
                <b>Frais d'inscription</b>
                <em>Une seule fois — année {schoolYear}</em>
              </span>
              <strong>{Number(registrationFee).toLocaleString('fr-FR')} DH</strong>
            </div>
            <div className="billing-registration-choice">
              <label className={form.registrationFeePaidNow ? 'active' : ''}>
                <input
                  type="radio"
                  name="registration-fee-timing"
                  checked={form.registrationFeePaidNow}
                  onChange={() => set('registrationFeePaidNow', true)}
                />
                <span>Payer aujourd'hui</span>
              </label>
              <label className={!form.registrationFeePaidNow ? 'active' : ''}>
                <input
                  type="radio"
                  name="registration-fee-timing"
                  checked={!form.registrationFeePaidNow}
                  onChange={() => set('registrationFeePaidNow', false)}
                />
                <span>Payer plus tard</span>
              </label>
            </div>
          </div>
        )}
      </article>
    </div>
  </>
}
