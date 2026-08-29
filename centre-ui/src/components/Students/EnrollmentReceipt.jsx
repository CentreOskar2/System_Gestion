import { useState } from 'react'
import { initials } from './utils/studentHelpers'
import { getPrice, isPackageLevel, packageAmount } from './enrollment/enrollmentApi'
import { formatFrenchDate } from '../Accounting/monthUtils'
import { safeFilename } from '../../utils/exportToPdf'
import { downloadPdfDocument } from '../pdf/downloadPdf'
import EnrollmentReceiptPdf from '../pdf/EnrollmentReceiptPdf'
import './EnrollmentReceipt.css'

export default function EnrollmentReceipt({ form, close, catalog, registrationFee, registrationFeePaid, firstMonthPaid }) {
  const [isExporting, setIsExporting] = useState(false)
  const amountFor = (subject) => {
    const details = form.subjectDetails?.[subject]
    return details?.priceType === 'manual' ? Number(details.manualPrice || 0) : getPrice(catalog, form.level, subject)
  }
  const lines = isPackageLevel(catalog, form.level)
    ? [{ name: `Forfait ${form.level} — toutes matières`, amount: packageAmount(form, catalog) }]
    : form.chosen.map((subject) => ({ name: subject, amount: amountFor(subject) }))
  const total = lines.reduce((sum, line) => sum + line.amount, 0)
  const dateLabel = formatFrenchDate(form.registrationDate)
  const showFee = registrationFee != null

  const downloadPdf = async () => {
    setIsExporting(true)
    try {
      await downloadPdfDocument(
        <EnrollmentReceiptPdf
          form={form}
          lines={lines}
          total={total}
          dateLabel={dateLabel}
          registrationFee={showFee ? registrationFee : null}
          registrationFeePaid={registrationFeePaid}
          firstMonthPaid={firstMonthPaid}
        />,
        `recu-inscription-${safeFilename(`${form.firstName}-${form.lastName}`)}.pdf`
      )
    } catch (err) {
      console.error(err)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <main className="receipt-page">
      <div className="receipt-actions">
        <button type="button" onClick={close}>← Retour aux étudiants</button>
        <button type="button" className="receipt-print" disabled={isExporting} onClick={downloadPdf}>
          {isExporting ? 'Génération du PDF…' : 'Télécharger le reçu'}
        </button>
      </div>
      <article className="receipt-document">
        <header className="receipt-header">
          <div className="receipt-brand">
            <img src="/oskar-logo.png" alt="Oskar" />
            <div><strong>Centre Oskar</strong><span>Centre de soutien scolaire — Agadir</span></div>
          </div>
          <div className="receipt-reference"><span>Reçu d'inscription</span><b>{form.code}</b><small>Date : {dateLabel}</small></div>
        </header>
        <section className="receipt-student">
          {form.photoUrl ? (
            <img className="receipt-avatar-img" src={form.photoUrl} alt="" />
          ) : (
            <div className="receipt-avatar">{initials(`${form.firstName} ${form.lastName}`)}</div>
          )}
          <div><h1>{form.firstName || 'Élève'} {form.lastName}</h1><p>Niveau : <b>{form.level || '—'}</b></p><p>Cycle : <b>{form.cycle || '—'}</b></p></div>
        </section>
        <section className="receipt-lines">
          <h2>Matières inscrites</h2>
          <div className="receipt-row receipt-row--head"><span>Matière</span><span>Prix mensuel</span></div>
          {lines.map((line) => <div className="receipt-row" key={line.name}><span>{line.name}</span><span>{line.amount} DH</span></div>)}
          <div className="receipt-total"><span>Total mensuel à payer</span><strong>{total} DH</strong></div>
          <p className={firstMonthPaid ? 'receipt-fee-paid' : 'receipt-fee-pending'}>
            {firstMonthPaid ? 'Payé le ' + dateLabel : 'En attente de paiement'}
          </p>
        </section>
        {showFee && (
          <section className="receipt-registration">
            <div className="receipt-row">
              <span>Frais d'inscription <small>(une seule fois)</small></span>
              <span>{Number(registrationFee).toLocaleString('fr-FR')} DH</span>
            </div>
            <p className={registrationFeePaid ? 'receipt-fee-paid' : 'receipt-fee-pending'}>
              {registrationFeePaid ? 'Payé le ' + dateLabel : 'En attente de paiement'}
            </p>
          </section>
        )}
        <footer className="receipt-signatures"><span>Signature parent/tuteur</span><span>Signature administration</span></footer>
      </article>
    </main>
  )
}
