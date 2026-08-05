import { useState, useMemo } from 'react'
import Header from '../shared/Header'
import { cycles, levelsByCycle, subjects, getMatchingGroups, emptyTeacher } from './data/mockTeachers'
import UploadIcon from './ui/UploadIcon'
import Toggle from './ui/Toggle'

export default function TeacherForm({ teacher, onClose, onSave }) {
  const [form, setForm] = useState(teacher ? { ...teacher } : { ...emptyTeacher })

  const set = (field, value) => setForm((current) => ({ ...current, [field]: value }))

  const toggle = (field, value) => {
    set(
      field,
      form[field].includes(value)
        ? form[field].filter((item) => item !== value)
        : [...form[field], value]
    )
  }

  const setRate = (cycle, value) => {
    set('rates', { ...form.rates, [cycle]: value })
  }

  // Get available levels based on selected cycles
  const availableLevels = useMemo(() => {
    const levelSet = new Set()
    form.cycles.forEach(cycle => {
      levelsByCycle[cycle]?.forEach(level => levelSet.add(level))
    })
    return Array.from(levelSet)
  }, [form.cycles])

  // Get matching groups based on selections
  const matchingGroups = useMemo(() => {
    // Since we removed branches, we pass an empty array for branches
    return getMatchingGroups(form.cycles, form.levels, [], form.subjects)
  }, [form.cycles, form.levels, form.subjects])

  const isGroupsVisible = form.cycles.length > 0 && form.levels.length > 0 && form.subjects.length > 0

  const handleSubmit = (event) => {
    event.preventDefault()
    onSave({ ...form, id: teacher?.id || crypto.randomUUID() })
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
              <UploadIcon />
              <span>Photo (drag & drop)</span>
              <input type="file" accept="image/*" />
            </label>
            <div className="teacher-grid">
              <label>Prénom<input value={form.firstName} onChange={(e) => set('firstName', e.target.value)} required /></label>
              <label>Nom<input value={form.lastName} onChange={(e) => set('lastName', e.target.value)} required /></label>
              <label>CIN<input value={form.cin} onChange={(e) => set('cin', e.target.value)} required /></label>
              <label>Téléphone<input type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} required /></label>
            </div>
            <label>Adresse<input value={form.address} onChange={(e) => set('address', e.target.value)} /></label>
            <div className="teacher-date-status">
              <label>Date d'embauche<input type="date" value={form.hiredAt} onChange={(e) => set('hiredAt', e.target.value)} required /></label>
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
              <div className="choice-grid">
                {cycles.map((cycle) => (
                  <label 
                    className={form.cycles.includes(cycle) ? 'is-checked' : ''} 
                    key={cycle}
                  >
                    <input 
                      type="checkbox" 
                      checked={form.cycles.includes(cycle)} 
                      onChange={() => toggle('cycles', cycle)} 
                    />
                    {cycle}
                  </label>
                ))}
              </div>
            </fieldset>

            {/* 2. Niveau(x) scolaire(s) - depends on cycles */}
            <fieldset>
              <legend>Niveau(x) scolaire(s)</legend>
              <div className="choice-grid">
                {availableLevels.map((level) => (
                  <label 
                    className={form.levels.includes(level) ? 'is-checked' : ''} 
                    key={level}
                  >
                    <input 
                      type="checkbox" 
                      checked={form.levels.includes(level)} 
                      onChange={() => toggle('levels', level)} 
                    />
                    {level}
                  </label>
                ))}
              </div>
            </fieldset>


            {/* 4. Matières enseignées */}
            <fieldset>
              <legend>Matières enseignées</legend>
              <div className="choice-grid">
                {subjects.map((subject) => (
                  <label 
                    className={form.subjects.includes(subject) ? 'is-checked' : ''} 
                    key={subject}
                  >
                    <input 
                      type="checkbox" 
                      checked={form.subjects.includes(subject)} 
                      onChange={() => toggle('subjects', subject)} 
                    />
                    {subject}
                  </label>
                ))}
              </div>
            </fieldset>

            {/* 4. Groupes */}
            <fieldset>
              <legend>Groupes</legend>
              {isGroupsVisible ? (
                matchingGroups.length > 0 ? (
                  <div className="groups-grid">
                    {matchingGroups.map((group) => (
                      <label 
                        className={form.groups?.includes(group.id) ? 'is-checked' : ''} 
                        key={group.id}
                      >
                        <div className="group-info">
                          <input 
                            type="checkbox" 
                            checked={form.groups?.includes(group.id) || false} 
                            onChange={() => toggle('groups', group.id)} 
                          />
                          <div>
                            <strong>{group.name}</strong>
                            <span>{group.subject} · {group.level} · {group.studentsCount} élèves</span>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="no-groups">Aucun groupe existant pour cette sélection — vous pourrez en créer un depuis le module Groupes</p>
                )
              ) : (
                <p className="groups-placeholder">Complétez les champs ci-dessus pour voir les groupes disponibles</p>
              )}
            </fieldset>

            {/* 6. Type de rémunération */}
            <fieldset className="payment-type">
              <legend>Type de rémunération</legend>
              <div>
                <button 
                  type="button" 
                  onClick={() => set('paymentType', 'fixe')} 
                  className={form.paymentType === 'fixe' ? 'is-selected' : ''}
                >Fixe</button>
                <button 
                  type="button" 
                  onClick={() => set('paymentType', 'pourcentage')} 
                  className={form.paymentType === 'pourcentage' ? 'is-selected' : ''}
                >Pourcentage</button>
              </div>
            </fieldset>

            {form.paymentType === 'fixe' ? (
              <label className="salary-field">
                Montant mensuel (DH)
                <input type="number" min="0" value={form.salary} onChange={(e) => set('salary', e.target.value)} required />
                <small>{form.salary ? `${Number(form.salary).toLocaleString('fr-FR')} DH` : ''}</small>
              </label>
            ) : (
              <fieldset className="rates">
                <legend>Taux par cycle (%)</legend>
                <div className="rates-grid">
                  {form.cycles.map((cycle) => (
                    <label key={cycle}>
                      <span>{cycle}</span>
                      <span>
                        <input type="number" min="0" max="100" value={form.rates?.[cycle] || ''} onChange={(e) => setRate(cycle, e.target.value)} required />
                        %
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
          </section>
          <footer className="teacher-form-footer">
            <button type="button" onClick={onClose}>Annuler</button>
            <button type="submit">Enregistrer</button>
          </footer>
        </form>
      </main>
    </div>
  )
}