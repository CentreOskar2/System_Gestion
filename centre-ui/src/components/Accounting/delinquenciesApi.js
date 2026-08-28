import { supabase } from '../../supabaseClient'
import { fetchFeesData } from './feesApi'
import { academicYearStart, currentMonthKey, enrollmentDateOf } from './monthUtils'

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

export function computeOverdueMonths(student, paymentsByStudent, today = new Date(), schoolYearStart = academicYearStart()) {
  const regDate = toDate(enrollmentDateOf(student))
  if (!regDate) return []

  const settledMonths = new Set(
    (paymentsByStudent?.[student.id] || [])
      .filter((payment) => payment.status && payment.status !== 'unpaid')
      .map((payment) => String(payment.month).slice(0, 7))
  )

  const yearStart = Number(schoolYearStart) || academicYearStart()
  const fiscalStart = new Date(yearStart, 8, 1)
  const fiscalEnd = new Date(yearStart + 1, 7, 1)
  const firstMonth = new Date(regDate.getFullYear(), regDate.getMonth(), 1)
  if (firstMonth > fiscalEnd) return [] // student wasn't enrolled yet during this school year

  const firstDueMonth = firstMonth < fiscalStart ? fiscalStart : firstMonth
  const currentMonth = toDate(currentMonthKey(today))
  const lastMonth = fiscalEnd < currentMonth ? fiscalEnd : currentMonth
  if (firstDueMonth > lastMonth) return [] // this school year hasn't started yet, or is entirely before enrollment

  const overdue = []

  for (
    let cursor = new Date(firstDueMonth);
    cursor <= lastMonth;
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)
  ) {
    const isEnrollmentMonth = cursor.getTime() === firstMonth.getTime()
    const dueDate = dueDateFor(cursor, regDate, isEnrollmentMonth)
    if (!settledMonths.has(monthKeyOf(cursor))) {
      overdue.push({ month: monthKeyOf(cursor), dueDate })
    }
  }

  return overdue
}

export function buildDebtors(students, paymentsByStudent, today = new Date(), schoolYearStart = academicYearStart()) {
  const debtors = []
  for (const student of students || []) {
    if (!student.active) continue
    const duMois = Number(student.du_mois) || 0
    const overdue = computeOverdueMonths(student, paymentsByStudent, today, schoolYearStart)
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
      days: Math.max(0, diffDays(startOfDay(today), overdue[0].dueDate)),
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

export async function fetchDelinquenciesData(branchId = null, schoolYearStart = academicYearStart()) {
  const [fees, templatesRes, settingsRes] = await Promise.all([
    fetchFeesData(branchId),
    supabase.from('whatsapp_templates').select('type, content').eq('type', 'payment_reminder').maybeSingle(),
    supabase.from('center_settings').select('center_name').limit(1).maybeSingle(),
  ])
  if (templatesRes.error) throw new Error(templatesRes.error.message)
  if (settingsRes.error) throw new Error(settingsRes.error.message)

  const debtors = buildDebtors(fees.students, fees.paymentsByStudent, new Date(), schoolYearStart)
  return {
    debtors,
    stats: summarizeDebtors(debtors),
    template: templatesRes.data || null,
    centerName: settingsRes.data?.center_name || 'Centre Oskar',
    catalog: fees.catalog,
  }
}
