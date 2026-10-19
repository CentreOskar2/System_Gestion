import { isPackageLevel } from '../Students/enrollment/enrollmentApi'
import { isBlockPayment, priceFor } from './feesApi'
import { accountingDayBucket, normalizeMonthKey } from './monthUtils'

// Situation d'un mois de scolarité, partagée par le calendrier des frais
// (FeesPage), les retards (delinquenciesApi) et les rapports : les trois
// doivent dire la même chose d'un même élève.

const PAID_STATUSES = ['paid', 'validé']

const toNumber = (value) => {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

// Mois (heure locale) d'un horodatage : "2026-10-01T00:30+01:00" est en
// octobre, même si sa forme UTC tombe encore en septembre.
export function localMonthKey(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`
}

// Un élève au forfait ou sans matière propre (ex. classes de Coran facturées
// en bloc) se règle d'un seul bloc. Les autres sont "segmentés" : chaque
// matière choisie se règle à part.
export function isSegmentedPayment(catalog, student) {
  return Boolean(catalog) && !isPackageLevel(catalog, student.level) && student.chosen.length > 0
}

// Versements d'une matière sur un mois. Une matière peut se régler en
// plusieurs fois (avance, puis le reste) : chaque somme reçue est une ligne de
// student_payment_subjects, à sa date (migration 043).
//   - paidAmount : total encaissé pour la matière ce mois-ci ;
//   - dueAmount  : prix attendu ce mois-là (due_amount : 75 DH pour un
//                  demi-mois, le prix habituel sinon) ;
//   - settled    : réglée, les versements atteignent le prix attendu ;
//   - partial    : une avance a été versée, il reste `remaining` à payer.
// Une ligne enregistrée avant les avances (due_amount NULL) vaut règlement
// complet : son montant était le prix du mois.
export function subjectMonthStatus(rows = []) {
  if (rows.length === 0) return { rows, paidAmount: 0, dueAmount: null, remaining: null, settled: false, partial: false }
  const paidAmount = rows.reduce((sum, row) => sum + toNumber(row.amount), 0)
  const withDue = rows
    .filter((row) => row.due_amount != null)
    .sort((a, b) => new Date(a.paid_at || 0) - new Date(b.paid_at || 0))
  if (withDue.length === 0) return { rows, paidAmount, dueAmount: paidAmount, remaining: 0, settled: true, partial: false }
  const dueAmount = toNumber(withDue[withDue.length - 1].due_amount)
  const remaining = Math.max(0, dueAmount - paidAmount)
  return { rows, paidAmount, dueAmount, remaining, settled: remaining <= 0, partial: remaining > 0 }
}

// Situation d'un mois, matière par matière :
//   - due     : matières à régler ce mois-ci. Une matière ajoutée en cours
//               d'année (startedAt) n'est due qu'à partir de son mois d'ajout ;
//   - rawPaid : matières soldées par leurs lignes de student_payment_subjects ;
//   - partial : matières dont une partie seulement est payée (avance) ;
//   - blockCovered : matières couvertes par un paiement en bloc ;
//   - paid    : matières à considérer comme réglées ;
//   - bySubject : le détail des versements de chaque matière (subjectMonthStatus).
// La ligne student_payments d'un mois réglé matière par matière n'est qu'un
// résumé « mois complet » : elle ne dit pas quelles matières elle couvrait,
// et compter toutes les matières actuelles comme payées ferait passer une
// matière ajoutée après coup pour réglée. Seul un paiement en bloc (avance,
// 1er mois à l'inscription, paiement ancien — voir isBlockPayment) couvre
// des matières sans ligne : celles déjà suivies au moment du paiement.
// asOfDay (jour comptable) : la situation telle qu'elle était à la fin de ce
// jour, sans les encaissements reçus après (détail de l'historique).
export function monthCoverageOf({ student, monthKey, payments = [], subjectRows = [], asOfDay = null }) {
  const receivedBy = (paidAt) => !asOfDay || !paidAt || accountingDayBucket(paidAt) <= asOfDay
  const payment = payments.find(
    (p) => normalizeMonthKey(p.month) === monthKey && PAID_STATUSES.includes(p.status) && receivedBy(p.paid_at)
  ) || null
  const rows = subjectRows.filter((r) => r.month === monthKey && receivedBy(r.paid_at))
  const block = isBlockPayment(payment, rows) ? payment : null
  const rowSubjectIds = new Set(rows.map((r) => r.subject_id))
  const subjectIdOf = (name) => student.subjectDetails?.[name]?.subject_id
  const startedAtOf = (name) => student.subjectDetails?.[name]?.startedAt || null
  const bySubject = Object.fromEntries(
    student.chosen.map((name) => [name, subjectMonthStatus(rows.filter((r) => r.subject_id === subjectIdOf(name)))])
  )
  const rawPaid = student.chosen.filter((name) => bySubject[name].settled)
  const partial = student.chosen.filter((name) => bySubject[name].partial)
  const blockCovered = block
    ? student.chosen.filter((name) => {
        if (rowSubjectIds.has(subjectIdOf(name))) return false
        const startedAt = startedAtOf(name)
        return !startedAt || !block.paid_at || new Date(startedAt) <= new Date(block.paid_at)
      })
    : []
  const paid = student.chosen.filter((name) => rawPaid.includes(name) || blockCovered.includes(name))
  const due = student.chosen.filter((name) => {
    const startedAt = startedAtOf(name)
    return !startedAt || localMonthKey(startedAt) <= monthKey || paid.includes(name) || partial.includes(name)
  })
  return { monthKey, payment, block, rows, rawPaid, partial, blockCovered, paid, due, bySubject }
}

// Ce qui reste à régler sur un mois :
//   - settled   : le mois est entièrement réglé (même règle que le calendrier) ;
//   - unpaid    : matières dues et non soldées, avec ce qui reste à payer (le
//                 prix habituel, ou le reste après une avance) et leur date de
//                 début (une matière ajoutée en cours de mois n'est pas
//                 exigible avant d'être suivie) ;
//   - remaining : leur total, ou le forfait du mois s'il n'est pas payé.
// Une matière dont les versements atteignent le prix prévu pour ce mois
// (demi-mois, remise) compte comme réglée.
export function monthBalanceOf({ student, catalog, monthKey, payments = [], subjectRows = [], asOfDay = null }) {
  const coverage = monthCoverageOf({ student, monthKey, payments, subjectRows, asOfDay })
  if (!isSegmentedPayment(catalog, student)) {
    const settled = Boolean(coverage.payment)
    return { ...coverage, settled, unpaid: [], remaining: settled ? 0 : toNumber(student.du_mois) }
  }
  const unpaid = coverage.due
    .filter((name) => !coverage.paid.includes(name))
    .map((name) => {
      const status = coverage.bySubject[name]
      return {
        name,
        amount: status.partial ? status.remaining : priceFor(catalog, student, name),
        paidAmount: status.paidAmount,
        partial: status.partial,
        startedAt: student.subjectDetails?.[name]?.startedAt || null,
      }
    })
  const settled = coverage.due.length > 0 ? unpaid.length === 0 : Boolean(coverage.payment)
  return { ...coverage, settled, unpaid, remaining: unpaid.reduce((sum, subject) => sum + subject.amount, 0) }
}
