import { useState } from 'react'
import { deleteStudentCompletely } from '../enrollment/enrollmentApi'
import { invalidateFeesCache } from '../../Accounting/feesApi'
import './DeleteStudentDialog.css'

// Suppression définitive d'un élève depuis la liste des élèves. Mêmes
// garde-fous que dans Paramètres (StudentDeletion.jsx) :
//   1. on supprime l'IDENTIFIANT de la ligne choisie, jamais un nom — deux
//      homonymes restent deux élèves distincts ;
//   2. il faut retaper le nom exact : un temps d'arrêt avant l'irréversible.
// Qui peut supprimer quel élève est décidé par StudentsPage (canDeleteStudent).
export default function DeleteStudentDialog({ student, onCancel, onDeleted }) {
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const matches = typed.trim().toLocaleLowerCase('fr') === student.name.toLocaleLowerCase('fr')

  const confirm = async (event) => {
    event.preventDefault()
    if (!matches || busy) return
    setBusy(true)
    setError('')
    try {
      await deleteStudentCompletely(student.id)
      invalidateFeesCache()
      onDeleted(student)
    } catch (err) {
      console.error(err)
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <div className="student-delete-bg" onMouseDown={busy ? undefined : onCancel}>
      <section className="student-delete-dialog" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        {!busy && <button type="button" className="student-delete-close" onClick={onCancel} aria-label="Fermer">×</button>}
        <h2>Supprimer définitivement cet élève</h2>

        <div className="student-delete-target">
          <strong>{student.name}</strong>
          <span>Matricule : {student.code || '—'}</span>
          <span>Niveau : {[student.cycle, student.level].filter(Boolean).join(' · ') || '—'}</span>
          <span>Succursale : {student.branch || '—'}</span>
          <span>Inscrit le : {student.registrationDate || '—'}</span>
        </div>

        <p className="student-delete-warning">
          Cette action supprime l'élève <strong>et tout son historique</strong> : paiements,
          frais d'inscription, notes, absences, groupes et formations. Elle est
          <strong> irréversible</strong>. Pour un élève qui quitte simplement le centre,
          préférez le bouton « Désactiver ».
        </p>

        <form onSubmit={confirm}>
          <label>
            Pour confirmer, retapez le nom exact de l'élève
            <input
              autoFocus
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              placeholder={student.name}
              disabled={busy}
            />
          </label>
          {error && <p className="student-delete-error">{error}</p>}
          <footer>
            <button type="button" className="student-delete-cancel" onClick={onCancel} disabled={busy}>
              Annuler
            </button>
            <button type="submit" className="student-delete-confirm" disabled={!matches || busy}>
              {busy ? 'Suppression...' : 'Supprimer définitivement'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  )
}
