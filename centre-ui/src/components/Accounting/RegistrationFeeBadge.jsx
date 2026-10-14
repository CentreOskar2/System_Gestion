// État des frais d'inscription d'un élève dans les tableaux de paiement :
// « Payé », « Reste X DH » (avance versée) ou « Impayé ». Tant qu'il reste
// quelque chose à payer, le badge ouvre la fenêtre d'encaissement.
export default function RegistrationFeeBadge({ fee, onOpen }) {
  if (fee?.status === 'paid') return <span className="registration-badge paid">Payé</span>
  const partial = fee?.status === 'partial'
  return (
    <button
      type="button"
      className={`registration-badge ${partial ? 'partial' : 'unpaid'}`}
      onClick={onOpen}
      title={
        partial
          ? `Avance de ${fee.paidTotal.toLocaleString('fr-FR')} DH versée — encaisser le reste`
          : "Valider le paiement des frais d'inscription"
      }
    >
      {partial ? `Reste ${fee.remaining.toLocaleString('fr-FR')} DH` : 'Impayé'}
    </button>
  )
}
