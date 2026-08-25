import { useEffect, useState } from 'react'
import Icon from '../../Icon'
import { supabase } from '../../../supabaseClient'

const toForm = (group) =>
  group
    ? {
        id: group.id,
        name: group.name || '',
        cycle_id: '',
        level_id: group.level_id || '',
        filiere_id: group.filiere_id || '',
        branch_id: group.branch_id || '',
      }
    : {
        name: '',
        cycle_id: '',
        level_id: '',
        filiere_id: '',
        branch_id: '',
      }

function Toast({ notice }) {
  if (!notice) return null
  return (
    <div className={`group-toast is-${notice.type}`} role="status">
      <span>{notice.type === 'success' ? '✓' : '✕'}</span>
      {notice.text}
    </div>
  )
}

export default function GroupModal({ group, close, save }) {
  const [form, setForm] = useState(() => toForm(group))
  const [cycles, setCycles] = useState([])
  const [levels, setLevels] = useState([])
  const [filieres, setFilieres] = useState([])
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState(null)

  const editing = Boolean(group)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [cyclesRes, levelsRes, filieresRes] = await Promise.all([
        supabase.from('cycles').select('id, name').order('name'),
        supabase.from('levels').select('id, name, cycle_id').order('name'),
        supabase.from('study_branches').select('id, name, level_id').order('name'),
      ])
      if (cancelled) return
      if (cyclesRes.data) setCycles(cyclesRes.data)
      if (levelsRes.data) setLevels(levelsRes.data)
      if (filieresRes.data) setFilieres(filieresRes.data)

      if (group?.level_id) {
        const level = levelsRes.data?.find((l) => l.id === group.level_id)
        if (level) {
          setForm((current) => ({ ...current, cycle_id: level.cycle_id || '' }))
        }
      }
    }
    load()
    return () => { cancelled = true }
  }, [group])

  const availableLevels = form.cycle_id
    ? levels.filter((level) => level.cycle_id === form.cycle_id)
    : []

  const availableFilieres = form.level_id
    ? filieres.filter((filiere) => filiere.level_id === form.level_id)
    : []

  const update = (key, value) => {
    setForm((item) => {
      const next = { ...item, [key]: value }
      if (key === 'cycle_id') next.level_id = ''
      if (key === 'level_id') next.filiere_id = ''
      return next
    })
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setNotice(null)
    try {
      await save({ ...form }, editing)
    } catch (err) {
      setNotice({ type: 'error', text: err.message || 'Une erreur est survenue' })
      setSaving(false)
    }
  }

  return (
    <div className="group-modal-bg" onMouseDown={close}>
      <section
        className="group-modal"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <button className="group-close" onClick={close} type="button" aria-label="Fermer">
          <Icon name="close" />
        </button>
        <h2>{editing ? 'Modifier le groupe' : 'Nouveau groupe'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="group-form-grid">
            <label>
              Nom du groupe *
              <input value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="Ex. Groupe A" required />
            </label>
            <label>
              Cycle *
              <select value={form.cycle_id} onChange={(e) => update('cycle_id', e.target.value)} required>
                <option value="">— Sélectionner cycle —</option>
                {cycles.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <label>
              Niveau *
              <select
                value={form.level_id}
                onChange={(e) => update('level_id', e.target.value)}
                disabled={!form.cycle_id}
                required
              >
                <option value="">— Sélectionner niveau —</option>
                {availableLevels.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <label>
              Filière / Option
              <select
                value={form.filiere_id}
                onChange={(e) => update('filiere_id', e.target.value)}
                disabled={!form.level_id}
              >
                <option value="">— Aucune —</option>
                {availableFilieres.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
          </div>
          <footer>
            <button type="button" onClick={close}>Annuler</button>
            <button type="submit" disabled={saving}>
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </footer>
        </form>
        <Toast notice={notice} />
      </section>
    </div>
  )
}
