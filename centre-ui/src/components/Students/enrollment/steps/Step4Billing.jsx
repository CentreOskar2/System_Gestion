import { getPrice, isPackageLevel, packageAmount } from '../enrollmentApi'
import { formationRowPrice, formationsTotal } from '../../../Formations/formationsApi'
import { monthLabelOf, normalizeMonthKey } from '../../../Accounting/monthUtils'

export default function Step4Billing({ form, catalog, set, registrationFee, schoolYear, editing }) {
  const amountFor = (subject) => {
    const details = form.subjectDetails?.[subject]
    return details?.priceType === 'manual' ? Number(details.manualPrice || 0) : getPrice(catalog, form.level, subject)
  }
  // Au forfait le détail se résume à une ligne : le niveau, toutes matières comprises.
  const formationOnly = Boolean(form.formationOnly)
  const lines = formationOnly
    ? []
    : isPackageLevel(catalog, form.level)
      ? [{ name: `Forfait ${form.level} — toutes matières`, amount: packageAmount(form, catalog) }]
      : form.chosen.map((subject) => ({ name: subject, amount: amountFor(subject) }))
  const total = lines.reduce((acc, line) => acc + line.amount, 0)

  // Les formations sont facturées sur leur propre calendrier : elles sont
  // rappelées ici pour information, mais n'entrent pas dans le total mensuel
  // de la scolarité ni dans le paiement du 1er mois proposé ci-dessous.
  const formationRows = form.formations || []
  const formationTotal = formationsTotal(formationRows)

  const studentName = `${form.firstName} ${form.lastName}`.trim() || '—'
  const cursus = formationOnly
    ? 'Formation seule'
    : [form.cycle, form.level, form.track].filter(Boolean).join(' > ')
  const avatar = studentName === '—' ? '??' : studentName.split(' ').map((name) => name[0]).join('').slice(0, 2)
  const showRegistrationFee = !editing && registrationFee != null
  // Sans scolarité il n'y a pas de dû mensuel : proposer d'encaisser le 1er
  // mois enregistrerait un paiement de 0 DH.
  const showFirstMonthChoice = !editing && !formationOnly
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
        {lines.map((line) => <p key={line.name}><span>{line.name}</span><strong>{line.amount.toLocaleString('fr-FR')} DH</strong></p>)}
        {lines.length === 0 && <p><span>Aucun frais de scolarité</span><strong>0 DH</strong></p>}
        <div className="billing-total"><b>Total mensuel scolarité</b><strong>{total.toLocaleString('fr-FR')} DH</strong></div>

        {formationRows.length > 0 && (
          <div className="billing-formations">
            <small>FORMATIONS — FACTURÉES SÉPARÉMENT</small>
            {formationRows.map((row) => (
              <p key={row.formationLevelId}>
                <span>{row.formationName ? `${row.formationName} · ${row.levelName}` : row.levelName}</span>
                <strong>{formationRowPrice(row).toLocaleString('fr-FR')} DH</strong>
              </p>
            ))}
            <div className="billing-total">
              <b>Total mensuel formations</b>
              <strong>{formationTotal.toLocaleString('fr-FR')} DH</strong>
            </div>
            <em className="billing-formations-note">
              À encaisser depuis Comptabilité &gt; Frais de formation.
            </em>
          </div>
        )}

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
