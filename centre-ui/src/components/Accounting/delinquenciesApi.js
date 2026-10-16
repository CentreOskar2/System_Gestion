import { supabase } from '../../supabaseClient'
import { fetchFeesData } from './feesApi'
import { monthBalanceOf } from './tuitionCoverage'
import { fetchFormationFeesData } from '../Formations/formationsApi'
import { billingDueDate, currentSchoolYearStart, enrollmentDateOf } from './monthUtils'

// Le retard ne court qu'à partir du lendemain de l'échéance : le jour de l'échéance
// lui-même reste "à jour".
export const LATE_AFTER_DAYS = 1

const DAY_MS = 1000 * 60 * 60 * 24

const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())
const toDate = (value) => {
  if (!value) return null
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}
const monthKeyOf = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
const diffDays = (a, b) => Math.round((a - b) / DAY_MS)

// Mois facturables d'un élève sur l'année scolaire choisie : du mois de son
// inscription (ou de son début de formation) au mois courant. L'année scolaire
// ne décale pas les échéances, elle borne seulement les mois rapportés
// (septembre → août).
function billableMonths(startDate, today, schoolYearStart) {
  const start = toDate(startDate)
  if (!start) return []
  const firstMonth = new Date(start.getFullYear(), start.getMonth(), 1)
  const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1)
  const yearStart = Number(schoolYearStart) || currentSchoolYearStart(today)
  const windowStart = `${yearStart}-09`
  const windowEnd = `${yearStart + 1}-08`
  const months = []
  for (
    let cursor = new Date(firstMonth);
    cursor <= currentMonth; // une inscription datée dans le futur ne donne aucun mois
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)
  ) {
    const month = monthKeyOf(cursor)
    if (month >= windowStart && month <= windowEnd) months.push(month)
  }
  return months
}

const isLateOn = (today) => (dueDate) => diffDays(startOfDay(today), dueDate) >= LATE_AFTER_DAYS

// Mois de SCOLARITÉ en retard d'un élève. La règle est celle du calendrier des
// frais (tuitionCoverage.js) : un mois est en retard si une partie de ce qui est
// dû n'est pas réglée une fois l'échéance passée.
//
// Exemple : inscrit en Math, PC, FR et ANG, l'élève ne règle en octobre que Math
// et PC. Le lendemain de son jour de paiement, octobre ressort en retard pour FR
// et ANG, et la dette est leur prix — pas le mois entier.
//
// fees = { paymentsByStudent, paymentSubjectsByStudent, catalog } (fetchFeesData).
// Chaque mois rendu : { month, dueDate, amount, subjects, partial, kind }.
export function computeOverdueMonths(student, fees, today = new Date(), schoolYearStart = currentSchoolYearStart(today)) {
  const registrationDate = enrollmentDateOf(student)
  const isLate = isLateOn(today)
  const overdue = []
  for (const month of billableMonths(registrationDate, today, schoolYearStart)) {
    const balance = monthBalanceOf({
      student,
      catalog: fees?.catalog,
      monthKey: `${month}-01`,
      payments: fees?.paymentsByStudent?.[student.id] || [],
      subjectRows: fees?.paymentSubjectsByStudent?.[student.id] || [],
    })
    if (balance.settled || balance.remaining <= 0) continue
    const dueDate = billingDueDate(registrationDate, month, student.paymentDay)
    if (!dueDate) continue

    if (balance.unpaid.length === 0) {
      // Forfait (ou élève sans matière propre) : le mois entier.
      if (isLate(dueDate)) {
        overdue.push({ month, dueDate, amount: balance.remaining, subjects: [], partial: false, kind: 'tuition' })
      }
      continue
    }

    // Une matière ajoutée en cours de mois n'est exigible qu'une fois suivie :
    // son échéance est la plus tardive des deux dates.
    const lateSubjects = balance.unpaid
      .map((subject) => {
        const started = subject.startedAt ? startOfDay(new Date(subject.startedAt)) : null
        return { ...subject, dueDate: started && started > dueDate ? started : dueDate }
      })
      .filter((subject) => isLate(subject.dueDate))
    if (lateSubjects.length === 0) continue
    overdue.push({
      month,
      dueDate: new Date(Math.min(...lateSubjects.map((subject) => subject.dueDate.getTime()))),
      amount: lateSubjects.reduce((sum, subject) => sum + subject.amount, 0),
      subjects: lateSubjects.map((subject) => subject.name),
      // Une partie du mois a déjà été réglée : seules ces matières restent dues.
      partial: balance.paid.length > 0,
      kind: 'tuition',
    })
  }
  return overdue
}

// Mois de FORMATION en retard pour une inscription à une formation. Même règle
// que le calendrier des frais de formation : un mois est dû à partir du début de
// la formation, réglé dès qu'un paiement existe pour ce mois, et en retard le
// lendemain de l'échéance (jour de paiement de l'élève, jamais avant le début).
// row = ligne de fetchFormationFeesData ; payments = ses paiements.
export function computeFormationOverdueMonths(row, payments, today = new Date(), schoolYearStart = currentSchoolYearStart(today)) {
  // Formation arrêtée ou élève parti : plus rien n'est réclamé.
  if (!row.active || row.monthlyPrice <= 0) return []
  const isLate = isLateOn(today)
  const paidMonths = new Set((payments || []).map((payment) => String(payment.month).slice(0, 7)))
  const overdue = []
  for (const month of billableMonths(row.enrolledAt, today, schoolYearStart)) {
    if (paidMonths.has(month)) continue
    const dueDate = billingDueDate(row.enrolledAt, month, row.paymentDay)
    if (!dueDate || !isLate(dueDate)) continue
    overdue.push({
      month,
      dueDate,
      amount: row.monthlyPrice,
      subjects: [[row.formationName, row.levelName].filter(Boolean).join(' · ') || 'Formation'],
      partial: false,
      kind: 'formation',
    })
  }
  return overdue
}

// Liste des élèves en retard : scolarité (élèves d'un cycle) et formations.
//   - students      : élèves de fetchFeesData (ceux sans cycle n'ont pas de
//                     scolarité, ils ne peuvent devoir que des formations) ;
//   - fees          : données de scolarité (fetchFeesData) ;
//   - formationFees : { rows, paymentsByEnrollment } (fetchFormationFeesData),
//                     facultatif.
// Une échéance n'est en retard qu'une fois un jour plein écoulé : l'élève n'est
// pas listé le jour même de son échéance. Les frais d'inscription n'y entrent pas.
export function buildDebtors(students, fees, today = new Date(), schoolYearStart = currentSchoolYearStart(today), formationFees = null) {
  const entries = new Map()
  const entryFor = (id, info) => {
    if (!entries.has(id)) entries.set(id, { info, overdue: [] })
    return entries.get(id)
  }

  for (const student of students || []) {
    if (!student.active || !student.level_id) continue
    const overdue = computeOverdueMonths(student, fees, today, schoolYearStart)
    if (overdue.length > 0) entryFor(student.id, student).overdue.push(...overdue)
  }

  const studentsById = new Map((students || []).map((student) => [student.id, student]))
  for (const row of formationFees?.rows || []) {
    const overdue = computeFormationOverdueMonths(row, formationFees.paymentsByEnrollment?.[row.id], today, schoolYearStart)
    if (overdue.length === 0) continue
    const info = studentsById.get(row.studentId) || {
      id: row.studentId,
      name: row.studentName,
      code: row.code,
      phone: row.phone,
    }
    entryFor(row.studentId, info).overdue.push(...overdue)
  }

  const debtors = []
  for (const [id, { info, overdue }] of entries) {
    const debt = overdue.reduce((sum, month) => sum + month.amount, 0)
    if (debt <= 0) continue
    // Par mois, la scolarité avant les formations.
    overdue.sort((a, b) => a.month.localeCompare(b.month) || b.kind.localeCompare(a.kind))
    const firstDue = Math.min(...overdue.map((month) => month.dueDate.getTime()))
    debtors.push({
      id,
      name: info.name,
      code: info.code,
      level: info.level_id ? info.level : 'Formation seule',
      filiere: info.filiere,
      phone: info.phone,
      phone2: info.phone2,
      // Mois distincts : octobre en retard en scolarité ET en formation compte une fois.
      months: new Set(overdue.map((month) => month.month)).size,
      days: Math.max(0, diffDays(startOfDay(today), new Date(firstDue))),
      debt,
      duMois: Number(info.du_mois) || 0,
      overdueMonths: overdue,
    })
  }
  debtors.sort((a, b) => b.debt - a.debt)
  return debtors
}

export function summarizeDebtors(debtors) {
  const count = debtors.length
  const totalDebt = debtors.reduce((sum, debtor) => sum + debtor.debt, 0)
  const avgDelay = count
    ? Math.round(debtors.reduce((sum, debtor) => sum + debtor.days, 0) / count)
    : 0
  return { count, totalDebt, avgDelay }
}

export function waPhoneNumber(phone) {
  if (!phone) return ''
  let digits = String(phone).replace(/\D/g, '')
  if (digits.startsWith('212')) return digits
  if (digits.startsWith('0')) return `212${digits.slice(1)}`
  return digits
}

export function buildReminderMessage(debtor, template, centerName) {
  const name = debtor.name
  const months = String(debtor.months)
  const amount = `${debtor.debt.toLocaleString('fr-FR')} DH`
  if (template?.content) {
    return template.content
      .replace('{nom_eleve}', name)
      .replace('{montant_du}', amount)
      .replace('{mois}', months)
      .replace('{succursale}', centerName || 'Centre Oskar')
  }
  return (
    `مرحباً، نذكركم أن تسوية مصاريف الدراسة للتلميذ(ة) ${name} ` +
    `متأخرة بـ ${months} شهراً (المبلغ الإجمالي: ${amount}). نرجو القيام بالتسوية في أقرب وقت.`
  )
}

export function whatsappLink(phone, message) {
  const number = waPhoneNumber(phone)
  if (!number) return ''
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`
}

export async function logPaymentReminder(studentId, { months, amount, message, channel = 'whatsapp', status = 'sent', sentBy }) {
  const { data, error } = await supabase.from('payment_reminders').insert({
    student_id: studentId,
    months,
    amount,
    message,
    channel,
    status,
    sent_by: sentBy || null,
    sent_at: new Date().toISOString(),
  })
  if (error) throw new Error(error.message)
  return data
}

export async function fetchDelinquenciesData(branchId = null, schoolYearStart = currentSchoolYearStart()) {
  const [fees, formationFees, templatesRes, settingsRes] = await Promise.all([
    fetchFeesData(branchId),
    fetchFormationFeesData(branchId),
    supabase.from('whatsapp_templates').select('type, content').eq('type', 'payment_reminder').maybeSingle(),
    supabase.from('center_settings').select('center_name').limit(1).maybeSingle(),
  ])
  if (templatesRes.error) throw new Error(templatesRes.error.message)
  if (settingsRes.error) throw new Error(settingsRes.error.message)

  // Scolarité (élèves d'un cycle) et formations : les deux se doivent.
  const debtors = buildDebtors(fees.students, fees, new Date(), schoolYearStart, formationFees)
  return {
    debtors,
    stats: summarizeDebtors(debtors),
    template: templatesRes.data || null,
    centerName: settingsRes.data?.center_name || 'Centre Oskar',
    catalog: fees.catalog,
  }
}
