import { useEffect, useState } from 'react'
import Icon from '../../Icon'
import { supabase } from '../../../supabaseClient'
import { fetchFormationCatalog } from '../../Formations/formationsApi'

// Un groupe se rattache soit à la structure académique (cycle → niveau → filière),
// soit à un niveau de formation. Les deux sont exclusifs : c'est le même bouton
// radio qui décide quelles colonnes sont renseignées à l'enregistrement.
const toForm = (group) =>
  group
    ? {
        id: group.id,
        name: group.name || '',
        kind: group.formation_level_id ? 'formation' : 'academic',
        cycle_id: '',
        level_id: group.level_id || '',
        filiere_id: group.filiere_id || '',
        formation_id: '',
        formation_level_id: group.formation_level_id || '',
        branch_id: group.branch_id || '',
      }
    : {
        name: '',
        kind: 'academic',
        cycle_id: '',
        level_id: '',
        filiere_id: '',
        formation_id: '',
        formation_level_id: '',
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
  const [formations, setFormations] = useState([])
  const [formationLevels, setFormationLevels] = useState([])
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

      // Le catalogue des formations peut être absent tant que la migration 031
      // n'a pas été passée : dans ce cas on reste sur le seul mode académique.
      try {
        const catalog = await fetchFormationCatalog()
        if (cancelled) return
        setFormations(catalog.formations)
        setFormationLevels(catalog.levels)
        if (group?.formation_level_id) {
          const current = catalog.levelsById[group.formation_level_id]
          if (current) setForm((item) => ({ ...item, formation_id: current.formation_id }))
        }
      } catch (err) {
        console.error(err)
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

  const availableFormationLevels = form.formation_id
    ? formationLevels.filter((level) => level.formation_id === form.formation_id)
    : []

  const isFormation = form.kind === 'formation'

  const update = (key, value) => {
    setForm((item) => {
      const next = { ...item, [key]: value }
      if (key === 'cycle_id') next.level_id = ''
      if (key === 'level_id') next.filiere_id = ''
      if (key === 'formation_id') next.formation_level_id = ''
      // Changer de nature vide l'autre rattachement : un groupe ne peut pas
      // être à la fois scolaire et de formation.
      if (key === 'kind' && value === 'formation') {
        next.cycle_id = ''
        next.level_id = ''
        next.filiere_id = ''
      }
      if (key === 'kind' && value === 'academic') {
        next.formation_id = ''
        next.formation_level_id = ''
      }
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
              Nature du groupe *
              <select value={form.kind} onChange={(e) => update('kind', e.target.value)}>
                <option value="academic">Scolaire — cycle et niveau</option>
                <option value="formation" disabled={formations.length === 0}>
                  {formations.length === 0 ? 'Formation — aucune formation créée' : 'Formation'}
                </option>
              </select>
            </label>
            {isFormation ? (
              <>
                <label>
                  Formation *
                  <select value={form.formation_id} onChange={(e) => update('formation_id', e.target.value)} required>
                    <option value="">— Sélectionner formation —</option>
                    {formations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </label>
                <label>
                  Niveau de formation *
                  <select
                    value={form.formation_level_id}
                    onChange={(e) => update('formation_level_id', e.target.value)}
                    disabled={!form.formation_id}
                    required
                  >
                    <option value="">— Sélectionner niveau —</option>
                    {availableFormationLevels.map((item) => (
                      <option key={item.id} value={item.id}>{item.name} — {item.price} DH</option>
                    ))}
                  </select>
                </label>
              </>
            ) : (
              <>
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
              </>
            )}
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
