import { useEffect, useState } from 'react'
import Header from '../shared/Header'
import { supabase } from '../../supabaseClient'
import UploadIcon from './ui/UploadIcon'
import Toggle from './ui/Toggle'

const toForm = (teacher) =>
  teacher
    ? {
        id: teacher.id,
        first_name: teacher.firstName || '',
        last_name: teacher.lastName || '',
        cin: teacher.cin || '',
        phone: teacher.phone || '',
        address: teacher.address || '',
        hire_date: teacher.hiredAt || '',
        photo_url: teacher.photoUrl || '',
        active: teacher.active,
        remuneration_type: teacher.paymentType || 'fixe',
        remuneration_amount: teacher.remuneration_amount ?? teacher.salary ?? '',
        subject_ids: teacher.subject_ids || [],
        branch_ids: teacher.branch_ids || [],
        level_ids: teacher.level_ids || [],
        group_assignments: teacher.group_assignments || [],
        group_cycle_id: teacher.group_cycle_id || '',
        group_level_id: teacher.group_level_id || '',
        group_filiere_id: teacher.group_filiere_id || '',
        photoFile: null,
      }
    : {
        first_name: '',
        last_name: '',
        cin: '',
        phone: '',
        address: '',
        hire_date: '',
        photo_url: '',
        active: true,
        remuneration_type: 'fixe',
        remuneration_amount: '',
        subject_ids: [],
        branch_ids: [],
        level_ids: [],
        group_assignments: [],
        group_cycle_id: '',
        group_level_id: '',
        group_filiere_id: '',
        photoFile: null,
      }

function Toast({ notice }) {
  if (!notice) return null
  return (
    <div className={`teacher-toast is-${notice.type}`} role="status">
      <span>{notice.type === 'success' ? '✓' : '✕'}</span>
      {notice.text}
    </div>
  )
}

export default function TeacherForm({ teacher, onClose, onSave }) {
  const [form, setForm] = useState(() => toForm(teacher))
  const [subjects, setSubjects] = useState([])
  const [levels, setLevels] = useState([])
  const [branches, setBranches] = useState([])
  const [cycles, setCycles] = useState([])
  const [groups, setGroups] = useState([])
  const [filieres, setFilieres] = useState([])
  const [loadingOptions, setLoadingOptions] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [subjectsRes, levelsRes, branchesRes, cyclesRes, groupsRes, filieresRes] = await Promise.all([
        supabase.from('subjects').select('id, name').order('name'),
        supabase.from('levels').select('id, name, cycle_id, cycles(name)').order('name'),
        supabase.from('branches').select('id, name').order('name'),
        supabase.from('cycles').select('id, name').order('name'),
        supabase.from('groups').select('id, name, subject_id, level_id, filiere_id, capacity, status').order('name'),
        supabase.from('study_branches').select('id, name, level_id').order('name'),
      ])
      if (cancelled) return
      if (subjectsRes.data) setSubjects(subjectsRes.data)
      if (levelsRes.data) setLevels(levelsRes.data)
      if (branchesRes.data) setBranches(branchesRes.data)
      if (cyclesRes.data) setCycles(cyclesRes.data)
      if (groupsRes.data) setGroups(groupsRes.data.filter((g) => g.status === 'active'))
      if (filieresRes.data) setFilieres(filieresRes.data)

      const existingAssignments = teacher?.group_assignments || []
      if (existingAssignments.length > 0) {
        const firstGroup = groupsRes.data?.find((g) => g.id === existingAssignments[0].group_id)
        const firstLevel = levelsRes.data?.find((l) => l.id === firstGroup?.level_id)
        if (firstLevel) {
          setForm((current) => ({
            ...current,
            group_cycle_id: firstLevel.cycle_id || '',
            group_level_id: firstLevel.id,
            group_filiere_id: firstGroup?.filiere_id || '',
          }))
        }
      }
      setLoadingOptions(false)
    }
    load()
    return () => { cancelled = true }
  }, [teacher])

  const set = (field, value) => setForm((current) => ({ ...current, [field]: value }))

  const toggle = (field, value) => {
    setForm((current) => {
      const list = current[field] || []
      const nextValue = list.includes(value)
        ? list.filter((item) => item !== value)
        : [...list, value]
      const next = { ...current, [field]: nextValue }
      if (field === 'subject_ids') {
        next.group_assignments = (current.group_assignments || []).map((assignment) => ({
          ...assignment,
          subject_ids: [...nextValue],
        }))
      }
      return next
    })
  }

  const cascadeLevels = form.group_cycle_id
    ? levels.filter((level) => level.cycle_id === form.group_cycle_id)
    : []

  const cascadeFilieres = form.group_level_id
    ? filieres.filter((filiere) => filiere.level_id === form.group_level_id)
    : []

  const availableGroups = form.group_level_id
    ? groups.filter(
        (group) =>
          group.level_id === form.group_level_id &&
          (!form.group_filiere_id || group.filiere_id === form.group_filiere_id)
      )
    : []

  const toggleGroupAssignment = (groupId) => {
    setForm((current) => {
      const assigned = (current.group_assignments || []).some((a) => a.group_id === groupId)
      return {
        ...current,
        group_assignments: assigned
          ? current.group_assignments.filter((a) => a.group_id !== groupId)
          : [...current.group_assignments, { group_id: groupId, subject_ids: [...(current.subject_ids || [])] }],
      }
    })
  }

  const levelsByCycle = (() => {
    const groups = {}
    for (const level of levels) {
      const cycleName = level.cycles?.name || 'Autres'
      if (!groups[cycleName]) groups[cycleName] = []
      groups[cycleName].push(level)
    }
    return groups
  })()

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setNotice(null)
    try {
      await onSave({ ...form }, Boolean(teacher))
    } catch (err) {
      setNotice({ type: 'error', text: err.message || 'Une erreur est survenue' })
      setSaving(false)
    }
  }

  const editing = Boolean(teacher)
  const amountLabel = form.remuneration_type === 'fixe' ? 'Montant mensuel (DH)' : 'Pourcentage (%)'

  return (
    <div className="teacher-form-page">
      <Header />
      <main className="teacher-form-content">
        <div className="teacher-form-heading">
          <button className="back-button" onClick={onClose}>← Retour à la liste</button>
          <h1>{editing ? 'Modifier le professeur' : 'Nouveau professeur'}</h1>
          <p>Renseignez les informations personnelles et professionnelles.</p>
        </div>
        <form onSubmit={handleSubmit}>
          <section className="teacher-card">
            <h2>Informations personnelles</h2>
            <label className="photo-drop">
              {form.photoFile || form.photo_url ? (
                <img
                  className="photo-drop-preview"
                  src={form.photoFile ? URL.createObjectURL(form.photoFile) : form.photo_url}
                  alt="Photo du professeur"
                />
              ) : (
                <>
                  <UploadIcon />
                  <span>Photo (drag & drop)</span>
                </>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={(e) => set('photoFile', e.target.files?.[0] || null)}
              />
            </label>
            <div className="teacher-grid">
              <label>Prénom<input value={form.first_name} onChange={(e) => set('first_name', e.target.value)} required /></label>
              <label>Nom<input value={form.last_name} onChange={(e) => set('last_name', e.target.value)} required /></label>
              <label>CIN<input value={form.cin} onChange={(e) => set('cin', e.target.value)} required /></label>
              <label>Téléphone<input type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} required /></label>
            </div>
            <label>Adresse<input value={form.address} onChange={(e) => set('address', e.target.value)} /></label>
            <div className="teacher-date-status">
              <label>Date d'embauche<input type="date" value={form.hire_date} onChange={(e) => set('hire_date', e.target.value)} required /></label>
              <div className="teacher-active">
                <Toggle checked={form.active} onChange={(value) => set('active', value)} />
                <span>Actif</span>
              </div>
            </div>
          </section>
          <section className="teacher-card">
            <h2>Informations professionnelles</h2>
            <fieldset>
              <legend>Matières enseignées</legend>
              {loadingOptions ? (
                <p className="teacher-options-loading">Chargement des matières...</p>
              ) : (
                <div className="choice-grid">
                  {subjects.map((subject) => (
                    <label className={form.subject_ids.includes(subject.id) ? 'is-checked' : ''} key={subject.id}>
                      <input type="checkbox" checked={form.subject_ids.includes(subject.id)} onChange={() => toggle('subject_ids', subject.id)} />
                      {subject.name}
                    </label>
                  ))}
                </div>
              )}
            </fieldset>
            <fieldset>
              <legend>Niveaux enseignés</legend>
              {loadingOptions ? (
                <p className="teacher-options-loading">Chargement des niveaux...</p>
              ) : Object.keys(levelsByCycle).length === 0 ? (
                <p className="teacher-options-loading">Aucun niveau disponible.</p>
              ) : (
                Object.entries(levelsByCycle).map(([cycleName, cycleLevels]) => (
                  <div className="teacher-level-group" key={cycleName}>
                    <strong className="teacher-level-cycle">{cycleName}</strong>
                    <div className="choice-grid">
                      {cycleLevels.map((level) => (
                        <label className={form.level_ids.includes(level.id) ? 'is-checked' : ''} key={level.id}>
                          <input type="checkbox" checked={form.level_ids.includes(level.id)} onChange={() => toggle('level_ids', level.id)} />
                          {level.name}
                        </label>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </fieldset>
            <fieldset>
              <legend>Succursale(s) d'affectation</legend>
              {loadingOptions ? (
                <p className="teacher-options-loading">Chargement des succursales...</p>
              ) : (
                <div className="choice-grid choice-grid--branches">
                  {branches.map((branch) => (
                    <label className={form.branch_ids.includes(branch.id) ? 'is-checked' : ''} key={branch.id}>
                      <input type="checkbox" checked={form.branch_ids.includes(branch.id)} onChange={() => toggle('branch_ids', branch.id)} />
                      {branch.name}
                    </label>
                  ))}
                </div>
              )}
            </fieldset>
            <fieldset>
              <legend>Groupes &amp; matières enseignées</legend>
              {loadingOptions ? (
                <p className="teacher-options-loading">Chargement des groupes...</p>
              ) : (
                <>
                  <div className="teacher-cascade">
                    <label>Cycle
                      <select
                        value={form.group_cycle_id}
                        onChange={(e) => {
                          set('group_cycle_id', e.target.value)
                          set('group_level_id', '')
                          set('group_filiere_id', '')
                        }}
                      >
                        <option value="">— Sélectionner cycle —</option>
                        {cycles.map((cycle) => (
                          <option key={cycle.id} value={cycle.id}>{cycle.name}</option>
                        ))}
                      </select>
                    </label>
                    <label>Niveau
                      <select
                        value={form.group_level_id}
                        onChange={(e) => {
                          set('group_level_id', e.target.value)
                          set('group_filiere_id', '')
                        }}
                        disabled={!form.group_cycle_id}
                      >
                        <option value="">— Sélectionner niveau —</option>
                        {cascadeLevels.map((level) => (
                          <option key={level.id} value={level.id}>{level.name}</option>
                        ))}
                      </select>
                    </label>
                    <label>Filière / Option
                      <select
                        value={form.group_filiere_id}
                        onChange={(e) => set('group_filiere_id', e.target.value)}
                        disabled={!form.group_level_id}
                      >
                        <option value="">— Aucune —</option>
                        {cascadeFilieres.map((filiere) => (
                          <option key={filiere.id} value={filiere.id}>{filiere.name}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  {!form.group_level_id ? (
                    <p className="teacher-options-loading">Sélectionnez un cycle puis un niveau pour afficher les groupes.</p>
                  ) : availableGroups.length === 0 ? (
                    <p className="teacher-options-loading">Aucun groupe disponible pour cette filière.</p>
                  ) : (
                    <div className="teacher-groups-assign">
                      {availableGroups.map((group) => {
                        const assignment = form.group_assignments.find((a) => a.group_id === group.id)
                        const selected = Boolean(assignment)
                        return (
                          <div className={`teacher-assign-group ${selected ? 'is-checked' : ''}`} key={group.id}>
                            <label className="teacher-assign-group-head">
                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={() => toggleGroupAssignment(group.id)}
                              />
                              <span>
                                <b>{group.name}</b>
                                <small>{group.capacity ? `Capacité : ${group.capacity}` : 'Groupe'}</small>
                              </span>
                            </label>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </>
              )}
            </fieldset>
            <fieldset className="payment-type">
              <legend>Type de rémunération</legend>
              <div>
                <button type="button" onClick={() => set('remuneration_type', 'fixe')} className={form.remuneration_type === 'fixe' ? 'is-selected' : ''}>Fixe</button>
                <button type="button" onClick={() => set('remuneration_type', 'pourcentage')} className={form.remuneration_type === 'pourcentage' ? 'is-selected' : ''}>Pourcentage</button>
              </div>
            </fieldset>
            <label className="salary-field">
              {amountLabel}
              <input
                type="number"
                min="0"
                step="any"
                {...(form.remuneration_type === 'pourcentage' ? { max: 100 } : {})}
                value={form.remuneration_amount}
                onChange={(e) => set('remuneration_amount', e.target.value)}
                required
              />
              <small>
                {form.remuneration_type === 'fixe' && form.remuneration_amount
                  ? `${Number(form.remuneration_amount).toLocaleString('fr-FR')} DH`
                  : ''}
              </small>
            </label>
          </section>
          <footer className="teacher-form-footer">
            <Toast notice={notice} />
            <button type="button" onClick={onClose}>Annuler</button>
            <button type="submit" disabled={saving}>
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </footer>
        </form>
      </main>
    </div>
  )
}
