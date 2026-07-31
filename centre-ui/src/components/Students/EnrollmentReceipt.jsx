import { initials, price } from './utils/studentHelpers'
import './EnrollmentReceipt.css'

const formatDate = (date) => new Intl.DateTimeFormat('fr-MA').format(date)

export default function EnrollmentReceipt({ form, close }) {
  const amountFor = (subject) => {
    const details = form.subjectDetails?.[subject]
    return details?.priceType === 'manual' ? Number(details.manualPrice || 0) : price(subject)
  }
  const total = form.chosen.reduce((sum, subject) => sum + amountFor(subject), 0)

  return (
    <main className="receipt-page">
      <div className="receipt-actions">
        <button type="button" onClick={close}>← Retour aux étudiants</button>
        <button type="button" className="receipt-print" onClick={() => window.print()}>Imprimer</button>
      </div>
      <article className="receipt-document">
        <header className="receipt-header">
          <div className="receipt-brand">
            <img src="/oskar-logo.png" alt="Oskar" />
            <div><strong>Centre Oskar</strong><span>Centre de soutien scolaire — Casablanca</span></div>
          </div>
          <div className="receipt-reference"><span>Reçu d'inscription</span><b>{form.code}</b><small>Date : {formatDate(new Date())}</small></div>
        </header>
        <section className="receipt-student">
          <div className="receipt-avatar">{initials(`${form.firstName} ${form.lastName}`)}</div>
          <div><h1>{form.firstName || 'Élève'} {form.lastName}</h1><p>Niveau : <b>{form.level || '—'}</b></p><p>Cycle : <b>{form.cycle || '—'}</b></p></div>
        </section>
        <section className="receipt-lines">
          <h2>Matières inscrites</h2>
          <div className="receipt-row receipt-row--head"><span>Matière</span><span>Prix mensuel</span></div>
          {form.chosen.map((subject) => <div className="receipt-row" key={subject}><span>{subject}</span><span>{amountFor(subject)} DH</span></div>)}
          <div className="receipt-total"><span>Total mensuel à payer</span><strong>{total} DH</strong></div>
        </section>
        <footer className="receipt-signatures"><span>Signature parent/tuteur</span><span>Signature administration</span></footer>
      </article>
    </main>
  )
}
