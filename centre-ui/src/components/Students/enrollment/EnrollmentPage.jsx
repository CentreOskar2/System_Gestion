import { useEffect, useState } from 'react'
import Header from '../../shared/Header'
import Step1PersonalDetails from './steps/Step1PersonalDetails'
import Step2Classification from './steps/Step2Classification'
import Step3SubjectsGroups from './steps/Step3SubjectsGroups'
import Step4Billing from './steps/Step4Billing'
import EnrollmentReceipt from '../EnrollmentReceipt'
import { fetchCatalog, nextRegistrationNumber, createEnrollment, updateEnrollment } from './enrollmentApi'
import '../Enrollment.css'

const STEPS = ['Détails personnels', 'Classification', 'Matières & groupes', 'Facturation']

const today = () => new Date().toISOString().slice(0, 10)

const createInitialForm = (student) => {
  if (!student) {
    return {
      code: '',
      firstName: '',
      lastName: '',
      registrationDate: today(),
      phone: '',
      phone2: '',
      school: '',
      schoolClass: '',
      address: '',
      alerts: '',
      cycle: '',
      level: '',
      track: '',
      chosen: [],
      subjectDetails: {},
      photoUrl: '',
      photoFile: null,
    }
  }

  const [firstName = '', ...restName] = (student.name || '').split(' ')

  return {
    code: student.code || '',
    firstName,
    lastName: restName.join(' '),
    registrationDate: student.registrationDate || '',
    phone: student.phone || '',
    phone2: student.phone2 || '',
    school: student.school || '',
    schoolClass: student.schoolClass || '',
    address: student.address || '',
    alerts: student.alerts || '',
    cycle: student.cycle || '',
    level: student.level || '',
    track: student.track || '',
    chosen: student.chosen || [],
    subjectDetails: student.subjectDetails || {},
    photoUrl: student.photoUrl || '',
    photoFile: null,
    branch_id: student.branch_id,
  }
}

export default function EnrollmentPage({ close, finish, student, mode = 'create', catalog: providedCatalog }) {
  const [catalog, setCatalog] = useState(providedCatalog || null)
  const [step, setStep] = useState(1)
  const [form, setForm] = useState(() => createInitialForm(student))
  const [receiptOpen, setReceiptOpen] = useState(false)
  const [codeReady, setCodeReady] = useState(Boolean(student?.code))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    if (!providedCatalog) {
      fetchCatalog()
        .then((data) => {
          if (active) setCatalog(data)
        })
        .catch((err) => {
          if (active) setError(err.message)
        })
    }
    return () => {
      active = false
    }
  }, [providedCatalog])

  useEffect(() => {
    if (student) return
    let active = true
    nextRegistrationNumber()
      .then((code) => {
        if (!active) return
        setForm((f) => ({ ...f, code }))
        setCodeReady(true)
      })
      .catch(() => {
        if (active) setCodeReady(true)
      })
    return () => {
      active = false
    }
  }, [student])

  const setFormField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  const toggleSubject = (subject) => {
    setForm((prev) => ({
      ...prev,
      chosen: prev.chosen.includes(subject)
        ? prev.chosen.filter((item) => item !== subject)
        : [...prev.chosen, subject],
    }))
  }

  const setSubjectDetails = (subject, details) => {
    setForm((prev) => ({
      ...prev,
      subjectDetails: { ...prev.subjectDetails, [subject]: { ...prev.subjectDetails[subject], ...details } },
    }))
  }

  const nextStep = () => {
    const errors = validateStep(step)
    if (errors.length > 0) {
      setError(errors.join(' '))
      return
    }
    setError(null)
    setStep(Math.min(STEPS.length, step + 1))
  }
  const prevStep = () => {
    setError(null)
    setStep(Math.max(1, step - 1))
  }

  const validateStep = (currentStep) => {
    const errors = []
    if (currentStep === 1) {
      if (!form.firstName.trim()) errors.push('Le prénom est obligatoire.')
      if (!form.lastName.trim()) errors.push('Le nom est obligatoire.')
      if (!form.registrationDate) errors.push("La date d'inscription est obligatoire.")
      if (!form.phone.trim()) errors.push('Le téléphone est obligatoire.')
    }
    if (currentStep === 2) {
      if (!form.cycle) errors.push('Le cycle est obligatoire.')
      if (!form.level) errors.push('Le niveau est obligatoire.')
      if ((catalog.branchesByLevel?.[form.level]?.length || 0) > 0 && !form.track) {
        errors.push('La filière est obligatoire.')
      }
    }
    if (currentStep === 3) {
      if (form.chosen.length === 0) {
        errors.push('Sélectionnez au moins une matière.')
      }
      const unassigned = form.chosen.filter((name) => !form.subjectDetails[name]?.group && !form.subjectDetails[name]?.teacher)
      if (unassigned.length > 0) {
        errors.push(`Groupe ou professeur obligatoire pour : ${unassigned.join(', ')}.`)
      }
    }
    return errors
  }

  const handleFinish = async () => {
    if (saving) return
    setSaving(true)
    setError(null)
    try {
      if (mode === 'edit') {
        await updateEnrollment(student.id, form, catalog, student.status)
        finish({ ...form, id: student.id })
        close()
      } else {
        const result = await createEnrollment(form, catalog)
        if (result.photoUrl) setForm((f) => ({ ...f, photoUrl: result.photoUrl }))
        setReceiptOpen(true)
      }
    } catch (err) {
      setError(err.message || 'Une erreur est survenue')
    } finally {
      setSaving(false)
    }
  }

  const renderStep = () => {
    switch (step) {
      case 1:
        return <Step1PersonalDetails form={form} set={setFormField} />
      case 2:
        return <Step2Classification form={form} set={setFormField} catalog={catalog} />
      case 3:
        return <Step3SubjectsGroups form={form} toggleSubject={toggleSubject} setSubjectDetails={setSubjectDetails} catalog={catalog} />
      case 4:
        return <Step4Billing form={form} catalog={catalog} />
      default:
        return null
    }
  }

  if (receiptOpen) {
    return <EnrollmentReceipt form={form} catalog={catalog} close={() => { finish(form); close() }} />
  }

  if (!catalog || !codeReady) {
    return (
      <div className="enrollment-page">
        <Header />
        <main className="enrollment-content">
          <p>Chargement des données...</p>
        </main>
      </div>
    )
  }

  return (
    <div className="enrollment-page">
      <Header />
      <main className="enrollment-content">
        <div className="enrollment-header">
          <button className="back-button" onClick={close}>← Retour à la liste</button>
          <h1>{mode === 'edit' ? 'Modifier un élève' : 'Nouvelle inscription'}</h1>
          <p>Matricule : <b>{form.code || '…'}</b></p>
        </div>
        <div className="enrollment-steps">
          {STEPS.map((label, index) => (
            <div
              key={label}
              className={step === index + 1 ? 'current' : step > index + 1 ? 'done' : ''}
            >
              <span>{step > index + 1 ? '✓' : index + 1}</span>
              <b>{label}</b>
            </div>
          ))}
        </div>
        <form onSubmit={(e) => e.preventDefault()}>
          <section className="enrollment-card">
            {renderStep()}
          </section>
          {error && <div className="enrollment-error">{error}</div>}
          <footer className="enrollment-footer">
            {step > 1 && <button type="button" onClick={prevStep}>Précédent</button>}
            {step < STEPS.length && <button type="button" onClick={nextStep}>Suivant</button>}
            {step === STEPS.length && (
              <button type="submit" onClick={handleFinish} disabled={saving}>
                {saving ? 'Enregistrement...' : mode === 'edit' ? 'Enregistrer les modifications' : "Finaliser l'inscription"}
              </button>
            )}
          </footer>
        </form>
      </main>
    </div>
  )
}
