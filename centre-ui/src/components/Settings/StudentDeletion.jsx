import { useEffect, useMemo, useState } from 'react'
import { deleteStudentCompletely, searchStudentsForDeletion } from '../Students/enrollment/enrollmentApi'
import './StudentDeletion.css'

// Suppression définitive d'un élève, réservée au super administrateur.
//
// Deux garde-fous contre l'erreur, et notamment contre la confusion entre deux
// homonymes — le centre en compte plusieurs :
//
//   1. la suppression porte sur l'IDENTIFIANT de la ligne choisie, jamais sur
//      un nom. Deux élèves homonymes restent deux lignes distinctes ;
//   2. la confirmation exige de retaper le nom exact. Elle ne sert qu'à forcer
//      un temps d'arrêt : c'est la ligne sélectionnée qui sera supprimée, même
//      si un autre élève porte le même nom.
//
// Le matricule, le niveau et la succursale sont affichés pour que la personne
// sache laquelle des deux lignes elle a sous les yeux.

function ConfirmDialog({ student, onCancel, onConfirm, busy, error }) {
  const [typed, setTyped] = useState('')
  const matches = typed.trim().toLocaleLowerCase('fr') === student.name.toLocaleLowerCase('fr')

  return (
    <div className="settings-dialog-bg" onMouseDown={busy ? undefined : onCancel}>
      <section className="settings-dialog" onMouseDown={(event) => event.stopPropagation()}>
        {!busy && <button className="settings-close" onClick={onCancel}>×</button>}
        <h2>Supprimer définitivement cet élève</h2>

        <div className="delete-target">
          <strong>{student.name}</strong>
          <span>Matricule : {student.code || '—'}</span>
          <span>Niveau : {student.level || '—'}</span>
          <span>Succursale : {student.branch || '—'}</span>
          <span>Inscrit le : {student.registeredAt || '—'}</span>
        </div>

        <p className="delete-warning">
          Cette action supprime l'élève <strong>et tout son historique</strong> : paiements,
          frais d'inscription, notes, absences, groupes et formations. Elle est
          <strong> irréversible</strong>.
        </p>

        <form
          onSubmit={(event) => {
            event.preventDefault()
            if (matches && !busy) onConfirm()
          }}
        >
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
          {error && <div className="settings-error">{error}</div>}
          <footer>
            <button type="button" className="settings-outline" onClick={onCancel} disabled={busy}>
              Annuler
            </button>
            <button type="submit" className="settings-danger-action" disabled={!matches || busy}>
              {busy ? 'Suppression...' : 'Supprimer définitivement'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  )
}

export default function StudentDeletion({ notify }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [target, setTarget] = useState(null)
  const [busy, setBusy] = useState(false)
  const [dialogError, setDialogError] = useState('')

  const trimmed = query.trim()

  // Recherche différée : inutile d'interroger la base à chaque frappe.
  useEffect(() => {
    // Rien à chercher : on ne touche à aucun état ici. L'affichage s'appuie sur
    // `visibleResults`, qui masque déjà les résultats d'une recherche abandonnée.
    if (trimmed.length < 2) return undefined
    let cancelled = false
    const timer = window.setTimeout(() => {
      // L'indicateur passe à vrai au départ réel de la requête, et non dans le
      // corps de l'effet : React déconseille d'y modifier l'état directement.
      if (!cancelled) setSearching(true)
      searchStudentsForDeletion(trimmed)
        .then((rows) => {
          if (!cancelled) {
            setResults(rows)
            setSearchError('')
          }
        })
        .catch((err) => {
          console.error(err)
          if (!cancelled) setSearchError(err.message)
        })
        .finally(() => {
          if (!cancelled) setSearching(false)
        })
    }, 300)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [trimmed])

  // Les résultats d'une recherche abandonnée ne doivent plus s'afficher, sans
  // qu'il faille vider l'état depuis l'effet.
  const visibleResults = useMemo(
    () => (trimmed.length >= 2 ? results : []),
    [trimmed, results]
  )

  // Un nom porté par plusieurs élèves est signalé : la personne doit alors
  // regarder le matricule avant de choisir.
  const duplicatedNames = useMemo(() => {
    const seen = new Map()
    for (const row of visibleResults) {
      const key = row.name.toLocaleLowerCase('fr')
      seen.set(key, (seen.get(key) || 0) + 1)
    }
    return new Set([...seen.entries()].filter(([, count]) => count > 1).map(([name]) => name))
  }, [visibleResults])

  const confirmDelete = async () => {
    if (!target) return
    setBusy(true)
    setDialogError('')
    try {
      await deleteStudentCompletely(target.id)
      setResults((rows) => rows.filter((row) => row.id !== target.id))
      setTarget(null)
      notify?.(`${target.name} a été supprimé définitivement.`, 'success')
    } catch (err) {
      console.error(err)
      setDialogError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="settings-card settings-delete-student">
      <header className="settings-card-head">
        <div>
          <strong>Supprimer un élève</strong>
          <p>
            Recherchez l'élève par nom ou matricule, puis confirmez la suppression.
            L'élève et tout son historique sont effacés définitivement.
          </p>
        </div>
      </header>

      <label className="delete-search">
        Rechercher un élève
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Nom, prénom ou matricule..."
        />
      </label>

      {trimmed.length > 0 && trimmed.length < 2 ? (
        <p className="delete-hint">Saisissez au moins deux caractères.</p>
      ) : searchError ? (
        <div className="settings-error">{searchError}</div>
      ) : searching ? (
        <p className="delete-hint">Recherche en cours...</p>
      ) : trimmed.length >= 2 && visibleResults.length === 0 ? (
        <p className="delete-hint">Aucun élève ne correspond à « {trimmed} ».</p>
      ) : visibleResults.length > 0 ? (
        <>
          {duplicatedNames.size > 0 && (
            <p className="delete-duplicate-warning">
              Plusieurs élèves portent le même nom dans ces résultats. Vérifiez le
              matricule avant de supprimer.
            </p>
          )}
          <ul className="delete-results">
            {visibleResults.map((student) => (
              <li key={student.id} className={duplicatedNames.has(student.name.toLocaleLowerCase('fr')) ? 'is-duplicate' : ''}>
                <div className="delete-result-main">
                  <strong>{student.name}</strong>
                  <span className={student.active ? 'delete-pill on' : 'delete-pill'}>
                    {student.active ? 'Actif' : 'Inactif'}
                  </span>
                </div>
                <div className="delete-result-meta">
                  <span><b>Matricule</b> {student.code || '—'}</span>
                  <span><b>Niveau</b> {student.level || '—'}</span>
                  <span><b>Succursale</b> {student.branch || '—'}</span>
                  <span><b>Inscrit le</b> {student.registeredAt || '—'}</span>
                </div>
                <button
                  className="settings-outline settings-danger-action"
                  onClick={() => {
                    setDialogError('')
                    setTarget(student)
                  }}
                >
                  Supprimer
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {target && (
        <ConfirmDialog
          student={target}
          busy={busy}
          error={dialogError}
          onCancel={() => {
            if (!busy) {
              setTarget(null)
              setDialogError('')
            }
          }}
          onConfirm={confirmDelete}
        />
      )}
    </section>
  )
}
