/* eslint-disable no-irregular-whitespace */
import { useCallback, useEffect, useState } from 'react'
import {
  fetchFormationCatalog,
  saveFormation,
  deleteFormation,
  saveFormationLevel,
  deleteFormationLevel,
} from './formationsApi'

const Trash = () => <svg viewBox="0 0 24 24"><path d="M3 6h18" /><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" /><path d="M19 6l-.9 13a2 2 0 0 1-2 1.9H7.9a2 2 0 0 1-2-1.9L5 6" /><path d="M10 11v6M14 11v6" /></svg>
const Pencil = () => <svg viewBox="0 0 24 24"><path d="m4 16.8-.7 3.9 3.9-.7L18.5 8.7 15.3 5.5 4 16.8Z" /><path d="m13.8 7 3.2 3.2" /></svg>

function FormationModal({ formation, onClose, onSave }) {
  const [name, setName] = useState(formation?.name || '')
  const [description, setDescription] = useState(formation?.description || '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    if (!name.trim()) {
      setError('Le nom de la formation est obligatoire.')
      return
    }
    setSaving(true)
    try {
      await onSave({ id: formation?.id, name: name.trim(), description: description.trim() || null })
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="settings-dialog-bg" onMouseDown={onClose}>
      <section className="settings-dialog" onMouseDown={(e) => e.stopPropagation()}>
        <button className="settings-close" onClick={onClose}>×</button>
        <h2>{formation ? 'Modifier la formation' : 'Nouvelle formation'}</h2>
        <form onSubmit={submit}>
          <label>Nom de la formation<input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="ex : English communication" required /></label>
          <label>Description (optionnel)<input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="ex : cours de conversation" /></label>
          {error && <div className="settings-error">{error}</div>}
          <footer>
            <button type="button" className="settings-outline" onClick={onClose}>Annuler</button>
            <button type="submit" className="settings-save" disabled={saving}>{saving ? 'Enregistrement...' : 'Enregistrer'}</button>
          </footer>
        </form>
      </section>
    </div>
  )
}

function LevelModal({ formation, level, onClose, onSave }) {
  const [name, setName] = useState(level?.name || '')
  const [price, setPrice] = useState(level?.price != null ? String(level.price) : '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    const amount = Number(price)
    if (!name.trim()) {
      setError('Le nom du niveau est obligatoire.')
      return
    }
    if (!Number.isFinite(amount) || amount < 0) {
      setError('Le prix doit être un nombre positif.')
      return
    }
    setSaving(true)
    try {
      await onSave({ id: level?.id, formationId: formation.id, name: name.trim(), price: amount, position: level?.position ?? 0 })
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="settings-dialog-bg" onMouseDown={onClose}>
      <section className="settings-dialog" onMouseDown={(e) => e.stopPropagation()}>
        <button className="settings-close" onClick={onClose}>×</button>
        <h2>{level ? 'Modifier le niveau' : `Nouveau niveau — ${formation.name}`}</h2>
        <form onSubmit={submit}>
          <label>Nom du niveau<input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="ex : Débutant" required /></label>
          <label>Prix mensuel (DH)<input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="ex : 250" required /></label>
          {error && <div className="settings-error">{error}</div>}
          <footer>
            <button type="button" className="settings-outline" onClick={onClose}>Annuler</button>
            <button type="submit" className="settings-save" disabled={saving}>{saving ? 'Enregistrement...' : 'Enregistrer'}</button>
          </footer>
        </form>
      </section>
    </div>
  )
}

// `notify` vient de Settings et sa signature est notify(texte, type). Il est
// recréé à chaque rendu du parent : on le garde donc hors des dépendances de
// hooks, sinon le chargement du catalogue repartirait en boucle.
export default function FormationsSettings({ notify }) {
  const [catalog, setCatalog] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [modal, setModal] = useState(null)

  const load = useCallback(async () => {
    try {
      setCatalog(await fetchFormationCatalog())
      setLoadError('')
    } catch (err) {
      console.error(err)
      setLoadError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  // Chargement initial : même forme que les autres écrans, la mise à jour de
  // l'état passe par les callbacks de la promesse et non par le corps de l'effet.
  useEffect(() => {
    let active = true
    fetchFormationCatalog()
      .then((data) => {
        if (active) setCatalog(data)
      })
      .catch((err) => {
        console.error(err)
        if (active) setLoadError(err.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const run = async (action, successText) => {
    try {
      await action()
      await load()
      setModal(null)
      notify?.(successText, 'success')
    } catch (err) {
      console.error(err)
      notify?.(err.message, 'error')
      throw err
    }
  }

  const removeFormation = (formation) => {
    const levelCount = (catalog?.levelsByFormation?.[formation.id] || []).length
    const warning = levelCount > 0
      ? `Supprimer « ${formation.name} » ? Ses ${levelCount} niveau(x), les inscriptions des élèves et les paiements associés seront supprimés.`
      : `Supprimer « ${formation.name} » ?`
    if (!window.confirm(warning)) return
    run(() => deleteFormation(formation.id), 'Formation supprimée').catch(() => {})
  }

  const removeLevel = (level) => {
    if (!window.confirm(`Supprimer le niveau « ${level.name} » ? Les inscriptions et paiements de ce niveau seront supprimés.`)) return
    run(() => deleteFormationLevel(level.id), 'Niveau supprimé').catch(() => {})
  }

  if (loading) return <div className="settings-card"><div className="settings-empty">Chargement des formations...</div></div>
  if (loadError) {
    return (
      <div className="settings-card">
        <div className="settings-error">
          Impossible de charger les formations : {loadError}
          <br />
          La migration 031_formations.sql a-t-elle été exécutée dans Supabase ?
        </div>
      </div>
    )
  }

  const formations = catalog?.formations || []

  return (
    <section className="settings-card settings-academic">
      <header className="settings-card-head">
        <div>
          <strong>Formations</strong>
          <p>Hors structure académique : un élève peut suivre une formation en plus de son cycle, ou une formation seule.</p>
        </div>
        <button className="settings-outline" onClick={() => setModal({ kind: 'formation' })}>＋　Ajouter une formation</button>
      </header>

      {formations.length === 0 ? (
        <div className="settings-empty">Aucune formation. Commencez par en créer une.</div>
      ) : (
        <div className="academic-list">
          {formations.map((formation) => {
            const levels = catalog.levelsByFormation[formation.id] || []
            return (
              <article className="academic-card" key={formation.id}>
                <header className="academic-card__head">
                  <div className="academic-card__title">
                    <strong>{formation.name}</strong>
                    <span>{levels.length} niveau(x){formation.description ? ` · ${formation.description}` : ''}</span>
                  </div>
                  <div className="academic-card__actions">
                    <button className="settings-icon-btn" onClick={() => setModal({ kind: 'formation', formation })} aria-label="Modifier la formation"><Pencil /></button>
                    <button className="settings-icon-btn is-danger" onClick={() => removeFormation(formation)} aria-label="Supprimer la formation"><Trash /></button>
                  </div>
                </header>

                <div className="academic-levels">
                  {levels.map((level) => (
                    <div className="level-row" key={level.id}>
                      <div className="level-row__head">
                        <strong>{level.name}</strong>
                        <div className="academic-card__actions">
                          <button className="settings-icon-btn" onClick={() => setModal({ kind: 'level', formation, level })} aria-label={`Modifier le niveau ${level.name}`}><Pencil /></button>
                          <button className="settings-icon-btn is-danger" onClick={() => removeLevel(level)} aria-label={`Supprimer le niveau ${level.name}`}><Trash /></button>
                        </div>
                      </div>
                      <label className="level-fixed-price">
                        <span>Prix du niveau</span>
                        <input type="number" value={level.price} readOnly tabIndex={-1} aria-label={`Prix de ${level.name}`} />
                        <b>DH / mois</b>
                      </label>
                      <div className="branch-chips">
                        {(catalog.groupsByLevel[level.id] || []).map((group) => (
                          <span className="branch-chip" key={group.id}>{group.name}</span>
                        ))}
                        {(catalog.groupsByLevel[level.id] || []).length === 0 && (
                          <span className="branch-empty">Aucun groupe — créez-le depuis la page Groupes</span>
                        )}
                      </div>
                    </div>
                  ))}
                  {levels.length === 0 && <div className="settings-empty">Aucun niveau pour cette formation.</div>}
                  <button className="settings-outline settings-level-add" onClick={() => setModal({ kind: 'level', formation })}>＋　Ajouter un niveau</button>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {modal?.kind === 'formation' && (
        <FormationModal
          formation={modal.formation}
          onClose={() => setModal(null)}
          onSave={(payload) => run(() => saveFormation(payload), modal.formation ? 'Formation modifiée' : 'Formation créée')}
        />
      )}
      {modal?.kind === 'level' && (
        <LevelModal
          formation={modal.formation}
          level={modal.level}
          onClose={() => setModal(null)}
          onSave={(payload) => run(() => saveFormationLevel(payload), modal.level ? 'Niveau modifié' : 'Niveau créé')}
        />
      )}
    </section>
  )
}
