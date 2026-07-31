import { useState } from 'react'
import Header from '../../shared/Header'
import Step1PersonalDetails from './steps/Step1PersonalDetails'
import Step2Classification from './steps/Step2Classification'
import Step3SubjectsGroups from './steps/Step3SubjectsGroups'
import Step4Billing from './steps/Step4Billing'
import EnrollmentReceipt from '../EnrollmentReceipt'
import '../Enrollment.css'

const STEPS = ['Détails personnels', 'Classification', 'Matières & groupes', 'Facturation']

const createInitialForm = (student) => {
  if (!student) {
    return {
      code: `REG-2026-${1000 + Math.floor(Math.random() * 9000)}`,
      firstName: '',
      lastName: '',
      birthDate: '',
      phone: '',
      phone2: '',
      school: '',
      schoolClass: '',
      address: '',
      alerts: '',
      cycle: 'Lycée',
      level: 'Tronc commun',
      track: '',
      chosen: ['Mathématiques', 'Anglais'],
      subjectDetails: {},
    }
  }

  const [firstName = '', ...restName] = (student.name || '').split(' ')

  return {
    code: student.code || `REG-2026-${1000 + Math.floor(Math.random() * 9000)}`,
    firstName,
    lastName: restName.join(' '),
    birthDate: student.birthDate || '',
    phone: student.phone || '',
    phone2: student.phone2 || '',
    school: student.school || '',
    schoolClass: student.schoolClass || '',
    address: student.address || '',
    alerts: student.alerts || '',
    cycle: student.cycle || 'Lycée',
    level: student.level || 'Tronc commun',
    track: student.track || '',
    chosen: student.chosen || ['Mathématiques', 'Anglais'],
    subjectDetails: student.subjectDetails || {},
  }
}

export default function EnrollmentPage({ close, finish, student, mode = 'create' }) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState(() => createInitialForm(student))
  const [receiptOpen, setReceiptOpen] = useState(false)

  const setFormField = (key, value) => setForm({ ...form, [key]: value })
  
  const toggleSubject = (subject) => {
    setFormField(
      'chosen',
      form.chosen.includes(subject)
        ? form.chosen.filter((item) => item !== subject)
        : [...form.chosen, subject]
    )
  }

  const setSubjectDetails = (subject, details) => {
    setForm({
      ...form,
      subjectDetails: { ...form.subjectDetails, [subject]: { ...form.subjectDetails[subject], ...details } },
    })
  }

  const nextStep = () => setStep(Math.min(STEPS.length, step + 1))
  const prevStep = () => setStep(Math.max(1, step - 1))

  const handleFinish = () => {
    if (mode === 'edit') {
      finish(form)
      return
    }
    setReceiptOpen(true)
  }

  const renderStep = () => {
    switch (step) {
      case 1:
        return <Step1PersonalDetails form={form} set={setFormField} />
      case 2:
        return <Step2Classification form={form} set={setFormField} />
      case 3:
        return <Step3SubjectsGroups form={form} toggleSubject={toggleSubject} setSubjectDetails={setSubjectDetails} />
      case 4:
        return <Step4Billing form={form} />
      default:
        return null
    }
  }

  if (receiptOpen) {
    return <EnrollmentReceipt form={form} close={() => { finish(form); close() }} />
  }

  return (
    <div className="enrollment-page">
      <Header />
      <main className="enrollment-content">
        <div className="enrollment-header">
            <button className="back-button" onClick={close}>← Retour à la liste</button>
          <h1>{mode === 'edit' ? 'Modifier un élève' : 'Nouvelle inscription'}</h1>
            <p>Matricule : <b>{form.code}</b></p>
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
            <footer className="enrollment-footer">
                {step > 1 && <button type="button" onClick={prevStep}>Précédent</button>}
                {step < STEPS.length && <button type="button" onClick={nextStep}>Suivant</button>}
                {step === STEPS.length && (
                  <button type="submit" onClick={handleFinish}>
                    {mode === 'edit' ? 'Enregistrer les modifications' : "Finaliser l'inscription"}
                  </button>
                )}
            </footer>
        </form>
      </main>
    </div>
  )
}
