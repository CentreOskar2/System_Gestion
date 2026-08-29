import { useEffect, useMemo, useState } from 'react'
import Header from '../shared/Header'
import Icon from '../Icon'
import { supabase } from '../../supabaseClient'
import Toggle from './ui/Toggle'
import { normalizePhoneInput, phoneValidationMessage } from '../../utils/validators'

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
        cycles: teacher.cycle_ids || [],
        levels: teacher.level_ids || [],
        subjects: teacher.subject_ids || [],
        groups: teacher.groups || (teacher.group_assignments || []).map((a) => a.group_id),
        remuneration_type: teacher.paymentType || 'fixe',
        fixed_salary: teacher.fixed_salary ?? teacher.remuneration_amount ?? teacher.salary ?? '',
        cycle_rates: teacher.cycle_rates || teacher.rates || {},
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
        cycles: [],
        levels: [],
        subjects: [],
        groups: [],
        remuneration_type: 'fixe',
        fixed_salary: '',
        cycle_rates: {},
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
  const [cycles, setCycles] = useState([])
  const [levels, setLevels] = useState([])
  const [subjects, setSubjects] = useState([])
  const [availableGroups, setAvailableGroups] = useState([])
  const [groupsLoading, setGroupsLoading] = useState(false)
  const [loadingOptions, setLoadingOptions] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState(null)
  const [phoneError, setPhoneError] = useState('')

  const cycleName = useMemo(() => {
    const map = {}
    for (const cycle of cycles) map[cycle.id] = cycle.name
    return map
  }, [cycles])

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [cyclesRes, levelsRes, subjectsRes] = await Promise.all([
        supabase.from('cycles').select('id, name, has_fixed_price').order('name'),
        supabase.from('levels').select('id, name, cycle_id').order('name'),
        supabase.from('subjects').select('id, name').order('name'),
      ])
      if (cancelled) return
      if (cyclesRes.data) setCycles(cyclesRes.data)
      if (levelsRes.data) setLevels(levelsRes.data)
      if (subjectsRes.data) setSubjects(subjectsRes.data)
      setLoadingOptions(false)
    }
    load()
    return () => { cancelled = true }
  }, [])

  const set = (field, value) => setForm((current) => ({ ...current, [field]: value }))

  const setPhone = (value) => {
    const nextValue = normalizePhoneInput(value)
    set('phone', nextValue)
    if (phoneError) setPhoneError(phoneValidationMessage(nextValue))
  }

  const validatePhone = () => {
    const message = phoneValidationMessage(form.phone)
    setPhoneError(message)
    return !message
  }

  const toggle = (field, value) =>
    setForm((current) => {
      const list = current[field] || []
      return {
        ...current,
        [field]: list.includes(value) ? list.filter((item) => item !== value) : [...list, value],
      }
    })

  const setRate = (cycleId, value) =>
    set('cycle_rates', { ...form.cycle_rates, [cycleId]: value })

  const levelsByCycle = useMemo(() => {
    const grouped = {}
    for (const level of levels) {
      if (!form.cycles.includes(level.cycle_id)) continue
      const cycle = cycleName[level.cycle_id] || 'Autres'
      if (!grouped[cycle]) grouped[cycle] = []
      grouped[cycle].push(level)
    }
    return grouped
  }, [levels, cycleName, form.cycles])

  // Préscolaire et primaire : le professeur enseigne tout le niveau, il n'y a
  // donc pas de matière à cocher — l'affectation s'arrête au groupe.
  const packageCycleIds = useMemo(
    () => new Set(cycles.filter((cycle) => cycle.has_fixed_price).map((cycle) => cycle.id)),
    [cycles]
  )
  const teachesSubjectCycles = form.cycles.some((cycleId) => !packageCycleIds.has(cycleId))

  const canFetchGroups =
    form.cycles.length > 0 &&
    form.levels.length > 0 &&
    (!teachesSubjectCycles || form.subjects.length > 0)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!canFetchGroups) return
      setGroupsLoading(true)
      let query = supabase
        .from('groups')
        .select('id, name, subject_id, level_id, capacity, status, levels(name, cycles(name))')
        .eq('status', 'active')
      if (form.subjects.length > 0) {
        query = query.or(`subject_id.in.(${form.subjects.join(',')}),subject_id.is.null`)
      }
      query = query.or(`level_id.in.(${form.levels.join(',')}),level_id.is.null`)
      const { data, error } = await query
      if (cancelled) return
      if (error) {
        console.error(error)
        setAvailableGroups([])
        setGroupsLoading(false)
        return
      }
      const groupIds = (data || []).map((group) => group.id)
      const countsByGroup = {}
      if (groupIds.length > 0) {
        const { data: rows } = await supabase.from('group_students').select('group_id').in('group_id', groupIds)
        for (const row of rows || []) {
          countsByGroup[row.group_id] = (countsByGroup[row.group_id] || 0) + 1
        }
      }
      if (cancelled) return
      setAvailableGroups(
        (data || []).map((group) => ({
          ...group,
          studentsCount: countsByGroup[group.id] || 0,
        }))
      )
      setGroupsLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [canFetchGroups, form.levels, form.subjects])

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!validatePhone()) return
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
                  <Icon name="upload" />
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
              <label>
                Téléphone
                <input
                  type="tel"
                  inputMode="numeric"
                  value={form.phone}
                  onChange={(e) => setPhone(e.target.value)}
                  onBlur={validatePhone}
                  required
                />
                {phoneError && <small className="phone-error">{phoneError}</small>}
              </label>
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

            {/* 1. Cycle(s) enseigné(s) */}
            <fieldset>
              <legend>Cycle(s) enseigné(s)</legend>
              {loadingOptions ? (
                <p className="teacher-options-loading">Chargement des cycles...</p>
              ) : (
                <div className="choice-grid">
                  {cycles.map((cycle) => (
                    <label className={form.cycles.includes(cycle.id) ? 'is-checked' : ''} key={cycle.id}>
                      <input type="checkbox" checked={form.cycles.includes(cycle.id)} onChange={() => toggle('cycles', cycle.id)} />
                      {cycle.name}
                    </label>
                  ))}
                </div>
              )}
            </fieldset>

            {/* 2. Niveau(x) scolaire(s) */}
            <fieldset>
              <legend>Niveau(x) scolaire(s)</legend>
              {loadingOptions ? (
                <p className="teacher-options-loading">Chargement des niveaux...</p>
              ) : form.cycles.length === 0 ? (
                <p className="groups-placeholder">Sélectionnez d'abord un ou plusieurs cycles.</p>
              ) : (
                Object.entries(levelsByCycle).map(([cycle, cycleLevels]) => (
                  <div className="teacher-level-group" key={cycle}>
                    <strong className="teacher-level-cycle">{cycle}</strong>
                    <div className="choice-grid">
                      {cycleLevels.map((level) => (
                        <label className={form.levels.includes(level.id) ? 'is-checked' : ''} key={level.id}>
                          <input type="checkbox" checked={form.levels.includes(level.id)} onChange={() => toggle('levels', level.id)} />
                          {level.name}
                        </label>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </fieldset>

            {/* 3. Matières enseignées — sans objet sur les cycles au forfait */}
            <fieldset>
              <legend>Matières enseignées</legend>
              {loadingOptions ? (
                <p className="teacher-options-loading">Chargement des matières...</p>
              ) : !teachesSubjectCycles ? (
                <p className="groups-placeholder">
                  {form.cycles.length === 0
                    ? "Sélectionnez d'abord un ou plusieurs cycles."
                    : "Sur ces cycles le professeur enseigne toutes les matières du niveau : il n'y a pas de matière à choisir."}
                </p>
              ) : (
                <div className="choice-grid">
                  {subjects.map((subject) => (
                    <label className={form.subjects.includes(subject.id) ? 'is-checked' : ''} key={subject.id}>
                      <input type="checkbox" checked={form.subjects.includes(subject.id)} onChange={() => toggle('subjects', subject.id)} />
                      {subject.name}
                    </label>
                  ))}
                </div>
              )}
            </fieldset>

            {/* 4. Groupes */}
            <fieldset>
              <legend>Groupes</legend>
              {!canFetchGroups ? (
                <p className="groups-placeholder">
                  {teachesSubjectCycles
                    ? 'Complétez les champs ci-dessus (Cycles, Niveaux, Matières) pour voir les groupes disponibles'
                    : 'Complétez les champs ci-dessus (Cycles, Niveaux) pour voir les groupes disponibles'}
                </p>
              ) : groupsLoading ? (
                <p className="teacher-options-loading">Chargement des groupes...</p>
              ) : availableGroups.length === 0 ? (
                <p className="no-groups">Aucun groupe existant pour cette sélection — vous pourrez en créer un depuis le module Groupes</p>
              ) : (
                <div className="groups-grid">
                  {availableGroups.map((group) => (
                    <label className={form.groups.includes(group.id) ? 'is-checked' : ''} key={group.id}>
                      <div className="group-info">
                        <input type="checkbox" checked={form.groups.includes(group.id)} onChange={() => toggle('groups', group.id)} />
                        <div>
                          <strong>{group.name}</strong>
                          <span>
                            {[group.levels?.cycles?.name, group.levels?.name].filter(Boolean).join(' · ') || 'Groupe'}
                            {group.studentsCount > 0 ? ` · ${group.studentsCount} élève${group.studentsCount > 1 ? 's' : ''}` : ''}
                          </span>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </fieldset>

            {/* 5. Type de rémunération */}
            <fieldset className="payment-type">
              <legend>Type de rémunération</legend>
              <div>
                <button type="button" onClick={() => set('remuneration_type', 'fixe')} className={form.remuneration_type === 'fixe' ? 'is-selected' : ''}>Fixe</button>
                <button type="button" onClick={() => set('remuneration_type', 'pourcentage')} className={form.remuneration_type === 'pourcentage' ? 'is-selected' : ''}>Pourcentage</button>
              </div>
            </fieldset>

            {form.remuneration_type === 'pourcentage' ? (
              form.cycles.length > 1 ? (
                <fieldset className="rates">
                  <legend>Taux par cycle (%)</legend>
                  <div className="rates-grid">
                    {form.cycles.map((cycleId) => (
                      <label key={cycleId}>
                        <span>{cycleName[cycleId] || 'Cycle'}</span>
                        <span>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={form.cycle_rates?.[cycleId] || ''}
                            onChange={(e) => setRate(cycleId, e.target.value)}
                            required
                          />
                          %
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              ) : form.cycles.length === 1 ? (
                <label className="salary-field">
                  Taux (%) — {cycleName[form.cycles[0]] || 'Cycle'}
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={form.cycle_rates?.[form.cycles[0]] || ''}
                    onChange={(e) => setRate(form.cycles[0], e.target.value)}
                    required
                  />
                </label>
              ) : (
                <p className="groups-placeholder">Sélectionnez au moins un cycle pour définir les taux.</p>
              )
            ) : (
              <label className="salary-field">
                Montant mensuel (DH)
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={form.fixed_salary}
                  onChange={(e) => set('fixed_salary', e.target.value)}
                  required
                />
                <small>
                  {form.fixed_salary ? `${Number(form.fixed_salary).toLocaleString('fr-FR')} DH` : ''}
                </small>
              </label>
            )}
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
