import { getPrice } from '../enrollmentApi'

export default function Step4Billing({ form, catalog }) {
  const amountFor = (subject) => {
    const details = form.subjectDetails?.[subject]
    return details?.priceType === 'manual' ? Number(details.manualPrice || 0) : getPrice(catalog, form.level, subject)
  }
  const total = form.chosen.reduce((acc, subject) => acc + amountFor(subject), 0)
  const studentName = `${form.firstName} ${form.lastName}`.trim() || '—'
  const cursus = [form.cycle, form.level, form.track].filter(Boolean).join(' > ')
  const avatar = studentName === '—' ? '??' : studentName.split(' ').map((name) => name[0]).join('').slice(0, 2)

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
      </article>
    </div>
  </>
}
