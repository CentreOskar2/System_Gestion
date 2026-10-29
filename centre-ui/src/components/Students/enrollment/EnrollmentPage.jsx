import { useEffect, useState } from 'react'
import Header from '../../shared/Header'
import Step1PersonalDetails from './steps/Step1PersonalDetails'
import Step2Classification from './steps/Step2Classification'
import Step3SubjectsGroups from './steps/Step3SubjectsGroups'
import Step4Billing from './steps/Step4Billing'
import EnrollmentReceipt from '../EnrollmentReceipt'
import { fetchCatalog, nextRegistrationNumber, createEnrollment, updateEnrollment, teacherForGroupSubject, computeDuMois, isPackageLevel, enrollmentRegistrationFee } from './enrollmentApi'
import { today } from '../utils/studentHelpers'
import { isValidPhoneNumber, normalizePhoneInput, phoneValidationMessage } from '../../../utils/validators'
import { fetchAppSettings } from '../../../appSettings'
import { recordRegistrationFeePayment } from '../../Accounting/registrationFeesApi'
import { fetchFeesData, invalidateFeesCache } from '../../Accounting/feesApi'
import {
  firstMonthPlan,
  paymentRowsLabel,
  recordFirstMonthPlan,
  resyncAfterDeletion,
  writeSubjectPaymentChanges,
} from '../../Accounting/subjectPaymentsApi'
import { localMonthKey } from '../../Accounting/tuitionCoverage'
import { supabase } from '../../../supabaseClient'
import { normalizePaymentDay } from '../../Accounting/monthUtils'
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
      paymentDay: String(Number(today().slice(8, 10))),
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
      formationOnly: false,
      formations: [],
      chosen: [],
      subjectDetails: {},
      groupSelections: [],
      packagePriceType: 'standard',
      packageManualPrice: '',
      photoUrl: '',
      photoFile: null,
      // null = montant des réglages ; 'full' | 'advance' | 'later'.
      registrationFeeAmount: null,
      registrationFeeMode: 'full',
      registrationFeeAdvance: '',
      firstMonthPaidNow: true,
      // null = demi-mois proposé si l'inscription a lieu après le 15.
      firstMonthHalf: null,
      // Montant payé aujourd'hui par matière ; absent = le dû du 1er mois.
      firstMonthAmounts: {},
    }
  }

  const [firstName = '', ...restName] = (student.name || '').split(' ')

  return {
    code: student.code || '',
    firstName,
    lastName: restName.join(' '),
    registrationDate: student.registrationDate || '',
    // Élève enregistré avant ce champ : son jour d'inscription, qui était son échéance.
    paymentDay: String(student.paymentDay || Number(String(student.registrationDate || '').slice(8, 10)) || ''),
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
    // Un élève sans niveau scolaire est forcément un inscrit « formation seule ».
    formationOnly: Boolean(student.formationOnly ?? !student.level),
    formations: student.formations || [],
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
    registrationFeeAmount: null,
    registrationFeeMode: 'full',
    registrationFeeAdvance: '',
    firstMonthPaidNow: true,
    firstMonthHalf: null,
    firstMonthAmounts: {},
  }
}

export default function EnrollmentPage({ close, finish, student, mode = 'create', catalog: providedCatalog }) {
  const { user } = useAuth()
  const [catalog, setCatalog] = useState(providedCatalog || null)
  const [step, setStep] = useState(1)
  const [form, setForm] = useState(() => createInitialForm(student))
  const [appSettings, setAppSettings] = useState(null)
  const [receiptOpen, setReceiptOpen] = useState(false)
  // Plan du 1er mois réellement enregistré, pour le reçu (null = pas payé).
  const [firstMonthResult, setFirstMonthResult] = useState(null)
  const [registrationFeeResult, setRegistrationFeeResult] = useState(null)
  const registrationFee = enrollmentRegistrationFee(form, appSettings?.registrationFee)
  const [codeReady, setCodeReady] = useState(!student || Boolean(student?.code))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  // Modification : versements de l'élève sur les mois encore ouverts, pour
  // proposer de les supprimer si on lui retire une matière.
  const [openPaymentRows, setOpenPaymentRows] = useState([])
  const [removedChoices, setRemovedChoices] = useState({})

  useEffect(() => {
    if (mode !== 'edit' || !student?.id) return undefined
    let active = true
    supabase
      .from('student_payment_subjects')
      .select('id, subject_id, month, amount, due_amount, paid_at, paid_by')
      .eq('student_id', student.id)
      .gte('month', localMonthKey(new Date()))
      .then(({ data, error: loadError }) => {
        if (!active) return
        if (loadError) console.error(loadError)
        else setOpenPaymentRows(data || [])
      })
    return () => { active = false }
  }, [mode, student?.id])
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
        // Le groupe est TOUJOURS réaligné sur la sélection de cette étape, qui
        // fait foi. L'ancienne version ne le renseignait que s'il était vide :
        // déplacer une matière vers un autre groupe ne changeait donc rien à
        // l'enregistrement, et l'abonnement restait accroché à l'ancien groupe
        // alors que l'appartenance suivait le nouveau. C'est ce décalage qui
        // faisait retomber le journal du professeur sur le tarif du catalogue.
        //
        // Le prix (standard ou manuel) est préservé par la copie : seul le
        // rattachement est recalculé.
        subjectDetails[name] = {
          ...(subjectDetails[name] || {}),
          group_id: sel.groupId,
          group: sel.groupName,
          teacher: teacherForGroupSubject(catalog, sel.groupId, name),
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
      if (!normalizePaymentDay(form.paymentDay)) errors.push('Le jour de paiement est obligatoire (entre 1 et 31).')
      if (!isValidPhoneNumber(form.phone)) errors.push('Le numéro doit contenir exactement 10 chiffres.')
      if (form.phone2.trim() && !isValidPhoneNumber(form.phone2)) errors.push('Le numéro doit contenir exactement 10 chiffres.')
      setFieldErrors({
        phone: isValidPhoneNumber(form.phone) ? '' : phoneValidationMessage(form.phone),
        phone2: form.phone2.trim() && !isValidPhoneNumber(form.phone2) ? phoneValidationMessage(form.phone2) : '',
      })
    }
    if (currentStep === 2 && !form.formationOnly) {
      if (!form.cycle) errors.push('Le cycle est obligatoire.')
      if (!form.level) errors.push('Le niveau est obligatoire.')
      if ((catalog.branchesByLevel?.[form.level]?.length || 0) > 0 && !form.track) {
        errors.push('La filière est obligatoire.')
      }
    }
    if (currentStep === 3 && form.formationOnly) {
      // Sans cycle, la formation est la seule chose qui rattache l'élève au
      // centre : au moins une est donc obligatoire.
      if ((form.formations || []).length === 0) {
        errors.push('Sélectionnez au moins un niveau de formation.')
      }
    }
    if (currentStep === 3 && !form.formationOnly) {
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

  // Matières retirées à l'élève qui ont des versements sur un mois encore ouvert.
  const removedWithPayments = (() => {
    if (mode !== 'edit' || !catalog) return []
    const kept = new Set(
      form.formationOnly ? [] : (form.chosen || []).map((name) => catalog.subjectsByName?.[name]?.id).filter(Boolean)
    )
    const nameById = Object.fromEntries((catalog.subjects || []).map((subject) => [subject.id, subject.name]))
    const bySubject = new Map()
    for (const row of openPaymentRows) {
      if (kept.has(row.subject_id)) continue
      if (!bySubject.has(row.subject_id)) {
        bySubject.set(row.subject_id, { subjectId: row.subject_id, name: nameById[row.subject_id] || 'Matière', rows: [] })
      }
      bySubject.get(row.subject_id).rows.push(row)
    }
    return [...bySubject.values()]
  })()

  const handleFinish = async () => {
    if (saving) return
    if (validateStep(1).length > 0) return
    if (mode !== 'edit' && appSettings && registrationFee.error) {
      setError(registrationFee.error)
      return
    }
    // Une inscription en formation seule n'a pas de dû mensuel de scolarité :
    // le 1er mois se règle sur le calendrier des formations.
    const payFirstMonth = mode !== 'edit' && form.firstMonthPaidNow && !form.formationOnly
    const plan = payFirstMonth ? firstMonthPlan(form, catalog) : null
    if (plan?.error) {
      setError(plan.error)
      return
    }
    // Matière retirée avec des versements sur un mois encore ouvert : garder ou
    // supprimer ces versements est un choix explicite.
    const undecided = removedWithPayments.filter((item) => !removedChoices[item.subjectId])
    if (undecided.length > 0) {
      setError(`Choisissez quoi faire des paiements de : ${undecided.map((item) => item.name).join(', ')}.`)
      return
    }
    const rowsToDelete = removedWithPayments
      .filter((item) => removedChoices[item.subjectId] === 'delete')
      .flatMap((item) => item.rows)
    if (rowsToDelete.length > 0) {
      const total = rowsToDelete.reduce((sum, row) => sum + (Number(row.amount) || 0), 0)
      const todayLabel = new Date().toLocaleDateString('fr-FR')
      const days = [...new Set(rowsToDelete.map((row) => (row.paid_at ? new Date(row.paid_at).toLocaleDateString('fr-FR') : '')))]
        .filter((day) => day && day !== todayLabel)
      let message = `Supprimer ${total.toLocaleString('fr-FR')} DH de paiements : ${paymentRowsLabel(rowsToDelete)} ?`
      if (days.length > 0) message += `\n\nAttention : la caisse du ${days.join(', ')} sera modifiée.`
      if (!window.confirm(message)) return
    }
    setSaving(true)
    setError(null)
    try {
      if (mode === 'edit') {
        await updateEnrollment(student.id, form, catalog, student.status)
        if (rowsToDelete.length > 0) {
          await writeSubjectPaymentChanges({ deletes: rowsToDelete.map((row) => row.id) })
          // Le résumé « mois complet » des mois touchés suit (voir syncMonthSummaries).
          invalidateFeesCache()
          const data = await fetchFeesData(null)
          const updated = data.students.find((item) => item.id === student.id)
          if (updated) {
            await resyncAfterDeletion({
              student: updated,
              catalog: data.catalog,
              payments: data.paymentsByStudent[updated.id] || [],
              subjectRows: data.paymentSubjectsByStudent[updated.id] || [],
              deletedRows: rowsToDelete,
              userId: user?.id || null,
            })
          }
          invalidateFeesCache()
        }
        finish({ ...form, id: student.id })
        close()
      } else {
        const result = await createEnrollment(form, catalog)
        if (appSettings) {
          const { fee, paidNow } = await recordRegistrationFeePayment({
            studentId: result.id,
            schoolYear: appSettings.activeSchoolYear,
            dueAmount: registrationFee.due,
            paidAmount: registrationFee.paid,
            userId: user?.id || null,
          })
          // Ce que le reçu affiche : les frais réellement enregistrés (déjà
          // soldés une autre fois, ils ne sont pas encaissés deux fois).
          setRegistrationFeeResult({ due: fee.amount, paidNow, remaining: fee.remaining })
        }
        // 1er mois : demi-mois éventuel, et ce qui est payé en plus va en
        // avance sur les mois suivants (voir firstMonthPlan).
        if (plan) {
          await recordFirstMonthPlan({ studentId: result.id, form, catalog, plan, userId: user?.id || null })
          invalidateFeesCache()
          setFirstMonthResult(plan)
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
        registrationFee={registrationFeeResult}
        firstMonth={firstMonthResult}
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
          {step === STEPS.length && removedWithPayments.length > 0 && (
            <section className="enrollment-removed-payments">
              <b>Matières retirées qui ont des paiements sur les mois en cours</b>
              <p>Choisissez pour chacune : garder ses paiements, ou les supprimer. Les mois terminés gardent les leurs.</p>
              {removedWithPayments.map((item) => (
                <div className="removed-payment-choice" key={item.subjectId}>
                  <span>
                    <b>{item.name}</b>
                    <small>{paymentRowsLabel(item.rows)}</small>
                  </span>
                  <div>
                    <button
                      type="button"
                      className={removedChoices[item.subjectId] === 'keep' ? 'active' : ''}
                      onClick={() => setRemovedChoices((current) => ({ ...current, [item.subjectId]: 'keep' }))}
                    >
                      Garder ses paiements
                    </button>
                    <button
                      type="button"
                      className={removedChoices[item.subjectId] === 'delete' ? 'danger active' : 'danger'}
                      onClick={() => setRemovedChoices((current) => ({ ...current, [item.subjectId]: 'delete' }))}
                    >
                      Supprimer ses paiements
                    </button>
                  </div>
                </div>
              ))}
            </section>
          )}
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
