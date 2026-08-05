import { supabase } from '../../supabaseClient'
import { fetchFeesData } from './feesApi'

export const GRACE_DAYS = 5
export const SUBSEQUENT_DUE_DAY = 5

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

function dueDateFor(monthDate, regDate, isEnrollmentMonth) {
  if (isEnrollmentMonth) {
    return new Date(regDate.getFullYear(), regDate.getMonth(), regDate.getDate() + GRACE_DAYS)
  }
  return new Date(monthDate.getFullYear(), monthDate.getMonth(), SUBSEQUENT_DUE_DAY)
}

export function computeOverdueMonths(student, paymentsByStudent, today = new Date()) {
  const regDate = toDate(student.registrationDate)
  if (!regDate) return []

  const settledMonths = new Set(
    (paymentsByStudent?.[student.id] || [])
      .filter((payment) => payment.status && payment.status !== 'unpaid')
      .map((payment) => String(payment.month).slice(0, 7))
  )

  const firstMonth = new Date(regDate.getFullYear(), regDate.getMonth(), 1)
  const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1)
  const todayDay = startOfDay(today)
  const overdue = []

  for (
    let cursor = new Date(firstMonth);
    cursor <= currentMonth;
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)
  ) {
    const isEnrollmentMonth = cursor.getTime() === firstMonth.getTime()
    const dueDate = dueDateFor(cursor, regDate, isEnrollmentMonth)
    if (!settledMonths.has(monthKeyOf(cursor)) && todayDay > dueDate) {
      overdue.push({ month: monthKeyOf(cursor), dueDate })
    }
  }

  return overdue
}

export function buildDebtors(students, paymentsByStudent, today = new Date()) {
  const debtors = []
  for (const student of students || []) {
    if (!student.active) continue
    const duMois = Number(student.du_mois) || 0
    const overdue = computeOverdueMonths(student, paymentsByStudent, today)
    if (overdue.length === 0 || duMois <= 0) continue

    overdue.sort((a, b) => a.month.localeCompare(b.month))
    debtors.push({
      id: student.id,
      name: student.name,
      code: student.code,
      level: student.level,
      filiere: student.filiere,
      phone: student.phone,
      phone2: student.phone2,
      months: overdue.length,
      days: diffDays(startOfDay(today), overdue[0].dueDate),
      debt: overdue.length * duMois,
      duMois,
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
      .replace('{succursale}', centerName || 'Centre Atlas')
  }
  return (
    `Bonjour, nous vous rappelons que le règlement des frais de scolarité pour ${name} ` +
    `est en retard de ${months} mois (Montant total: ${amount}). Merci de procéder au paiement.`
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
  })
  if (error) throw new Error(error.message)
  return data
}

export async function fetchDelinquenciesData() {
  const [fees, templatesRes, settingsRes] = await Promise.all([
    fetchFeesData(),
    supabase.from('whatsapp_templates').select('type, content').eq('type', 'payment_reminder').maybeSingle(),
    supabase.from('center_settings').select('center_name').limit(1).maybeSingle(),
  ])
  if (templatesRes.error) throw new Error(templatesRes.error.message)
  if (settingsRes.error) throw new Error(settingsRes.error.message)

  const debtors = buildDebtors(fees.students, fees.paymentsByStudent)
  return {
    debtors,
    stats: summarizeDebtors(debtors),
    template: templatesRes.data || null,
    centerName: settingsRes.data?.center_name || 'Centre Atlas',
    catalog: fees.catalog,
  }
}
