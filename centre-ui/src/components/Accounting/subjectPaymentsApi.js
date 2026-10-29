import { supabase } from '../../supabaseClient'
import { isPackageLevel, packageAmount, subjectMonthlyPrice } from '../Students/enrollment/enrollmentApi'
import { priceFor, recordFirstMonthPayment } from './feesApi'
import { localMonthKey, monthBalanceOf, monthCoverageOf } from './tuitionCoverage'
import { monthLabelOf, normalizeMonthKey, parseLocalDate, schoolMonthsFrom } from './monthUtils'

// Versements par matière (student_payment_subjects, migration 043) : une ligne
// par somme reçue. Une matière peut se régler en plusieurs fois, et ce qui
// dépasse le prix d'un mois est une avance sur le mois suivant.
//
// Exemple : inscrit le 18/10 en Maths (150 DH), octobre compté à moitié. Il
// paie 150 DH : 75 DH soldent octobre, 75 DH vont sur novembre, qui reste
// partiel (orange) jusqu'au paiement des 75 DH restants.

const toNumber = (value) => {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

// Répartit une somme sur des mois successifs : chaque mois reçoit au plus ce
// qui lui manque (`need`), le surplus passe au suivant.
// slots = [{ monthKey, need, dueAmount }] ; rest > 0 = somme trop élevée.
export function allocateAcrossMonths(amount, slots) {
  const parts = []
  let rest = toNumber(amount)
  for (const slot of slots) {
    if (rest <= 0) break
    if (!(slot.need > 0)) continue
    const part = Math.min(rest, slot.need)
    parts.push({ monthKey: slot.monthKey, amount: part, dueAmount: slot.dueAmount })
    rest -= part
  }
  return { parts, rest }
}

// Les mois qui suivent `afterMonthKey` (jusqu'en août) où une avance sur la
// matière peut aller : ce qui reste après une avance déjà versée, le prix
// habituel sinon. Un mois soldé ou payé en bloc ne reçoit rien.
export function laterSubjectSlots({ student, catalog, name, afterMonthKey, payments = [], subjectRows = [] }) {
  return schoolMonthsFrom(afterMonthKey).slice(1).map((monthKey) => {
    const coverage = monthCoverageOf({ student, monthKey, payments, subjectRows })
    const status = coverage.bySubject[name]
    if (!status || status.settled || coverage.blockCovered.includes(name)) return { monthKey, need: 0 }
    if (status.partial) return { monthKey, need: status.remaining, dueAmount: status.dueAmount }
    const price = priceFor(catalog, student, name)
    return { monthKey, need: price, dueAmount: price }
  })
}

// Les lignes de l'élève telles qu'elles seront après ces changements : de quoi
// recalculer les résumés de mois sans tout recharger.
export function applySubjectPaymentChanges(rows, { inserts = [], updates = [], deletes = [] }) {
  const changesById = new Map(updates.map((update) => [update.id, update.changes]))
  return [
    ...rows
      .filter((row) => !deletes.includes(row.id))
      .map((row) => (changesById.has(row.id) ? { ...row, ...changesById.get(row.id) } : row)),
    ...inserts.map((row) => ({ ...row, month: normalizeMonthKey(row.month) })),
  ]
}

export async function writeSubjectPaymentChanges({ inserts = [], updates = [], deletes = [] }) {
  if (inserts.length > 0) {
    const { error } = await supabase.from('student_payment_subjects').insert(inserts)
    if (error) throw new Error(error.message)
  }
  for (const { id, changes } of updates) {
    const { error } = await supabase.from('student_payment_subjects').update(changes).eq('id', id)
    if (error) throw new Error(error.message)
  }
  if (deletes.length > 0) {
    const { error } = await supabase.from('student_payment_subjects').delete().in('id', deletes)
    if (error) throw new Error(error.message)
  }
}

// Un mois reste ouvert jusqu'à sa fin : tout y est modifiable par tous.
// Ensuite il est clôturé — on peut encore y encaisser un retard, mais seul un
// rôle « centre » (administrateur, directeur) corrige ce qui y est enregistré.
export function isMonthClosed(monthKey, now = new Date()) {
  return normalizeMonthKey(monthKey) < localMonthKey(now)
}

// Versements d'une matière sur les mois encore ouverts : ceux qu'on propose de
// supprimer quand on retire la matière à l'élève. Les mois clôturés gardent
// les leurs.
export function openMonthRowsOf(subjectRows, subjectId, now = new Date()) {
  return (subjectRows || []).filter((row) => row.subject_id === subjectId && !isMonthClosed(row.month, now))
}

// « 100 DH — Octobre 2026 · 50 DH — Novembre 2026 »
export function paymentRowsLabel(rows) {
  return [...(rows || [])]
    .sort((a, b) => normalizeMonthKey(a.month).localeCompare(normalizeMonthKey(b.month)))
    .map((row) => `${toNumber(row.amount).toLocaleString('fr-FR')} DH — ${monthLabelOf(normalizeMonthKey(row.month))}`)
    .join(' · ')
}

// Après la suppression de versements : remet d'aplomb le résumé « mois
// complet » des mois touchés. `student`, `payments`, `subjectRows` : la
// situation rechargée APRÈS la suppression ; `deletedRows` : ce qui a été retiré.
export async function resyncAfterDeletion({ student, catalog, payments = [], subjectRows = [], deletedRows = [], userId = null }) {
  const deleted = deletedRows.map((row) => ({ ...row, month: normalizeMonthKey(row.month) }))
  const monthKeys = [...new Set(deleted.map((row) => row.month))]
  if (monthKeys.length === 0) return
  await syncMonthSummaries({ student, catalog, monthKeys, payments, subjectRows, previousRows: [...subjectRows, ...deleted], userId })
}

// Résumé « mois complet » (student_payments) des mois réglés matière par
// matière : présent quand toutes les matières dues sont soldées, absent sinon.
// C'est ce que lisent Dashboard et Rapports ; un mois partiel (avance) n'y
// figure donc pas. Un paiement en bloc est un vrai encaissement : on n'y touche
// pas. Le résumé est daté après les versements qu'il résume (isBlockPayment).
// payments / subjectRows : la situation de l'élève APRÈS les changements ;
// previousRows : ses versements AVANT. Un résumé dont on vient de retirer tous
// les versements ressemblerait sinon à un paiement en bloc, et resterait.
export async function syncMonthSummaries({ student, catalog, monthKeys, payments = [], subjectRows = [], previousRows = subjectRows, userId = null }) {
  for (const monthKey of new Set(monthKeys)) {
    const previous = monthCoverageOf({ student, monthKey, payments, subjectRows: previousRows })
    if (previous.block) continue
    // Le mois d'après ses seuls versements : l'ancien résumé n'en fait pas partie.
    const otherMonths = payments.filter((payment) => normalizeMonthKey(payment.month) !== monthKey)
    const balance = monthBalanceOf({ student, catalog, monthKey, payments: otherMonths, subjectRows })
    if (balance.settled && balance.due.length > 0) {
      const total = balance.due.reduce((sum, name) => sum + balance.bySubject[name].paidAmount, 0)
      const latestRow = Math.max(0, ...balance.rows.map((row) => new Date(row.paid_at || 0).getTime()))
      const existing = previous.payment
      if (existing && toNumber(existing.amount) === total && new Date(existing.paid_at || 0).getTime() >= latestRow) continue
      const { error } = await supabase.from('student_payments').upsert(
        { student_id: student.id, month: monthKey, amount: total, status: 'paid', paid_at: new Date().toISOString(), paid_by: userId },
        { onConflict: 'student_id,month' }
      )
      if (error) throw new Error(error.message)
    } else if (payments.some((payment) => normalizeMonthKey(payment.month) === monthKey)) {
      const { error } = await supabase.from('student_payments').delete().eq('student_id', student.id).eq('month', monthKey)
      if (error) throw new Error(error.message)
    }
  }
}

// Inscrit après le 15, le 1er mois est proposé à moitié prix.
export function isLateInMonth(registrationDate) {
  const date = parseLocalDate(registrationDate)
  return Boolean(date) && date.getDate() > 15
}

// Somme saisie : undefined = valeur proposée ; vide ou invalide = NaN.
function typedAmount(text, fallback) {
  if (text == null) return fallback
  const trimmed = String(text).trim()
  return trimmed === '' ? NaN : Number(trimmed.replace(',', '.'))
}

// Paiement du 1er mois à l'inscription, matière par matière :
//   - half      : 1er mois compté à moitié (inscription en milieu de mois) ;
//   - lines     : par matière, son prix, ce que doit le 1er mois (firstDue),
//                 la somme payée et sa répartition (parts) : le 1er mois
//                 d'abord, le surplus en avance sur les mois suivants ;
//   - total / advance / remaining : payé aujourd'hui, dont avance, et ce
//                 qui reste dû sur le 1er mois ;
//   - error     : saisie invalide, vide sinon.
// Au forfait il n'y a qu'un montant : le forfait, ou sa moitié.
export function firstMonthPlan(form, catalog) {
  const startMonth = normalizeMonthKey(form.registrationDate)
  const months = schoolMonthsFrom(startMonth)
  const half = form.firstMonthHalf ?? isLateInMonth(form.registrationDate)
  const firstDueOf = (price) => (half ? Math.round(price / 2) : price)
  const base = { startMonth, half, nextMonth: months[1] || '' }
  if (!catalog || !startMonth) return { ...base, isPackage: false, lines: [], total: 0, advance: 0, remaining: 0, error: '' }

  if (isPackageLevel(catalog, form.level)) {
    const firstDue = firstDueOf(packageAmount(form, catalog))
    return { ...base, isPackage: true, lines: [], firstDue, total: firstDue, advance: 0, remaining: 0, error: '' }
  }

  const errors = []
  const lines = (form.chosen || []).map((name) => {
    const price = subjectMonthlyPrice(form, catalog, name)
    const firstDue = firstDueOf(price)
    const amount = typedAmount(form.firstMonthAmounts?.[name], firstDue)
    const valid = Number.isFinite(amount) && amount >= 0
    if (!valid) errors.push(`Montant payé invalide pour ${name}.`)
    const slots = months.map((monthKey, index) => {
      const due = index === 0 ? firstDue : price
      return { monthKey, need: due, dueAmount: due }
    })
    const { parts, rest } = allocateAcrossMonths(valid ? amount : 0, slots)
    if (rest > 0) errors.push(`Le montant payé pour ${name} dépasse ce qui reste à payer jusqu'en août.`)
    const firstPaid = parts.find((part) => part.monthKey === startMonth)?.amount || 0
    return {
      name,
      subjectId: catalog.subjectsByName?.[name]?.id || null,
      price,
      firstDue,
      amount: valid ? amount : 0,
      parts,
      firstPaid,
      advance: parts.reduce((sum, part) => sum + (part.monthKey === startMonth ? 0 : part.amount), 0),
      remaining: Math.max(0, firstDue - firstPaid),
    }
  })
  const sum = (key) => lines.reduce((total, line) => total + line[key], 0)
  const advanceMonths = lines.flatMap((line) => line.parts.map((part) => part.monthKey)).filter((key) => key !== startMonth)
  return {
    ...base,
    // Dernier mois touché par l'avance (elle peut couvrir plusieurs mois).
    advanceUntil: advanceMonths.sort().pop() || '',
    isPackage: false,
    lines,
    total: sum('amount'),
    advance: sum('advance'),
    remaining: sum('remaining'),
    error: errors.join(' '),
  }
}

// Enregistre le plan du 1er mois (firstMonthPlan) d'un élève tout juste inscrit.
export async function recordFirstMonthPlan({ studentId, form, catalog, plan, userId = null }) {
  if (plan.isPackage) {
    await recordFirstMonthPayment({ studentId, month: plan.startMonth, amount: plan.firstDue, userId })
    return
  }
  const paidAt = new Date().toISOString()
  const inserts = plan.lines
    .filter((line) => line.subjectId)
    .flatMap((line) =>
      line.parts.map((part) => ({
        student_id: studentId,
        subject_id: line.subjectId,
        month: part.monthKey,
        amount: part.amount,
        due_amount: part.dueAmount,
        paid_at: paidAt,
        paid_by: userId,
      }))
    )
  if (inserts.length === 0) return
  await writeSubjectPaymentChanges({ inserts })
  // L'élève tel que le calendrier le verra : ses matières, toutes suivies
  // depuis l'inscription.
  const student = {
    id: studentId,
    level: form.level,
    chosen: plan.lines.map((line) => line.name),
    subjectDetails: Object.fromEntries(plan.lines.map((line) => [line.name, { subject_id: line.subjectId, startedAt: null }])),
  }
  await syncMonthSummaries({
    student,
    catalog,
    monthKeys: inserts.map((row) => row.month),
    subjectRows: applySubjectPaymentChanges([], { inserts }),
    userId,
  })
}

// Ce que le reçu d'inscription dit du 1er mois, une ligne par information.
export function firstMonthStatusLabel(plan, dateLabel) {
  if (!plan) return 'En attente de paiement'
  const amount = (value) => `${Number(value || 0).toLocaleString('fr-FR')} DH`
  const lines = [`Payé le ${dateLabel} : ${amount(plan.total)}`]
  if (plan.half) lines.push(`${monthLabelOf(plan.startMonth)} compté à moitié`)
  if (plan.advance > 0) {
    const months = plan.advanceUntil && plan.advanceUntil !== plan.nextMonth
      ? `de ${monthLabelOf(plan.nextMonth)} à ${monthLabelOf(plan.advanceUntil)}`
      : `sur ${monthLabelOf(plan.nextMonth)}`
    lines.push(`Dont ${amount(plan.advance)} d'avance ${months}`)
  }
  if (plan.remaining > 0) lines.push(`Reste à payer sur ${monthLabelOf(plan.startMonth)} : ${amount(plan.remaining)}`)
  return lines.join('\n')
}
