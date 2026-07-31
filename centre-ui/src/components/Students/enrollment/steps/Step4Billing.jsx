import { price } from '../../utils/studentHelpers'

export default function Step4Billing({ form }) {
  const amountFor = (subject) => {
    const details = form.subjectDetails?.[subject]
    return details?.priceType === 'manual' ? Number(details.manualPrice || 0) : price(subject)
  }
  const total = form.chosen.reduce((acc, subject) => acc + amountFor(subject), 0)

  return (
    <>
      <h2>Facturation</h2>
      <p>
        Résumé de l'inscription pour <b>{`${form.firstName} ${form.lastName}`}</b>.
      </p>
      <div className="enrollment-billing">
        <table>
          <thead>
            <tr>
              <th>Matière</th>
              <th>Prix mensuel</th>
            </tr>
          </thead>
          <tbody>
            {form.chosen.map((subject) => (
              <tr key={subject}>
                <td>{subject}</td>
                <td>{amountFor(subject)}.00 DH</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>Total</td>
              <td>{total}.00 DH</td>
            </tr>
          </tfoot>
        </table>
        <div className="enrollment-payment">
          <h4>Options de paiement</h4>
          <label>
            <input type="radio" name="payment" defaultChecked />
            Paiement sur place
          </label>
          <label>
            <input type="radio" name="payment" />
            Virement bancaire
          </label>
          <label>
            <input type="checkbox" />
            Confirmer le paiement du premier mois
          </label>
        </div>
      </div>
    </>
  )
}
