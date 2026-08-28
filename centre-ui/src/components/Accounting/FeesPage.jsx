import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Header from '../shared/Header'
import { CalendarPlus, Check, Pencil, Printer, Search, TrendingUp, Users, Wallet } from 'lucide-react'
import * as XLSX from 'xlsx'
import { supabase } from '../../supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { useBranch } from '../../context/BranchContext'
import { safeFilename } from '../../utils/exportToPdf'
import { downloadPdfDocument } from '../pdf/downloadPdf'
import FeeReceiptPdf from '../pdf/FeeReceiptPdf'
import { syncSubscriptions } from '../Students/enrollment/enrollmentApi'
import { initials } from '../Students/utils/studentHelpers'
import {
  accountingDayBucket,
  billingDueDate,
  formatAccountingDay,
  formatFrenchDate,
  monthLabelOf,
  normalizeMonthKey,
  isEnrolledInMonth,
  parseLocalDate,
  receiptDateFromRegistration,
  schoolYearOptions,
  schoolYearLabel,
  currentMonthKey,
} from './monthUtils'
import { fetchAppSettings } from '../../appSettings'
import { fetchRegistrationFees, payRegistrationFee } from './registrationFeesApi'
import RegistrationFeeReceiptPdf from '../pdf/RegistrationFeeReceiptPdf'
import {
  monthDate,
  priceFor,
  studentLineItems,
  fetchFeesData,
  invalidateFeesCache,
} from './feesApi'
import './FeesPage.css'
import './FeesEditModal.css'
import './Receipt.css'

function buildSchoolMonths(startYear) {
  const year = Number(startYear)
  if (!Number.isFinite(year)) return []
  return Array.from({ length: 12 }, (_, index) => {
    const monthNumber = ((index + 8) % 12) + 1
    const monthYear = index >= 4 ? year + 1 : year
    const monthKey = `${monthYear}-${String(monthNumber).padStart(2, '0')}-01`
    return { key: monthKey, label: monthLabelOf(monthKey) }
  })
}

function toNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function normalizeDateKey(value) {
  return accountingDayBucket(value)
}

function aggregateDailyRows(payments, studentsById, schoolYearStart) {
  const start = Number(schoolYearStart) || 0
  if (!start) return []
  const schoolStart = `${start}-09-01`
  const schoolEnd = `${start + 1}-08-31`
  const byDay = new Map()
  for (const payment of payments || []) {
    const paidAt = payment.paid_at || payment.created_at || payment.month
    const dayKey = normalizeDateKey(paidAt)
    if (!dayKey) continue
    if (dayKey < schoolStart.slice(0, 10) || dayKey > schoolEnd.slice(0, 10)) continue
    const student = studentsById[payment.student_id]
    if (!student) continue
    const current = byDay.get(dayKey) || { date: dayKey, total: 0, studentIds: new Set(), paymentIds: [] }
    current.total += toNumber(payment.amount)
    current.studentIds.add(payment.student_id)
    current.paymentIds.push(payment.id || `${payment.student_id}:${payment.month}:${dayKey}`)
    byDay.set(dayKey, current)
  }
  return [...byDay.values()]
    .map((row) => ({
      date: row.date,
      total: row.total,
      count: row.studentIds.size,
      paymentIds: row.paymentIds,
    }))
    .sort((a, b) => b.date.localeCompare(a.date))
}

function exportDailyHistoryToExcel(rows, schoolYearStart, branchId) {
  const workbook = XLSX.utils.book_new()
  const worksheet = XLSX.utils.json_to_sheet(
    rows.map((row) => ({
      Date: formatAccountingDay(row.date),
      'Montant total encaissé': Number(row.total || 0),
      'Élèves facturés / payés': Number(row.count || 0),
    }))
  )
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Historique journalier')
  const fileName = `historique-journalier-${schoolYearStart}-${branchId || 'toutes-succursales'}.xlsx`
  XLSX.writeFile(workbook, fileName)
}

function AdvanceModal({ student, close, onValidate, months }) {
  const [selectedMonths, setSelectedMonths] = useState([])

  const payableMonths = student.payments
    .map((status, index) => ({ month: months[index]?.label || '', index, status }))
    .filter((item) => item.status !== 'paid' && item.status !== 'inactive' && item.status !== 'disabled')

  const paidMonths = student.payments
    .map((status, index) => ({ month: months[index]?.label || '', index, status }))
    .filter((item) => item.status === 'paid')

  const toggleMonth = (index) => {
    setSelectedMonths((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    )
  }

  const monthly = Number(student.monthly) || 0
  const totalAmount = selectedMonths.length * monthly
  const formatAmount = (value) => `${Number(value || 0).toLocaleString('fr-FR')} DH`

  const handleValidate = () => {
    onValidate(selectedMonths)
    close()
  }

  return (
    <div className="fee-overlay">
      <section className="payment-modal">
        <button className="modal-close" onClick={close}>×</button>
        <h2>Avance de paiement</h2>
        <div className="payment-person">
          <i>{initials(student.name)}</i>
          <span>
            <b>{student.name}</b>
            <small>{student.code}</small>
          </span>
        </div>
        <div className="payment-amount">
          <span>Montant dû/mois</span>
          <strong>{formatAmount(monthly)}</strong>
        </div>

        <div className="advance-months-selection">
          <h3>Mois à payer</h3>
          {payableMonths.length > 0 ? (
            <div className="advance-months-grid">
              {payableMonths.map(({ month, index }) => (
                <label
                  key={index}
                  className={`advance-month-checkbox ${selectedMonths.includes(index) ? 'selected' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={selectedMonths.includes(index)}
                    onChange={() => toggleMonth(index)}
                  />
                  <span>{month}</span>
                </label>
              ))}
            </div>
          ) : (
            <p className="advance-empty">Tous les mois de l'année académique sont déjà réglés.</p>
          )}

          <h3>Mois déjà payés</h3>
          <div className="advance-months-grid">
            {paidMonths.map(({ month, index }) => (
              <label key={index} className="advance-month-checkbox disabled">
                <input type="checkbox" disabled />
                <span>{month}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="advance-total">
          <span>Total à payer</span>
          <strong>{formatAmount(totalAmount)}</strong>
        </div>

        <div className="advance-actions">
          <button className="advance-cancel" onClick={close}>Annuler</button>
          <button
            className="validate-button"
            onClick={handleValidate}
            disabled={selectedMonths.length === 0}
          >
            Valider l'avance
          </button>
        </div>
      </section>
    </div>
  )
}

function Receipt({ receipts, close, catalog }) {
  const [isExporting, setIsExporting] = useState(false)

  const allReceipts = useMemo(() => {
    const list = Array.isArray(receipts) ? receipts : [receipts]
    return list.map((r) => ({
      month: r.month,
      monthKey: r.monthKey || '',
      student: r.student,
      lines: studentLineItems(r.student, catalog),
      total: r.student.du_mois || 0,
    }))
  }, [receipts, catalog])

  const dateLabelFor = (receipt) => formatFrenchDate(receiptDateFromRegistration(receipt.student.registrationDate, receipt.monthKey))

  const downloadPdf = async (receipt = allReceipts[0]) => {
    setIsExporting(true)
    try {
      await downloadPdfDocument(
        <FeeReceiptPdf receipt={receipt} dateLabel={dateLabelFor(receipt)} />,
        `recu-paiement-${safeFilename(receipt.student.name)}-${safeFilename(receipt.month)}.pdf`
      )
    } catch (err) {
      console.error(err)
    } finally {
      setIsExporting(false)
    }
  }

  const handleDownloadAll = async () => {
    setIsExporting(true)
    try {
      for (const receipt of allReceipts) {
        await downloadPdfDocument(
          <FeeReceiptPdf receipt={receipt} dateLabel={dateLabelFor(receipt)} />,
          `recu-paiement-${safeFilename(receipt.student.name)}-${safeFilename(receipt.month)}.pdf`
        )
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <main className="fee-receipt">
      <div className="fee-receipt-actions">
        <button onClick={close}>← Retour</button>
        {allReceipts.length > 1 ? (
          <button className="fee-print" disabled={isExporting} onClick={handleDownloadAll}>
            {isExporting ? 'Génération des PDF…' : <><Printer size={18} /> Télécharger tous les reçus</>}
          </button>
        ) : (
          <button className="fee-print" disabled={isExporting} onClick={() => downloadPdf()}>
            {isExporting ? 'Génération du PDF…' : <><Printer size={18} /> Télécharger le reçu</>}
          </button>
        )}
      </div>

      <div className="fee-receipts">
        {allReceipts.map((receipt, index) => (
          <article key={index} className="fee-document">
            <header>
              <div className="fee-brand">
                <img src="/oskar-logo.png" alt="Logo Centre Oskar" />
                <div>
                  <strong>Centre Oskar</strong>
                  <span>Cours particuliers — Agadir</span>
                </div>
              </div>
              <div className="fee-ref">
                <span>REÇU DE PAIEMENT MENSUEL</span>
                <b>{receipt.student.code}</b>
                <small>Date : {formatFrenchDate(receiptDateFromRegistration(receipt.student.registrationDate, receipt.monthKey))}</small>
              </div>
            </header>

            <section className="fee-receipt-student">
              <div>{initials(receipt.student.name)}</div>
              <p>
                <strong>{receipt.student.name}</strong>
                <small>Niveau : {receipt.student.level}</small>
                <small>Mois réglé : {receipt.month}</small>
              </p>
            </section>

            <section className="fee-lines">
              <h2>Détail des matières</h2>
              <div className="fee-line fee-line-head">
                <span>Matière</span>
                <span>Prix</span>
              </div>
              {receipt.lines.map((line) => (
                <div className="fee-line" key={line.name}>
                  <span>{line.name}</span>
                  <span>{line.amount.toLocaleString('fr-FR')} DH</span>
                </div>
              ))}
              <div className="fee-total">
                <b>Montant total payé</b>
                <strong>{receipt.total.toLocaleString('fr-FR')} DH</strong>
              </div>
            </section>

            <div className="fee-confirmation">
              ✓ Paiement reçu en espèces — Le {formatFrenchDate(receiptDateFromRegistration(receipt.student.registrationDate, receipt.monthKey))}
            </div>

            <footer>
              <span>Signature parent/tuteur</span>
              <span>Signature administration</span>
            </footer>
          </article>
        ))}
      </div>
    </main>
  )
}

function RegistrationFeeReceipt({ student, amount, schoolYear, paidAt, close }) {
  const [isExporting, setIsExporting] = useState(false)
  const dateLabel = formatFrenchDate(String(paidAt || new Date().toISOString()).slice(0, 10))

  const downloadPdf = async () => {
    setIsExporting(true)
    try {
      await downloadPdfDocument(
        <RegistrationFeeReceiptPdf student={student} amount={amount} schoolYear={schoolYear} dateLabel={dateLabel} />,
        `recu-inscription-${safeFilename(student.name)}-${safeFilename(schoolYear)}.pdf`
      )
    } catch (err) {
      console.error(err)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <main className="fee-receipt">
      <div className="fee-receipt-actions">
        <button onClick={close}>← Retour</button>
        <button className="fee-print" disabled={isExporting} onClick={downloadPdf}>
          {isExporting ? 'Génération du PDF…' : <><Printer size={18} /> Télécharger le reçu</>}
        </button>
      </div>

      <div className="fee-receipts">
        <article className="fee-document">
          <header>
            <div className="fee-brand">
              <img src="/oskar-logo.png" alt="Logo Centre Oskar" />
              <div>
                <strong>Centre Oskar</strong>
                <span>Cours particuliers — Agadir</span>
              </div>
            </div>
            <div className="fee-ref">
              <span>REÇU DE FRAIS D'INSCRIPTION</span>
              <b>{student.code}</b>
              <small>Date : {dateLabel}</small>
            </div>
          </header>

          <section className="fee-receipt-student">
            {student.photoUrl
              ? <img className="fee-receipt-photo" src={student.photoUrl} alt="" />
              : <div>{initials(student.name)}</div>}
            <p>
              <strong>{student.name}</strong>
              <small>Niveau : {student.level || '—'}</small>
              <small>Année scolaire : {schoolYear}</small>
            </p>
          </section>

          <section className="fee-lines">
            <h2>Détail</h2>
            <div className="fee-line fee-line-head">
              <span>Désignation</span>
              <span>Montant</span>
            </div>
            <div className="fee-line">
              <span>Frais d'inscription — {schoolYear}</span>
              <span>{Number(amount).toLocaleString('fr-FR')} DH</span>
            </div>
            <div className="fee-total">
              <b>Montant total payé</b>
              <strong>{Number(amount).toLocaleString('fr-FR')} DH</strong>
            </div>
          </section>

          <div className="fee-confirmation">
            ✓ Paiement reçu en espèces — Le {dateLabel}
          </div>

          <footer>
            <span>Signature parent/tuteur</span>
            <span>Signature administration</span>
          </footer>
        </article>
      </div>
    </main>
  )
}

function AdvanceReceiptsModal({ receipts, close, onPrint }) {
  const student = receipts[0]?.student

  if (!student) return null

  return (
    <div className="fee-overlay">
      <section className="advance-receipts-modal" role="dialog" aria-modal="true" aria-labelledby="advance-receipts-title">
        <button className="modal-close" onClick={close} aria-label="Fermer">×</button>
        <h2 id="advance-receipts-title">Paiement d'avance</h2>
        <div className="payment-person">
          <i>{initials(student.name)}</i>
          <span><b>{student.name}</b><small>{student.code}</small></span>
          <strong className="advance-monthly-amount"><small>Dû / mois</small>{student.du_mois} DH</strong>
        </div>
        <div className="validated"><Check size={18} /> Avance validée — {receipts.length} reçu{receipts.length > 1 ? 's générés' : ' généré'}</div>
        <div className="advance-receipt-list">
          {receipts.map((item) => (
            <div className="advance-receipt-item" key={item.month}>
              <span>Reçu — {item.month} · {item.student.du_mois} DH</span>
              <button onClick={() => onPrint(item)}><Printer size={18} /> <b>Imprimer</b></button>
            </div>
          ))}
        </div>
        <footer className="advance-receipts-actions">
          <button className="advance-cancel" onClick={close}>Fermer</button>
          <button className="fee-print" onClick={() => onPrint(receipts)}><Printer size={18} /> &nbsp; Imprimer tous les reçus</button>
        </footer>
      </section>
    </div>
  )
}

export default function FeesPage() {
  const { user } = useAuth()
  const { selectedBranch } = useBranch()
  const [students, setStudents] = useState([])
  const [paymentsByStudent, setPaymentsByStudent] = useState({})
  const [payments, setPayments] = useState([])
  const [catalog, setCatalog] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [schoolYearStart, setSchoolYearStart] = useState(String(currentMonthKey().slice(0, 4)))
  const [activeView, setActiveView] = useState('calendar')
  const [historyMode, setHistoryMode] = useState('month')
  const [historyMonth, setHistoryMonth] = useState('')
  const [historyFrom, setHistoryFrom] = useState('')
  const [historyTo, setHistoryTo] = useState('')
  const [selected, setSelected] = useState(null)
  const [editing, setEditing] = useState(null)
  const [receipt, setReceipt] = useState(null)
  const [advance, setAdvance] = useState(null)
  const [advanceReceipts, setAdvanceReceipts] = useState(null)
  const [saving, setSaving] = useState(false)
  const [nowTick, setNowTick] = useState(() => Date.now())
  const [appSettings, setAppSettings] = useState(null)
  const [registrationFees, setRegistrationFees] = useState({})
  const [feeModal, setFeeModal] = useState(null)
  const [feeReceipt, setFeeReceipt] = useState(null)

  const schoolYearKeyLabel = schoolYearLabel(schoolYearStart)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await fetchFeesData(selectedBranch)
      setStudents(data.students)
      setPaymentsByStudent(data.paymentsByStudent)
      setPayments(data.payments || [])
      setCatalog(data.catalog)
    } catch (err) {
      console.error(err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [selectedBranch])

  useEffect(() => {
    let active = true
    fetchFeesData(selectedBranch)
      .then((data) => {
        if (!active) return
        setStudents(data.students)
        setPaymentsByStudent(data.paymentsByStudent)
        setPayments(data.payments || [])
        setCatalog(data.catalog)
      })
      .catch((err) => {
        if (active) {
          console.error(err)
          setError(err.message)
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [selectedBranch])

  useEffect(() => {
    const timer = window.setInterval(() => setNowTick(Date.now()), 60000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    let active = true
    fetchAppSettings()
      .then((settings) => {
        if (active) setAppSettings(settings)
      })
      .catch((err) => console.error(err))
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true
    fetchRegistrationFees(schoolYearKeyLabel)
      .then((rows) => {
        if (active) setRegistrationFees(rows)
      })
      .catch((err) => console.error(err))
    return () => {
      active = false
    }
  }, [schoolYearKeyLabel])

  // Paid registration fees are cash-ins like any other: they feed the day's totals
  // and the daily archive alongside monthly tuition payments. Keep only payments
  // belonging to students shown for the selected branch.
  const allPayments = useMemo(() => {
    const visibleStudentIds = new Set(students.map((student) => student.id))
    const feePayments = Object.values(registrationFees)
      .filter((fee) => fee.status === 'paid' && fee.paid_at)
      .map((fee) => ({
        id: `registration-${fee.id}`,
        student_id: fee.student_id,
        amount: fee.amount,
        paid_at: fee.paid_at,
        status: 'paid',
      }))
    return [...payments, ...feePayments].filter(
      (payment) =>
        visibleStudentIds.has(payment.student_id) &&
        (payment.status === 'paid' || payment.status === 'validé')
    )
  }, [payments, registrationFees, students])

  const dailyHistory = useMemo(
    () =>
      aggregateDailyRows(
        allPayments,
        Object.fromEntries(students.map((student) => [student.id, student])),
        schoolYearStart
      ),
    [allPayments, students, schoolYearStart]
  )

  const shown = useMemo(
    () => students.filter((s) => `${s.name} ${s.code}`.toLowerCase().includes(query.toLowerCase())),
    [students, query]
  )

  // Jour comptable courant (rollover à 3h), à minuit : borne les mois déjà exigibles.
  const today = useMemo(() => parseLocalDate(accountingDayBucket(new Date(nowTick))), [nowTick])

  const schoolMonths = useMemo(() => buildSchoolMonths(schoolYearStart), [schoolYearStart])
  const currentDayKey = normalizeDateKey(new Date(nowTick))
  const currentDayPayments = useMemo(
    () => allPayments.filter((payment) => normalizeDateKey(payment.paid_at || payment.month) === currentDayKey),
    [allPayments, currentDayKey]
  )
  const currentMonthBillableStudents = useMemo(
    () =>
      students.filter(
        (student) => student.active && isEnrolledInMonth(student, currentMonthKey())
      ),
    [students, nowTick]
  )
  const filteredDailyHistory = useMemo(() => {
    const rows = [...dailyHistory]
    if (historyMode === 'month' && historyMonth) {
      return rows.filter((row) => row.date.startsWith(historyMonth))
    }
    if (historyMode === 'range') {
      return rows.filter((row) => {
        if (historyFrom && row.date < historyFrom) return false
        if (historyTo && row.date > historyTo) return false
        return true
      })
    }
    return rows
  }, [dailyHistory, historyMode, historyMonth, historyFrom, historyTo])

  const stats = useMemo(() => {
    const totalCollected = currentDayPayments.reduce((sum, payment) => sum + toNumber(payment.amount), 0)
    const monthlyDue = currentMonthBillableStudents.reduce((sum, student) => sum + toNumber(student.du_mois), 0)
    return {
      totalCollected,
      billed: currentMonthBillableStudents.length,
      dueTotal: monthlyDue,
    }
  }, [currentDayPayments, currentMonthBillableStudents])

  const stateOf = (student, index) => {
    const key = monthDate(index, Number(schoolYearStart))
    if (!isEnrolledInMonth(student, key)) return 'disabled'
    const payment = (paymentsByStudent[student.id] || []).find((p) => normalizeMonthKey(p.month) === key)
    if (payment && (payment.status === 'paid' || payment.status === 'validé')) return 'paid'
    if (!student.active) return 'inactive'
    // Un mois n'est exigible qu'à partir de la date anniversaire de l'inscription
    // (inscrit le 26/07 → échéance le 26 de chaque mois), et non dès le 1er du mois.
    const dueDate = billingDueDate(student.registrationDate, key)
    if (dueDate && today < dueDate) return 'pending'
    return 'unpaid'
  }

  const paymentsOf = (student) => schoolMonths.map((_, index) => stateOf(student, index))

  const registrationFeeOf = (student) => registrationFees[student.id] || null
  const registrationFeeAmountFor = (student) =>
    toNumber(registrationFeeOf(student)?.amount) || toNumber(appSettings?.registrationFee)

  const validateRegistrationFee = async () => {
    if (!feeModal || saving) return
    setSaving(true)
    setError('')
    try {
      const student = feeModal.student
      const amount = registrationFeeAmountFor(student)
      const saved = await payRegistrationFee({
        studentId: student.id,
        schoolYear: schoolYearKeyLabel,
        amount,
        userId: user?.id || null,
      })
      setRegistrationFees((prev) => ({ ...prev, [student.id]: saved }))
      invalidateFeesCache()
      setFeeModal(null)
      setFeeReceipt({ student, amount, paidAt: saved.paid_at })
    } catch (err) {
      console.error(err)
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const openPayment = (student, index) => {
    const status = stateOf(student, index)
    if (status !== 'inactive' && status !== 'disabled') setSelected({ student, index })
  }

  const handleValidate = async () => {
    if (!selected || saving) return
    setSaving(true)
    setError('')
    try {
      const { student, index } = selected
      const month = monthDate(index, Number(schoolYearStart))
      const amount = student.du_mois || 0
      const { error: err } = await supabase
        .from('student_payments')
        .upsert(
          {
            student_id: student.id,
            month,
            amount,
            status: 'paid',
            paid_at: new Date().toISOString(),
            paid_by: user?.id || null,
          },
          { onConflict: 'student_id,month' }
        )
      if (err) throw err
      setPaymentsByStudent((prev) => ({
        ...prev,
        [student.id]: [
          ...(prev[student.id] || []).filter((p) => p.month !== month),
          { month, amount, status: 'paid', paid_at: new Date().toISOString(), paid_by: user?.id || null },
        ],
      }))
      invalidateFeesCache()
      setReceipt({ student: { ...student, du_mois: amount }, month: schoolMonths[index]?.label || '', monthKey: month, catalog })
      setSelected(null)
    } catch (err) {
      console.error(err)
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const validateAdvance = async (selectedMonths) => {
    if (!advance || saving) return
    setSaving(true)
    setError('')
    try {
      const student = advance
      const rows = selectedMonths.map((index) => ({
        student_id: student.id,
        month: monthDate(index, Number(schoolYearStart)),
        amount: student.du_mois || 0,
        status: 'paid',
        paid_at: new Date().toISOString(),
        paid_by: user?.id || null,
      }))
      const { error: err } = await supabase
        .from('student_payments')
        .upsert(rows, { onConflict: 'student_id,month' })
      if (err) throw err
      setPaymentsByStudent((prev) => {
        const next = { ...prev }
        for (const row of rows) {
          next[student.id] = [
            ...(next[student.id] || []).filter((p) => p.month !== row.month),
            { month: row.month, amount: row.amount, status: 'paid', paid_at: row.paid_at, paid_by: row.paid_by },
          ]
        }
        return next
      })
      invalidateFeesCache()
      const generatedReceipts = selectedMonths.map((index) => ({
        student: { ...student, du_mois: student.du_mois || 0 },
        month: schoolMonths[index]?.label || '',
        monthKey: monthDate(index, Number(schoolYearStart)),
      }))
      setAdvance(null)
      setAdvanceReceipts(generatedReceipts)
    } catch (err) {
      console.error(err)
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const openEdit = (student) => {
    setEditing({
      ...student,
      chosen: [...student.chosen],
      subjectDetails: { ...(student.subjectDetails || {}) },
    })
  }

  const toggleSubject = (subject) =>
    setEditing((e) => ({
      ...e,
      chosen: e.chosen.includes(subject) ? e.chosen.filter((s) => s !== subject) : [...e.chosen, subject],
      subjectDetails: {
        ...e.subjectDetails,
        [subject]: e.subjectDetails?.[subject] || { teacher: '', group: '', priceType: 'standard', manualPrice: '' },
      },
    }))

  const setSubjectDetails = (subject, changes) =>
    setEditing((e) => ({ ...e, subjectDetails: { ...e.subjectDetails, [subject]: { ...e.subjectDetails?.[subject], ...changes } } }))

  const editTotal = useMemo(() => {
    if (!editing || !catalog) return 0
    return editing.chosen.reduce((sum, name) => {
      const details = editing.subjectDetails?.[name] || {}
      const value =
        details.priceType === 'manual'
          ? Number(details.manualPrice || 0)
          : priceFor(catalog, editing, name, details)
      return sum + (Number.isFinite(value) ? value : 0)
    }, 0)
  }, [editing, catalog])

  const availableSubjects = useMemo(() => {
    if (!editing || !catalog) return []
    const tariffSubjectIds = new Set(Object.keys(catalog.tariffsByLevelSubject?.[editing.level_id] || {}))
    return catalog.subjects
      .filter((s) => tariffSubjectIds.has(s.id) || editing.chosen.includes(s.name))
      .map((s) => s.name)
  }, [editing, catalog])

  const saveEdit = async () => {
    if (!editing || saving) return
    setSaving(true)
    setError('')
    try {
      await syncSubscriptions(
        editing.id,
        { chosen: editing.chosen, subjectDetails: editing.subjectDetails, level: editing.level },
        catalog
      )
      await supabase.from('students').update({ du_mois: editTotal }).eq('id', editing.id)
      await load()
      invalidateFeesCache()
      setEditing(null)
    } catch (err) {
      console.error(err)
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (receipt) return <Receipt receipts={receipt} close={() => setReceipt(null)} catalog={catalog} />
  if (feeReceipt) {
    return (
      <RegistrationFeeReceipt
        student={feeReceipt.student}
        amount={feeReceipt.amount}
        paidAt={feeReceipt.paidAt}
        schoolYear={schoolYearKeyLabel}
        close={() => setFeeReceipt(null)}
      />
    )
  }

  return (
    <div className="fees-page">
      <Header />
      <main className="fees-content">
        <div className="fees-heading">
          <h1>Comptabilité</h1>
          <p>Gestion financière du centre.</p>
        </div>
        <nav className="accounting-tabs">
          <Link className="active" to="/accounting/fees">Frais de scolarité</Link>
          <Link to="/accounting/delinquencies">Retards & Impayés</Link>
          <Link to="/accounting/salaries">Salaires Profs</Link>
          <Link to="/accounting/expenses">Charges</Link>
          <Link to="/accounting/profit">Bénéfice net</Link>
        </nav>
        <div className="fees-toolbar">
          <label className="fees-year-select">
            <span>Année scolaire</span>
            <select value={schoolYearStart} onChange={(e) => setSchoolYearStart(e.target.value)}>
              {schoolYearOptions().map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <div className="fees-view-switch">
            <button className={activeView === 'calendar' ? 'active' : ''} onClick={() => setActiveView('calendar')}>Calendrier</button>
            <button className={activeView === 'history' ? 'active' : ''} onClick={() => setActiveView('history')}>Historique journalier</button>
          </div>
        </div>
        <section className="fee-stats">
          <article>
            <span>Total encaissé aujourd'hui</span>
            <strong>{stats.totalCollected.toLocaleString('fr-FR')} DH</strong>
            <i className="fee-stat-icon fee-stat-icon--green"><TrendingUp size={20} /></i>
          </article>
          <article>
            <span>Élèves facturés ce mois</span>
            <strong>{stats.billed}</strong>
            <i className="fee-stat-icon"><Users size={20} /></i>
          </article>
          <article>
            <span>Dû mensuel ce mois</span>
            <strong>{stats.dueTotal.toLocaleString('fr-FR')} DH</strong>
            <i className="fee-stat-icon"><Wallet size={20} /></i>
          </article>
        </section>
        {error && <div className="fees-error">Erreur : {error}</div>}
        <label className="fees-search">
          <Search size={22} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher un élève..." />
        </label>
        {activeView === 'history' ? (
          <section className="daily-history-panel">
            <div className="daily-history-toolbar">
              <div className="daily-history-filters">
                <button className={historyMode === 'month' ? 'active' : ''} onClick={() => setHistoryMode('month')}>Par mois</button>
                <button className={historyMode === 'range' ? 'active' : ''} onClick={() => setHistoryMode('range')}>Par plage</button>
              </div>
              <button className="history-export" onClick={() => exportDailyHistoryToExcel(filteredDailyHistory, schoolYearStart, selectedBranch)}>Exporter</button>
            </div>
            {historyMode === 'month' ? (
              <label className="daily-history-month">
                <span>Mois</span>
                <select value={historyMonth} onChange={(e) => setHistoryMonth(e.target.value)}>
                  <option value="">Tous les mois</option>
                  {schoolMonths.map((month) => (
                    <option key={month.key} value={month.key.slice(0, 7)}>{month.label}</option>
                  ))}
                </select>
              </label>
            ) : (
              <div className="daily-history-range">
                <label><span>Du</span><input type="date" value={historyFrom} onChange={(e) => setHistoryFrom(e.target.value)} /></label>
                <label><span>Au</span><input type="date" value={historyTo} onChange={(e) => setHistoryTo(e.target.value)} /></label>
              </div>
            )}
            <div className="daily-history-summary">
              <span>{filteredDailyHistory.length} jour{filteredDailyHistory.length > 1 ? 's' : ''} affiché{filteredDailyHistory.length > 1 ? 's' : ''}</span>
            </div>
            <div className="daily-history-table-wrap">
              <table className="daily-history-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Montant total encaissé</th>
                    <th>Élèves facturés / payés</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDailyHistory.length === 0 ? (
                    <tr><td colSpan={3} className="daily-history-empty">Aucune donnée pour ce filtre.</td></tr>
                  ) : filteredDailyHistory.map((row) => (
                    <tr key={row.date} className={row.date === currentDayKey ? 'current-day' : ''}>
                      <td>{formatAccountingDay(row.date)}</td>
                      <td>{Number(row.total || 0).toLocaleString('fr-FR')} DH</td>
                      <td>{row.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : loading ? (
          <div className="fees-loading">Chargement des frais de scolarité...</div>
        ) : (
          <div className="fees-table-wrap">
            <table className="fees-table">
              <thead>
                <tr>
                  <th>Élève</th>
                  <th>Niveau</th>
                  <th>Matières</th>
                  <th>Dû/mois</th>
                  <th>Frais d'inscription</th>
                  {schoolMonths.map((m) => <th key={m.key}>{m.label}</th>)}
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {shown.map((student) => (
                  <tr key={student.id}>
                    <td>
                      <div className="fee-student">
                        <i>{initials(student.name)}</i>
                        <span><b>{student.name}</b><small>{student.code}</small></span>
                      </div>
                    </td>
                    <td>{student.level}</td>
                    <td>{student.chosen.length}</td>
                    <td><b>{student.du_mois.toLocaleString('fr-FR')} DH</b></td>
                    <td>
                      {registrationFeeOf(student)?.status === 'paid' ? (
                        <span className="registration-badge paid">Payé</span>
                      ) : (
                        <button
                          className="registration-badge unpaid"
                          onClick={() => setFeeModal({ student })}
                          title="Valider le paiement des frais d'inscription"
                        >
                          Impayé
                        </button>
                      )}
                    </td>
                    {schoolMonths.map((month, index) => {
                      const status = stateOf(student, index)
                      return (
                        <td key={index}>
                          <button
                            aria-label={`${month.label} : ${status}`}
                            className={`payment-dot ${status}`}
                            disabled={status === 'inactive' || status === 'disabled'}
                            onClick={() => openPayment(student, index)}
                          />
                        </td>
                      )
                    })}
                    <td>
                      <div className="fee-actions">
                        <button className="fee-edit" onClick={() => openEdit(student)}><Pencil size={23} /></button>
                        <button className="fee-advance" onClick={() => setAdvance(student)} disabled={!student.active} title="Paiement d'avance"><CalendarPlus size={23} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {selected && (
        <div className="fee-overlay">
          <section className="payment-modal">
            <button className="modal-close" onClick={() => setSelected(null)}>×</button>
            <h2>Paiement — {schoolMonths[selected.index]?.label || ''}</h2>
            <div className="payment-person">
              <i>{initials(selected.student.name)}</i>
              <span><b>{selected.student.name}</b><small>{selected.student.code}</small></span>
            </div>
            <div className="payment-amount">
              <span>Montant dû</span>
              <strong>{selected.student.du_mois.toLocaleString('fr-FR')} DH</strong>
            </div>
            {stateOf(selected.student, selected.index) === 'paid' ? (
              <>
                <div className="validated"><Check size={18} /> Paiement validé</div>
                <button
                  className="receipt-button"
                  onClick={() => {
                    setReceipt({ student: selected.student, month: schoolMonths[selected.index]?.label || '', monthKey: monthDate(selected.index, Number(schoolYearStart)), catalog })
                    setSelected(null)
                  }}
                >
                  <Printer size={18} /> &nbsp; Imprimer le reçu
                </button>
              </>
            ) : (
              <button className="validate-button" disabled={saving} onClick={handleValidate}>
                {saving ? 'Enregistrement...' : 'Valider le paiement'}
              </button>
            )}
          </section>
        </div>
      )}

      {feeModal && (
        <div className="fee-overlay">
          <section className="payment-modal">
            <button className="modal-close" onClick={() => setFeeModal(null)}>×</button>
            <h2>Frais d'inscription — {schoolYearKeyLabel}</h2>
            <div className="payment-person">
              <i>{initials(feeModal.student.name)}</i>
              <span><b>{feeModal.student.name}</b><small>{feeModal.student.code}</small></span>
            </div>
            <div className="payment-amount">
              <span>Montant dû</span>
              <strong>{registrationFeeAmountFor(feeModal.student).toLocaleString('fr-FR')} DH</strong>
            </div>
            <button className="validate-button" disabled={saving} onClick={validateRegistrationFee}>
              {saving ? 'Enregistrement...' : 'Valider le paiement'}
            </button>
          </section>
        </div>
      )}

      {editing && (
        <div className="fee-overlay">
          <section className="edit-modal">
            <button className="modal-close" onClick={() => setEditing(null)}>×</button>
            <h2>Modifier les matières & groupes</h2>
            <p>{editing.name} — sélectionnez les matières auxquelles l'élève est inscrit.</p>
            <div className="edit-subjects">
              {availableSubjects.map((subject) => {
                const isSelected = editing.chosen.includes(subject)
                const details = editing.subjectDetails?.[subject] || { teacher: '', group: '', priceType: 'standard', manualPrice: '' }
                return (
                  <article key={subject} className={isSelected ? 'selected' : ''}>
                    <label className="edit-subject-toggle">
                      <input type="checkbox" checked={isSelected} onChange={() => toggleSubject(subject)} />
                      <span>
                        <b>{subject}</b>
                        <small>{priceFor(catalog, editing, subject, details).toLocaleString('fr-FR')} DH/mois</small>
                      </span>
                    </label>
                    {isSelected && (
                      <div className="edit-subject-details">
                        <label>
                          Professeur
                          <select value={details.teacher} onChange={(e) => setSubjectDetails(subject, { teacher: e.target.value })}>
                            <option value="">Choisir un professeur</option>
                            {(catalog.teachers || []).map((teacher) => (
                              <option key={teacher.id} value={teacher.name}>{teacher.name}</option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Groupe
                          <select value={details.group} onChange={(e) => setSubjectDetails(subject, { group: e.target.value })}>
                            <option value="">Choisir un groupe</option>
                            {(catalog.groupsBySubject?.[subject] || []).map((group) => (
                              <option key={group.id} value={group.name}>{group.name}</option>
                            ))}
                          </select>
                        </label>
                        <fieldset>
                          <legend>Tarification</legend>
                          <label className={details.priceType === 'standard' ? 'active' : ''}>
                            <input
                              type="radio"
                              name={`${subject}-price`}
                              checked={details.priceType === 'standard'}
                              onChange={() => setSubjectDetails(subject, { priceType: 'standard' })}
                            />
                            <span><b>Prix standard</b><small>{priceFor(catalog, editing, subject, { ...details, priceType: 'standard' }).toLocaleString('fr-FR')} DH/mois</small></span>
                          </label>
                          <label className={details.priceType === 'manual' ? 'active' : ''}>
                            <input
                              type="radio"
                              name={`${subject}-price`}
                              checked={details.priceType === 'manual'}
                              onChange={() => setSubjectDetails(subject, { priceType: 'manual' })}
                            />
                            <span>
                              <b>Prix manuel</b>
                              <input
                                type="number"
                                min="0"
                                placeholder="Montant DH"
                                disabled={details.priceType !== 'manual'}
                                value={details.manualPrice}
                                onChange={(e) => setSubjectDetails(subject, { manualPrice: e.target.value })}
                              />
                            </span>
                          </label>
                        </fieldset>
                      </div>
                    )}
                  </article>
                )
              })}
            </div>
            <div className="edit-total">
              <span>Total dû / mois</span>
              <strong>{editTotal.toLocaleString('fr-FR')} DH</strong>
            </div>
            <footer>
              <button onClick={() => setEditing(null)}>Annuler</button>
              <button className="validate-button" disabled={saving} onClick={saveEdit}>
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </footer>
          </section>
        </div>
      )}

      {advance && (
        <AdvanceModal
          student={{ ...advance, payments: paymentsOf(advance), monthly: advance.du_mois }}
          close={() => setAdvance(null)}
          onValidate={validateAdvance}
          months={schoolMonths}
        />
      )}
      {advanceReceipts && (
        <AdvanceReceiptsModal
          receipts={advanceReceipts}
          close={() => setAdvanceReceipts(null)}
          onPrint={(items) => {
            setAdvanceReceipts(null)
            setReceipt(items)
          }}
        />
      )}
    </div>
  )
}
