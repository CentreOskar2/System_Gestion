import { useEffect, useState } from 'react'
import Header from '../../shared/Header'
import Step1PersonalDetails from './steps/Step1PersonalDetails'
import Step2Classification from './steps/Step2Classification'
import Step3SubjectsGroups from './steps/Step3SubjectsGroups'
import Step4Billing from './steps/Step4Billing'
import EnrollmentReceipt from '../EnrollmentReceipt'
import { fetchCatalog, nextRegistrationNumber, createEnrollment, updateEnrollment, teacherForGroupSubject, computeDuMois, isPackageLevel } from './enrollmentApi'
import { today } from '../utils/studentHelpers'
import { isValidPhoneNumber, normalizePhoneInput, phoneValidationMessage } from '../../../utils/validators'
import { fetchAppSettings } from '../../../appSettings'
import { recordRegistrationFee } from '../../Accounting/registrationFeesApi'
import { recordFirstMonthPayment, invalidateFeesCache } from '../../Accounting/feesApi'
import { normalizeMonthKey } from '../../Accounting/monthUtils'
import { useAuth } from '../../../context/AuthContext'
import '../Enrollment.css'

const STEPS = ['Détails personnels', 'Classification', 'Matières & groupes', 'Facturation']

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
      filiere: '',
      track: '',
      chosen: [],
      subjectDetails: {},
      groupSelections: [],
      packagePriceType: 'standard',
      packageManualPrice: '',
      photoUrl: '',
      photoFile: null,
      registrationFeePaidNow: true,
      firstMonthPaidNow: true,
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
    filiere: student.track || '',
    track: student.track || '',
    chosen: student.chosen || [],
    subjectDetails: student.subjectDetails || {},
    groupSelections: student.groupSelections || [],
    // Au forfait, un dû mensuel différent du prix du niveau est une remise
    // accordée à cet élève : on la restitue telle quelle en modification.
    packagePriceType:
      student.isPackage && Number(student.du_mois) > 0 && Number(student.du_mois) !== Number(student.packagePrice)
        ? 'manual'
        : 'standard',
    packageManualPrice:
      student.isPackage && Number(student.du_mois) > 0 && Number(student.du_mois) !== Number(student.packagePrice)
        ? String(student.du_mois)
        : '',
    photoUrl: student.photoUrl || '',
    photoFile: null,
    branch_id: student.branch_id,
    registrationFeePaidNow: true,
    firstMonthPaidNow: true,
  }
}

export default function EnrollmentPage({ close, finish, student, mode = 'create', catalog: providedCatalog }) {
  const { user } = useAuth()
  const [catalog, setCatalog] = useState(providedCatalog || null)
  const [step, setStep] = useState(1)
  const [form, setForm] = useState(() => createInitialForm(student))
  const [appSettings, setAppSettings] = useState(null)
  const [receiptOpen, setReceiptOpen] = useState(false)
  const [codeReady, setCodeReady] = useState(!student || Boolean(student?.code))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({ phone: '', phone2: '' })

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
    let active = true
    fetchAppSettings()
      .then((settings) => {
        if (active) setAppSettings(settings)
      })
      .catch((err) => {
        if (active) setError(err.message)
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (student?.code) return
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

  const setPhoneField = (field, value) => setForm((prev) => ({ ...prev, [field]: normalizePhoneInput(value) }))

  const validatePhoneField = (field, value, required = true) => {
    const hasValue = String(value || '').trim().length > 0
    const nextError = required || hasValue ? phoneValidationMessage(value) : ''
    setFieldErrors((prev) => ({ ...prev, [field]: nextError }))
    return !nextError
  }

  const setSubjectDetails = (subject, details) => {
    setForm((prev) => ({
      ...prev,
      subjectDetails: { ...prev.subjectDetails, [subject]: { ...prev.subjectDetails[subject], ...details } },
    }))
  }

  const deriveFromGroups = (prev, groupSelections) => {
    const chosen = []
    const subjectDetails = { ...(prev.subjectDetails || {}) }
    for (const sel of groupSelections) {
      for (const name of sel.subjectNames) {
        if (!chosen.includes(name)) chosen.push(name)
        if (!subjectDetails[name]?.group) {
          subjectDetails[name] = {
            ...(subjectDetails[name] || {}),
            group: sel.groupName,
            teacher: teacherForGroupSubject(catalog, sel.groupId, name),
          }
        }
      }
    }
    for (const name of Object.keys(subjectDetails)) {
      if (!chosen.includes(name)) delete subjectDetails[name]
    }
    return { chosen, subjectDetails }
  }

  const resetGroups = () => {
    setForm((prev) => ({ ...prev, groupSelections: [], chosen: [], subjectDetails: {} }))
  }

  const toggleGroup = (group) => {
    setForm((prev) => {
      const entry = { groupId: group.id, groupName: group.name, subjectIds: [], subjectNames: [] }
      // Au forfait, l'élève appartient à une seule classe : le choix remplace
      // le précédent au lieu de s'y ajouter.
      if (isPackageLevel(catalog, prev.level)) {
        const already = (prev.groupSelections || []).some((sel) => sel.groupId === group.id)
        const groupSelections = already ? [] : [entry]
        return { ...prev, groupSelections, ...deriveFromGroups(prev, groupSelections) }
      }
      const groupSelections = [...(prev.groupSelections || [])]
      const index = groupSelections.findIndex((sel) => sel.groupId === group.id)
      if (index >= 0) {
        groupSelections.splice(index, 1)
      } else {
        groupSelections.push(entry)
      }
      return { ...prev, groupSelections, ...deriveFromGroups(prev, groupSelections) }
    })
  }

  const toggleGroupSubject = (group, subject) => {
    setForm((prev) => {
      const groupSelections = (prev.groupSelections || []).map((sel) => {
        if (sel.groupId !== group.id) return sel
        const added = !sel.subjectNames.includes(subject.name)
        return {
          ...sel,
          subjectIds: added ? [...sel.subjectIds, subject.id] : sel.subjectIds.filter((id) => id !== subject.id),
          subjectNames: added ? [...sel.subjectNames, subject.name] : sel.subjectNames.filter((name) => name !== subject.name),
        }
      })
      return { ...prev, groupSelections, ...deriveFromGroups(prev, groupSelections) }
    })
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
      if (!isValidPhoneNumber(form.phone)) errors.push('Le numéro doit contenir exactement 10 chiffres.')
      if (form.phone2.trim() && !isValidPhoneNumber(form.phone2)) errors.push('Le numéro doit contenir exactement 10 chiffres.')
      setFieldErrors({
        phone: isValidPhoneNumber(form.phone) ? '' : phoneValidationMessage(form.phone),
        phone2: form.phone2.trim() && !isValidPhoneNumber(form.phone2) ? phoneValidationMessage(form.phone2) : '',
      })
    }
    if (currentStep === 2) {
      if (!form.cycle) errors.push('Le cycle est obligatoire.')
      if (!form.level) errors.push('Le niveau est obligatoire.')
      if ((catalog.branchesByLevel?.[form.level]?.length || 0) > 0 && !form.track) {
        errors.push('La filière est obligatoire.')
      }
    }
    if (currentStep === 3) {
      if (isPackageLevel(catalog, form.level)) {
        // Aucune matière à valider : le forfait couvre tout le niveau.
        if ((form.groupSelections || []).length === 0) {
          errors.push("Sélectionnez le groupe de l'élève.")
        }
        if (computeDuMois(form, catalog) <= 0) {
          errors.push(`Aucun prix n'est défini pour ${form.level}. Renseignez-le dans Réglages > Structure académique.`)
        }
      } else {
        if (form.chosen.length === 0) {
          errors.push('Sélectionnez au moins un groupe et une matière.')
        }
        const unassigned = form.chosen.filter((name) => !form.subjectDetails[name]?.group)
        if (unassigned.length > 0) {
          errors.push(`Groupe obligatoire pour : ${unassigned.join(', ')}.`)
        }
      }
    }
    return errors
  }

  const handleFinish = async () => {
    if (saving) return
    if (validateStep(1).length > 0) return
    setSaving(true)
    setError(null)
    try {
      if (mode === 'edit') {
        await updateEnrollment(student.id, form, catalog, student.status)
        finish({ ...form, id: student.id })
        close()
      } else {
        const result = await createEnrollment(form, catalog)
        if (appSettings) {
          await recordRegistrationFee({
            studentId: result.id,
            schoolYear: appSettings.activeSchoolYear,
            amount: appSettings.registrationFee,
            paid: form.registrationFeePaidNow,
            userId: user?.id || null,
          })
        }
        if (form.firstMonthPaidNow) {
          await recordFirstMonthPayment({
            studentId: result.id,
            month: normalizeMonthKey(form.registrationDate),
            amount: computeDuMois(form, catalog),
            userId: user?.id || null,
          })
          invalidateFeesCache()
        }
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
        return (
          <Step1PersonalDetails
            form={form}
            set={setFormField}
            setPhoneField={setPhoneField}
            errors={fieldErrors}
            onPhoneBlur={(field) => validatePhoneField(field, form[field], field !== 'phone2')}
          />
        )
      case 2:
        return <Step2Classification form={form} set={setFormField} catalog={catalog} />
      case 3:
        return <Step3SubjectsGroups form={form} set={setFormField} catalog={catalog} toggleGroup={toggleGroup} toggleGroupSubject={toggleGroupSubject} setSubjectDetails={setSubjectDetails} resetGroups={resetGroups} />
      case 4:
        return (
          <Step4Billing
            form={form}
            catalog={catalog}
            set={setFormField}
            registrationFee={appSettings?.registrationFee}
            schoolYear={appSettings?.activeSchoolYear}
            editing={mode === 'edit'}
          />
        )
      default:
        return null
    }
  }

  if (receiptOpen) {
    return (
      <EnrollmentReceipt
        form={form}
        catalog={catalog}
        registrationFee={appSettings?.registrationFee}
        registrationFeePaid={form.registrationFeePaidNow}
        firstMonthPaid={form.firstMonthPaidNow}
        close={() => { finish(form); close() }}
      />
    )
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
