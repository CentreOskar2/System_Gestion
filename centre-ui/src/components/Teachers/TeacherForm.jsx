import { useState } from 'react'
import Header from '../shared/Header'
import { subjects, branches, emptyTeacher } from './data/mockTeachers'
import UploadIcon from './ui/UploadIcon'
import Toggle from './ui/Toggle'

export default function TeacherForm({ teacher, onClose, onSave }) {
  const [form, setForm] = useState(teacher ? { ...teacher } : emptyTeacher)

  const set = (field, value) => setForm((current) => ({ ...current, [field]: value }))
  
  const toggle = (field, value) => {
    set(
      field,
      form[field].includes(value)
        ? form[field].filter((item) => item !== value)
        : [...form[field], value]
    )
  }

  const setRate = (subject, value) => {
    set('rates', { ...form.rates, [subject]: value })
  }

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
            <fieldset>
              <legend>Matières enseignées</legend>
              <div className="choice-grid">
                {subjects.map((subject) => (
                  <label className={form.subjects.includes(subject) ? 'is-checked' : ''} key={subject}>
                    <input type="checkbox" checked={form.subjects.includes(subject)} onChange={() => toggle('subjects', subject)} />
                    {subject}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend>Succursale(s) d'affectation</legend>
              <div className="choice-grid choice-grid--branches">
                {branches.map((branch) => (
                  <label className={form.branches.includes(branch) ? 'is-checked' : ''} key={branch}>
                    <input type="checkbox" checked={form.branches.includes(branch)} onChange={() => toggle('branches', branch)} />
                    {branch}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset className="payment-type">
              <legend>Type de rémunération</legend>
              <div>
                <button type="button" onClick={() => set('paymentType', 'fixe')} className={form.paymentType === 'fixe' ? 'is-selected' : ''}>Fixe</button>
                <button type="button" onClick={() => set('paymentType', 'pourcentage')} className={form.paymentType === 'pourcentage' ? 'is-selected' : ''}>Pourcentage</button>
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
                <legend>Taux par matière (%)</legend>
                {form.subjects.length ? (
                  form.subjects.map((subject) => (
                    <label key={subject}>
                      <strong>{subject}</strong>
                      <span>
                        <input type="number" min="0" max="100" value={form.rates[subject] || ''} onChange={(e) => setRate(subject, e.target.value)} required />
                        %
                      </span>
                    </label>
                  ))
                ) : (
                  <p>Sélectionnez au moins une matière.</p>
                )}
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
