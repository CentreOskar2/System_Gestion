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
  const [loadingOptions, setLoadingOptions] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [subjectsRes, levelsRes, branchesRes] = await Promise.all([
        supabase.from('subjects').select('id, name').order('name'),
        supabase.from('levels').select('id, name, cycles(name)').order('name'),
        supabase.from('branches').select('id, name').order('name'),
      ])
      if (cancelled) return
      if (subjectsRes.data) setSubjects(subjectsRes.data)
      if (levelsRes.data) setLevels(levelsRes.data)
      if (branchesRes.data) setBranches(branchesRes.data)
      setLoadingOptions(false)
    }
    load()
    return () => { cancelled = true }
  }, [])

  const set = (field, value) => setForm((current) => ({ ...current, [field]: value }))

  const toggle = (field, value) => {
    set(
      field,
      form[field].includes(value)
        ? form[field].filter((item) => item !== value)
        : [...form[field], value]
    )
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
