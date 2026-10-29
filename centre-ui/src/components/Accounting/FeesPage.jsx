import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Header from '../shared/Header'
import { CalendarPlus, Check, Pencil, Printer, Search, TrendingUp, Users, Wallet } from 'lucide-react'
import { supabase } from '../../supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { useBranch } from '../../context/BranchContext'
import { safeFilename } from '../../utils/exportToPdf'
import { downloadPdfDocument, printPdfDocument } from '../pdf/downloadPdf'
import FeeReceiptPdf, { FeeReceiptsPdf } from '../pdf/FeeReceiptPdf'
import { syncSubscriptions, isPackageLevel, packagePrice, teacherForGroupSubject } from '../Students/enrollment/enrollmentApi'
import { initials } from '../Students/utils/studentHelpers'
import {
  accountingDayBucket,
  billingDueDate,
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
import { fetchRegistrationFees, recordRegistrationFeePayment, registrationFeeCashPayments } from './registrationFeesApi'
import RegistrationFeeModal from './RegistrationFeeModal'
import RegistrationFeeBadge from './RegistrationFeeBadge'
import { blockSharesOf, isSegmentedPayment as isSegmentedPaymentOf, localMonthKey, monthBalanceOf, monthCoverageOf } from './tuitionCoverage'
import {
  allocateAcrossMonths,
  applySubjectPaymentChanges,
  isMonthClosed,
  laterSubjectSlots,
  openMonthRowsOf,
  paymentRowsLabel,
  resyncAfterDeletion,
  syncMonthSummaries,
  writeSubjectPaymentChanges,
} from './subjectPaymentsApi'
import DailyHistoryPanel from './DailyHistoryPanel'
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

// Début de facturation d'une matière ajoutée depuis la modale d'un mois : ce
// mois-là. Pour le mois en cours on prend l'instant présent, et non le 1er du
// mois, pour qu'un paiement en bloc déjà fait ce mois-ci (1er mois réglé à
// l'inscription, avance) ne soit pas compté comme couvrant la nouvelle matière.
function subjectStartForMonth(monthKey) {
  const now = new Date()
  if (monthKey === localMonthKey(now)) return now.toISOString()
  const [year, month] = monthKey.split('-').map(Number)
  return new Date(year, month - 1, 1).toISOString()
}

// Les rôles qui voient la caisse du centre entier. Les autres (secrétaires) ne
// voient que ce qu'ils ont eux-mêmes encaissé. Même liste que AuthContext.
const CENTER_WIDE_ROLES = ['super_admin', 'admin', 'director']

// amountOf(index) : ce qui reste à payer sur ce mois (moins que le dû mensuel
// si une avance a déjà été versée).
function AdvanceModal({ student, close, onValidate, months, amountOf }) {
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
  const totalAmount = selectedMonths.reduce((sum, index) => sum + amountOf(index), 0)
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
  const [printError, setPrintError] = useState('')

  const allReceipts = useMemo(() => {
    const list = Array.isArray(receipts) ? receipts : [receipts]
    return list.map((r) => ({
      month: r.month,
      monthKey: r.monthKey || '',
      student: r.student,
      // Montants réellement encaissés quand ils sont connus (prix du mois
      // modifié à la validation, ex. demi-mois) ; sinon les prix de l'élève.
      lines: r.lines || studentLineItems(r.student, catalog),
      total: r.total ?? (r.student.du_mois || 0),
      // Avance : ce qui reste dû sur le mois après ce paiement.
      remaining: r.remaining || 0,
    }))
  }, [receipts, catalog])

  const dateLabelFor = (receipt) => formatFrenchDate(receiptDateFromRegistration(receipt.student.registrationDate, receipt.monthKey, receipt.student.paymentDay))

  const many = allReceipts.length > 1

  const handlePrint = async () => {
    setIsExporting(true)
    setPrintError('')
    try {
      await printPdfDocument(<FeeReceiptsPdf receipts={allReceipts} dateLabelFor={dateLabelFor} />)
    } catch (err) {
      console.error(err)
      setPrintError("L'impression n'a pas pu être lancée. Réessayez ou téléchargez le reçu.")
    } finally {
      setIsExporting(false)
    }
  }

  const handleDownload = async () => {
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
        <div className="fee-receipt-buttons">
          <button disabled={isExporting} onClick={handleDownload}>
            {many ? 'Télécharger les PDF' : 'Télécharger le PDF'}
          </button>
          <button className="fee-print" disabled={isExporting} onClick={handlePrint}>
            {isExporting ? 'Préparation…' : <><Printer size={18} /> {many ? 'Imprimer tous les reçus' : 'Imprimer le reçu'}</>}
          </button>
        </div>
      </div>
      {printError && <p className="fee-receipt-error">{printError}</p>}

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
                <small>Date : {formatFrenchDate(receiptDateFromRegistration(receipt.student.registrationDate, receipt.monthKey, receipt.student.paymentDay))}</small>
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
                <b>{receipt.remaining > 0 ? 'Avance payée' : 'Montant total payé'}</b>
                <strong>{receipt.total.toLocaleString('fr-FR')} DH</strong>
              </div>
              {receipt.remaining > 0 && (
                <div className="fee-line">
                  <span>Reste à payer sur ce mois</span>
                  <span>{receipt.remaining.toLocaleString('fr-FR')} DH</span>
                </div>
              )}
            </section>

            <div className="fee-confirmation">
              ✓ {receipt.remaining > 0 ? 'Avance reçue' : 'Paiement reçu'} en espèces — Le {formatFrenchDate(receiptDateFromRegistration(receipt.student.registrationDate, receipt.monthKey, receipt.student.paymentDay))}
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

// amount = somme encaissée par ce reçu ; dueAmount, paidBefore et remaining
// situent ce versement dans les frais de l'année (paiement en plusieurs fois).
function RegistrationFeeReceipt({ student, amount, dueAmount = amount, paidBefore = 0, remaining = 0, schoolYear, paidAt, close }) {
  const [isExporting, setIsExporting] = useState(false)
  const [printError, setPrintError] = useState('')
  const dateLabel = formatFrenchDate(accountingDayBucket(paidAt || new Date()))
  const receiptPdf = (
    <RegistrationFeeReceiptPdf
      student={student}
      amount={amount}
      dueAmount={dueAmount}
      paidBefore={paidBefore}
      remaining={remaining}
      schoolYear={schoolYear}
      dateLabel={dateLabel}
    />
  )

  const printPdf = async () => {
    setIsExporting(true)
    setPrintError('')
    try {
      await printPdfDocument(receiptPdf)
    } catch (err) {
      console.error(err)
      setPrintError("L'impression n'a pas pu être lancée. Réessayez ou téléchargez le reçu.")
    } finally {
      setIsExporting(false)
    }
  }

  const downloadPdf = async () => {
    setIsExporting(true)
    try {
      await downloadPdfDocument(receiptPdf, `recu-inscription-${safeFilename(student.name)}-${safeFilename(schoolYear)}.pdf`)
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
        <div className="fee-receipt-buttons">
          <button disabled={isExporting} onClick={downloadPdf}>Télécharger le PDF</button>
          <button className="fee-print" disabled={isExporting} onClick={printPdf}>
            {isExporting ? 'Préparation…' : <><Printer size={18} /> Imprimer le reçu</>}
          </button>
        </div>
      </div>
      {printError && <p className="fee-receipt-error">{printError}</p>}

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
              <span>{Number(dueAmount).toLocaleString('fr-FR')} DH</span>
            </div>
            {paidBefore > 0 && (
              <div className="fee-line">
                <span>Déjà payé avant</span>
                <span>-{Number(paidBefore).toLocaleString('fr-FR')} DH</span>
              </div>
            )}
            <div className="fee-total">
              <b>{remaining > 0 ? 'Avance payée' : 'Montant total payé'}</b>
              <strong>{Number(amount).toLocaleString('fr-FR')} DH</strong>
            </div>
          </section>

          <div className="fee-confirmation">
            {remaining > 0
              ? `✓ Avance reçue le ${dateLabel} — reste à payer : ${Number(remaining).toLocaleString('fr-FR')} DH`
              : `✓ Paiement reçu en espèces — Le ${dateLabel}`}
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
  const { user, role } = useAuth()
  const { selectedBranch } = useBranch()
  const isCenterWide = CENTER_WIDE_ROLES.includes(role)
  const [students, setStudents] = useState([])
  const [paymentsByStudent, setPaymentsByStudent] = useState({})
  const [paymentSubjectsByStudent, setPaymentSubjectsByStudent] = useState({})
  const [payments, setPayments] = useState([])
  const [cashPayments, setCashPayments] = useState([])
  const [catalog, setCatalog] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [schoolYearStart, setSchoolYearStart] = useState(String(currentMonthKey().slice(0, 4)))
  const [activeView, setActiveView] = useState('calendar')
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
  // Mois consulté pour les cartes de synthèse (Élèves encaissés / Dû mensuel) :
  // permet de vérifier un mois passé ou une avance sur un mois à venir, sans
  // changer d'année scolaire. "Total encaissé aujourd'hui" reste un compteur
  // du jour, indépendant de ce filtre.
  const [statsMonthIndex, setStatsMonthIndex] = useState(() => {
    const key = currentMonthKey()
    const index = buildSchoolMonths(key.slice(0, 4)).findIndex((m) => m.key === key)
    return index >= 0 ? index : 0
  })
  const [paidSelection, setPaidSelection] = useState([])
  // Montant de CE mois, saisi dans la modale de paiement : par matière pour un
  // paiement segmenté, `blockAmount` pour un forfait. Pré-rempli avec le prix
  // habituel, il peut être baissé (élève inscrit en milieu de mois...).
  const [paidAmounts, setPaidAmounts] = useState({})
  // Total payé par matière sur ce mois, saisi dans la même modale. Moins que le
  // prix du mois : une avance (matière en orange) ; plus : le surplus va en
  // avance sur les mois suivants.
  const [paidTotals, setPaidTotals] = useState({})
  const [blockAmount, setBlockAmount] = useState('')
  // Montant augmenté sur une matière déjà payée : « new » (versement reçu
  // aujourd'hui, par défaut) ou « correction » (le dernier versement, à sa date).
  const [increaseModes, setIncreaseModes] = useState({})

  const schoolYearKeyLabel = schoolYearLabel(schoolYearStart)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await fetchFeesData(selectedBranch)
      setStudents(data.students)
      setPaymentsByStudent(data.paymentsByStudent)
      setPaymentSubjectsByStudent(data.paymentSubjectsByStudent || {})
      setPayments(data.payments || [])
      setCashPayments(data.cashPayments || [])
      setCatalog(data.catalog)
      return data
    } catch (err) {
      console.error(err)
      setError(err.message)
      return null
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
        setPaymentSubjectsByStudent(data.paymentSubjectsByStudent || {})
        setPayments(data.payments || [])
        setCashPayments(data.cashPayments || [])
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

  // Un élève sans niveau scolaire ne figure pas dans ce calendrier : ses frais
  // d'inscription se règlent et se comptent sur la page Frais de formation.
  // Les exclure ici est ce qui évite de compter la même somme deux fois.
  const visibleStudentIds = useMemo(
    () => new Set(students.filter((student) => student.level_id).map((student) => student.id)),
    [students]
  )

  // Paid registration fees are cash-ins like any other: they feed the day's totals
  // and the daily archive alongside monthly tuition payments. Keep only payments
  // belonging to students shown for the selected branch.
  //
  // Les mensualités sont les encaissements réels (voir fetchFeesData,
  // cashPayments) : une somme reçue un jour reste comptée ce jour-là, quoi
  // qu'on modifie ensuite sur l'élève (matières, date d'inscription...).
  const allPayments = useMemo(() => {
    // Chaque versement (avance ou solde) compte le jour où il a été reçu.
    const feePayments = registrationFeeCashPayments(registrationFees)
    return [...cashPayments, ...feePayments].filter(
      (payment) =>
        visibleStudentIds.has(payment.student_id) &&
        (payment.status === 'paid' || payment.status === 'validé')
    )
  }, [cashPayments, registrationFees, visibleStudentIds])

  // Portée des encaissements : un rôle « centre » voit toute la caisse, les autres
  // ne voient que ce qu'ils ont eux-mêmes validé. C'est un filtre d'affichage :
  // les lignes restent lisibles côté base, comme partout ailleurs dans l'app.
  const scopedPayments = useMemo(
    () => (isCenterWide ? allPayments : allPayments.filter((payment) => payment.paid_by === user?.id)),
    [allPayments, isCenterWide, user?.id]
  )

  // Un inscrit « formation seule » n'a pas de niveau scolaire : il n'a donc rien
  // à faire dans le calendrier de scolarité. Sa facturation vit entièrement sur
  // la page Frais de formation.
  const shown = useMemo(
    () =>
      students.filter(
        (s) => s.level_id && `${s.name} ${s.code}`.toLowerCase().includes(query.toLowerCase())
      ),
    [students, query]
  )

  // Jour comptable courant (rollover à 3h), à minuit : borne les mois déjà exigibles.
  const today = useMemo(() => parseLocalDate(accountingDayBucket(new Date(nowTick))), [nowTick])

  const schoolMonths = useMemo(() => buildSchoolMonths(schoolYearStart), [schoolYearStart])

  // Changer d'année scolaire ramène le mois consulté sur le mois courant s'il
  // y figure (l'utilisateur reste ensuite libre d'en choisir un autre).
  const changeSchoolYear = (value) => {
    setSchoolYearStart(value)
    const key = currentMonthKey()
    const index = buildSchoolMonths(value).findIndex((m) => m.key === key)
    setStatsMonthIndex(index >= 0 ? index : 0)
  }

  const statsMonthKey = schoolMonths[statsMonthIndex]?.key || currentMonthKey()
  const currentDayKey = normalizeDateKey(new Date(nowTick))
  const currentDayPayments = useMemo(
    () => scopedPayments.filter((payment) => normalizeDateKey(payment.paid_at || payment.month) === currentDayKey),
    [scopedPayments, currentDayKey]
  )
  // Élèves ayant réglé le mois sélectionné (passé, courant, ou avance sur un
  // mois à venir), dédoublonnés : un élève qui règle deux mensualités le même
  // mois ne compte qu'une fois. Basé sur le mois FACTURÉ (payment.month), pas
  // sur la date de paiement : une avance payée aujourd'hui pour décembre
  // compte bien pour décembre.
  // Compté sur les mois intégralement réglés (student_payments), comme avant :
  // un élève qui n'a payé qu'une partie de ses matières n'est pas « encaissé ».
  const selectedMonthCollectedStudents = useMemo(() => {
    const studentIds = new Set()
    for (const payment of payments) {
      if (!visibleStudentIds.has(payment.student_id)) continue
      if (payment.status !== 'paid' && payment.status !== 'validé') continue
      if (!isCenterWide && payment.paid_by !== user?.id) continue
      if (payment.month && normalizeMonthKey(payment.month) === statsMonthKey) studentIds.add(payment.student_id)
    }
    return studentIds.size
  }, [payments, visibleStudentIds, isCenterWide, user?.id, statsMonthKey])
  // Le dû mensuel reste une prévision à l'échelle du centre : il ne dépend d'aucun
  // encaissement, donc d'aucun utilisateur.
  const selectedMonthBillableStudents = useMemo(
    () =>
      students.filter(
        (student) => student.active && isEnrolledInMonth(student, statsMonthKey)
      ),
    [students, statsMonthKey]
  )
  const stats = useMemo(() => {
    const totalCollected = currentDayPayments.reduce((sum, payment) => sum + toNumber(payment.amount), 0)
    const monthlyDue = selectedMonthBillableStudents.reduce((sum, student) => sum + toNumber(student.du_mois), 0)
    return {
      totalCollected,
      billed: selectedMonthCollectedStudents,
      dueTotal: monthlyDue,
    }
  }, [currentDayPayments, selectedMonthBillableStudents, selectedMonthCollectedStudents])

  // Un élève au forfait ou sans matière propre (ex. classes de Coran facturées
  // en bloc) garde l'affichage à un seul rond, comme avant. Les autres sont
  // "segmentés" : un repère par matière choisie.
  const isSegmentedPayment = (student) => isSegmentedPaymentOf(catalog, student)

  // Situation d'un mois, matière par matière :
  //   - due     : matières à régler ce mois-ci. Une matière ajoutée en cours
  //               d'année (startedAt) n'est due qu'à partir de son mois d'ajout ;
  //   - rawPaid : matières qui ont une vraie ligne dans student_payment_subjects ;
  //   - blockCovered : matières couvertes par un paiement en bloc ;
  //   - paid    : matières à considérer comme réglées.
  // La ligne student_payments d'un mois réglé matière par matière n'est qu'un
  // résumé « mois complet » : elle ne dit pas quelles matières elle couvrait,
  // et compter toutes les matières actuelles comme payées ferait passer une
  // matière ajoutée après coup pour réglée. Seul un paiement en bloc (avance,
  // 1er mois à l'inscription, paiement ancien — voir isBlockPayment) couvre
  // des matières sans ligne : celles déjà suivies au moment du paiement.
  // asOfDay (jour comptable) : la situation telle qu'elle était à la fin de ce
  // jour, sans les encaissements reçus après (détail de l'historique).
  // La règle elle-même est partagée avec les retards : voir tuitionCoverage.js.
  const monthCoverage = (student, index, asOfDay = null) =>
    monthCoverageOf({
      student,
      monthKey: monthDate(index, Number(schoolYearStart)),
      payments: paymentsByStudent[student.id] || [],
      subjectRows: paymentSubjectsByStudent[student.id] || [],
      asOfDay,
    })

  // Mois réglé en bloc : ce que chaque matière a réellement reçu (voir
  // blockSharesOf). La fenêtre de paiement et le reçu montrent l'argent reçu,
  // pas le prix actuel de la matière, qui a pu changer depuis.
  const monthBlockShares = (student, index, coverage = monthCoverage(student, index)) =>
    blockSharesOf({ student, catalog, coverage })

  // Un mois reste modifiable par tous jusqu'à sa fin. Ensuite il est clôturé :
  // hors rôle « centre », on peut encore y encaisser (un retard), mais plus
  // décocher, réduire ni changer le prix de ce qui y est déjà payé.
  const monthClosedFor = (index) => !isCenterWide && isMonthClosed(monthDate(index, Number(schoolYearStart)))

  // Une matière couverte par un paiement en bloc reste figée tant que le mois
  // n'est pas détaillé par matière (voir detailBlockMonth).
  const lockedPaidSubjects = (student, index) => {
    const { rows, blockCovered } = monthCoverage(student, index)
    const locked = {}
    for (const name of blockCovered) locked[name] = 'block'
    if (!monthClosedFor(index)) return locked
    for (const name of student.chosen) {
      const subjectId = student.subjectDetails?.[name]?.subject_id
      if (!locked[name] && rows.some((r) => r.subject_id === subjectId)) locked[name] = 'closed'
    }
    return locked
  }

  const stateOf = (student, index) => {
    const key = monthDate(index, Number(schoolYearStart))
    if (!isEnrolledInMonth(student, key)) return 'disabled'
    if (isSegmentedPayment(student)) {
      // Payé seulement si TOUTES les matières dues ce mois-ci le sont.
      const { payment, paid, due } = monthCoverage(student, index)
      if (due.length > 0 ? due.every((name) => paid.includes(name)) : Boolean(payment)) return 'paid'
    } else {
      const payment = (paymentsByStudent[student.id] || []).find((p) => normalizeMonthKey(p.month) === key)
      if (payment && (payment.status === 'paid' || payment.status === 'validé')) return 'paid'
    }
    if (!student.active) return 'inactive'
    // Un mois n'est exigible qu'à partir du jour de paiement de l'élève
    // (jour 26 → échéance le 26 de chaque mois), et non dès le 1er du mois.
    const dueDate = billingDueDate(student.registrationDate, key, student.paymentDay)
    if (dueDate && today < dueDate) return 'pending'
    return 'unpaid'
  }

  const paymentsOf = (student) => schoolMonths.map((_, index) => stateOf(student, index))

  const studentsById = useMemo(() => Object.fromEntries(students.map((s) => [s.id, s])), [students])

  // Reste à régler sur un mois, à la fin d'un jour donné : les matières dues
  // pas encore payées à leur prix habituel, et le reste des avances. Même règle
  // que le calendrier et les retards (tuitionCoverage.js).
  const monthRemainingAsOf = (student, monthKey, dayKey) => {
    if (!schoolMonths.some((m) => m.key === monthKey)) return null
    return monthBalanceOf({
      student,
      catalog,
      monthKey,
      payments: paymentsByStudent[student.id] || [],
      subjectRows: paymentSubjectsByStudent[student.id] || [],
      asOfDay: dayKey,
    }).remaining
  }

  const subjectNameOf = (student, subjectId) =>
    Object.keys(student.subjectDetails || {}).find((name) => student.subjectDetails[name]?.subject_id === subjectId) ||
    Object.entries(catalog?.subjectsByName || {}).find(([, subject]) => subject?.id === subjectId)?.[0] ||
    'Matière retirée'

  // Détail d'une ligne de l'historique journalier : par élève, ce qui a été
  // encaissé ce jour-là et ce qui restait à régler sur les mois concernés.
  const describeDayPayments = (dayPayments, dayKey) => {
    const byStudent = new Map()
    for (const payment of dayPayments) {
      if (!byStudent.has(payment.student_id)) byStudent.set(payment.student_id, [])
      byStudent.get(payment.student_id).push(payment)
    }
    return [...byStudent.entries()]
      .map(([studentId, list]) => {
        const student = studentsById[studentId]
        const lines = []
        const months = new Set()
        for (const payment of list) {
          const amount = toNumber(payment.amount)
          if (String(payment.id).startsWith('registration-')) {
            lines.push({ label: "Frais d'inscription", month: '', amount })
            continue
          }
          const monthKey = normalizeMonthKey(payment.month)
          months.add(monthKey)
          const month = monthLabelOf(monthKey)
          if (payment.subject_id) {
            lines.push({ label: student ? subjectNameOf(student, payment.subject_id) : 'Matière', month, amount })
          } else if (student && isSegmentedPayment(student)) {
            // Paiement en bloc : les matières qu'il couvrait.
            const index = schoolMonths.findIndex((m) => m.key === monthKey)
            const covered = index >= 0 ? monthCoverage(student, index, dayKey).blockCovered : []
            lines.push({ label: covered.length ? covered.join(', ') : 'Mois complet', month, amount })
          } else {
            lines.push({ label: student ? studentLineItems(student, catalog)[0]?.name || 'Forfait' : 'Forfait', month, amount })
          }
        }
        const remainders = student ? [...months].map((key) => monthRemainingAsOf(student, key, dayKey)) : []
        return {
          id: studentId,
          name: student?.name || 'Élève supprimé',
          code: student?.code || '',
          registrationDate: student?.registrationDate || '',
          lines,
          total: lines.reduce((sum, line) => sum + line.amount, 0),
          remaining: remainders.length && remainders.every((value) => value != null)
            ? remainders.reduce((sum, value) => sum + value, 0)
            : null,
        }
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
  }


  const registrationFeeOf = (student) => registrationFees[student.id] || null

  // dueAmount : montant des frais (ajustable) ; paidAmount : tout le reste ou
  // une avance saisie par la secrétaire.
  const validateRegistrationFee = async ({ dueAmount, paidAmount }) => {
    if (!feeModal || saving) return
    setSaving(true)
    setError('')
    try {
      const student = feeModal.student
      const paidBefore = registrationFeeOf(student)?.paidTotal || 0
      const { fee, paidNow, paidAt } = await recordRegistrationFeePayment({
        studentId: student.id,
        schoolYear: schoolYearKeyLabel,
        dueAmount,
        paidAmount,
        userId: user?.id || null,
      })
      setRegistrationFees((prev) => ({ ...prev, [student.id]: fee }))
      invalidateFeesCache()
      setFeeModal(null)
      setFeeReceipt({ student, amount: paidNow, dueAmount: fee.amount, paidBefore, remaining: fee.remaining, paidAt })
    } catch (err) {
      console.error(err)
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const monthPaymentOf = (student, index) => {
    const key = monthDate(index, Number(schoolYearStart))
    return (paymentsByStudent[student.id] || []).find((p) => normalizeMonthKey(p.month) === key) || null
  }

  // Prix de cette matière ce mois-ci : celui enregistré avec ses versements
  // (demi-mois, remise), sinon son prix habituel.
  const monthSubjectAmount = (student, index, name) =>
    monthCoverage(student, index).bySubject[name]?.dueAmount ?? priceFor(catalog, student, name)

  const monthBlockAmount = (student, index) => {
    const payment = monthPaymentOf(student, index)
    return payment ? toNumber(payment.amount) : student.du_mois || 0
  }

  // Valeur saisie dans la modale ; une case vide ou invalide retombe sur le prix habituel.
  const enteredAmount = (value, fallback) => {
    const amount = Number(String(value ?? '').replace(',', '.'))
    return String(value ?? '').trim() !== '' && Number.isFinite(amount) && amount >= 0 ? amount : fallback
  }
  const selectedSubjectAmount = (name) =>
    enteredAmount(paidAmounts[name], priceFor(catalog, selected.student, name))
  // Total payé pour la matière ce mois-ci, tel que saisi (vide = le prix du mois).
  const selectedSubjectPaid = (name) => enteredAmount(paidTotals[name], selectedSubjectAmount(name))
  // Matière pas encore payée : « Payé » suit le prix (payer le mois entier par
  // défaut). Matière déjà encaissée : « Payé » reste la somme réellement reçue,
  // seul le prix change — remonter le prix d'un mois sous-payé (375 DH reçus
  // sur 400) fait apparaître le reste dû au lieu d'encaisser une somme fictive.
  const setSubjectDue = (name, value) => {
    const alreadyPaid = selectedCoverage?.bySubject[name]?.paidAmount || 0
    if (alreadyPaid === 0 && selectedSubjectPaid(name) === selectedSubjectAmount(name)) {
      setPaidTotals((prev) => ({ ...prev, [name]: value }))
    }
    setPaidAmounts((prev) => ({ ...prev, [name]: value }))
  }
  // Saisir ce qui est payé coche la matière.
  const setSubjectPaid = (name, value) => {
    setPaidTotals((prev) => ({ ...prev, [name]: value }))
    setPaidSelection((prev) => (prev.includes(name) ? prev : [...prev, name]))
  }
  // Matières proposées dans la modale de validation : celles dues ce mois-là.
  const selectedCoverage = selected ? monthCoverage(selected.student, selected.index) : null
  // Ce qui est déjà enregistré pour ce mois (pas la saisie en cours) : réglé ou reste dû.
  const selectedSaved = selected && catalog
    ? monthBalanceOf({
        student: selected.student,
        catalog,
        monthKey: monthDate(selected.index, Number(schoolYearStart)),
        payments: paymentsByStudent[selected.student.id] || [],
        subjectRows: paymentSubjectsByStudent[selected.student.id] || [],
      })
    : null
  const selectedDue = selectedCoverage?.due || []
  const selectedLocked = selected ? lockedPaidSubjects(selected.student, selected.index) : {}
  // Forfait déjà réglé : corrigeable et annulable par tous tant que le mois
  // n'est pas terminé ; ensuite, par un rôle « centre » seulement.
  const selectedBlockPayment = selected ? monthPaymentOf(selected.student, selected.index) : null
  const selectedBlockLocked = Boolean(selectedBlockPayment) && monthClosedFor(selected.index)

  // Versements déjà reçus pour une matière de la modale, du plus ancien au
  // plus récent : « 75 DH le 18/10 · 75 DH le 05/11 ».
  const selectedPaymentsLabel = (name) =>
    [...(selectedCoverage?.bySubject[name]?.rows || [])]
      .sort((a, b) => new Date(a.paid_at || 0) - new Date(b.paid_at || 0))
      .map((row) => `${toNumber(row.amount).toLocaleString('fr-FR')} DH le ${formatFrenchDate(normalizeDateKey(row.paid_at))}`)
      .join(' · ')

  // Reçu d'un mois déjà payé : les montants enregistrés, pas les prix du moment.
  const receiptFor = (student, index) => {
    const monthKey = monthDate(index, Number(schoolYearStart))
    const base = { student, month: schoolMonths[index]?.label || '', monthKey, catalog }
    // Mois réglé matière par matière, même en partie (avance) : chaque ligne
    // porte ce qui a été payé.
    if (isSegmentedPayment(student) && monthCoverage(student, index).rows.length > 0) {
      return subjectsReceiptFor(student, index)
    }
    const payment = monthPaymentOf(student, index)
    if (!payment) return base
    const total = toNumber(payment.amount)

    // Forfait : une seule ligne, au montant encaissé.
    if (!isSegmentedPayment(student)) {
      const [line] = studentLineItems(student, catalog)
      return { ...base, total, lines: [{ name: line?.name || 'Forfait', amount: total }] }
    }

    // Mois payé en bloc (avance, 1er mois à l'inscription) : pas de détail par
    // matière ; chaque matière que ce paiement couvrait porte sa part de la
    // somme encaissée.
    const coverage = monthCoverage(student, index)
    const shares = monthBlockShares(student, index, coverage)
    return {
      ...base,
      total,
      lines: coverage.paid.map((name) => ({ name, amount: shares[name] ?? priceFor(catalog, student, name) })),
    }
  }

  // Reçu d'un mois réglé matière par matière, entièrement ou en partie (avance) :
  // ce qui a été payé par matière, et ce qui reste dû sur le mois.
  const subjectsReceiptFor = (student, index, subjectRows = paymentSubjectsByStudent[student.id] || [], extraLines = []) => {
    const monthKey = monthDate(index, Number(schoolYearStart))
    const balance = monthBalanceOf({
      student,
      catalog,
      monthKey,
      payments: paymentsByStudent[student.id] || [],
      subjectRows,
    })
    const shares = blockSharesOf({ student, catalog, coverage: balance })
    const lines = [
      ...balance.due
        .map((name) => ({
          name,
          amount: shares[name] ?? balance.bySubject[name].paidAmount,
        }))
        .filter((line) => line.amount > 0 || balance.paid.includes(line.name)),
      ...extraLines,
    ]
    return {
      student,
      month: schoolMonths[index]?.label || '',
      monthKey,
      catalog,
      total: lines.reduce((sum, line) => sum + line.amount, 0),
      lines,
      remaining: balance.settled ? 0 : balance.remaining,
    }
  }

  // Ouvre la modale sur un mois, d'après ces versements : ceux de l'écran, ou
  // ceux qu'on vient de recharger (après « Détailler par matière »).
  const showPaymentForm = (student, index, payments, subjectRows) => {
    const coverage = monthCoverageOf({ student, monthKey: monthDate(index, Number(schoolYearStart)), payments, subjectRows })
    // Matières réglées en bloc : prix et payé de CE mois = leur part du bloc.
    const shares = blockSharesOf({ student, catalog, coverage })
    const monthAmount = (name) => shares[name] ?? coverage.bySubject[name]?.dueAmount ?? priceFor(catalog, student, name)
    setSelected({ student, index })
    // Cochées : les matières qui ont déjà un versement ce mois-ci (soldées ou avance).
    setPaidSelection([...coverage.paid, ...coverage.partial])
    setPaidAmounts(Object.fromEntries(student.chosen.map((name) => [name, String(monthAmount(name))])))
    setPaidTotals(
      Object.fromEntries(
        student.chosen.map((name) => {
          const paidAmount = shares[name] ?? coverage.bySubject[name]?.paidAmount ?? 0
          return [name, String(paidAmount > 0 ? paidAmount : monthAmount(name))]
        })
      )
    )
    setIncreaseModes({})
  }

  const openPayment = (student, index) => {
    const status = stateOf(student, index)
    if (status === 'inactive' || status === 'disabled') return
    showPaymentForm(student, index, paymentsByStudent[student.id] || [], paymentSubjectsByStudent[student.id] || [])
    setBlockAmount(String(monthBlockAmount(student, index)))
  }

  // Dernier versement d'une matière dans la modale (celui qu'une correction modifie).
  const latestPaymentOf = (name) =>
    [...(selectedCoverage?.bySubject[name]?.rows || [])].sort((a, b) => new Date(b.paid_at || 0) - new Date(a.paid_at || 0))[0] || null
  const setIncreaseMode = (name, mode) => setIncreaseModes((prev) => ({ ...prev, [name]: mode }))

  // Un mois payé en bloc ne se modifie pas matière par matière : on le détaille
  // d'abord. Chaque matière reçoit sa part du bloc (blockSharesOf), à la date
  // et au nom du paiement d'origine — la caisse ne change pas. Son prix pour ce
  // mois est cette part (au plus son prix habituel) : le mois reste réglé comme
  // avant, et chaque matière devient modifiable.
  const detailBlockMonth = async () => {
    if (!selected || saving) return
    const { student, index } = selected
    if (monthClosedFor(index)) return
    const month = monthDate(index, Number(schoolYearStart))
    const coverage = monthCoverage(student, index)
    if (!coverage.block || coverage.blockCovered.length === 0) return
    setSaving(true)
    setError('')
    try {
      const shares = monthBlockShares(student, index, coverage)
      const inserts = coverage.blockCovered
        .map((name) => {
          const subjectId = student.subjectDetails?.[name]?.subject_id
          if (!subjectId) return null
          const share = shares[name] ?? 0
          return {
            student_id: student.id,
            subject_id: subjectId,
            month,
            amount: share,
            due_amount: Math.min(share, priceFor(catalog, student, name)),
            paid_at: coverage.block.paid_at,
            paid_by: coverage.block.paid_by || null,
          }
        })
        .filter(Boolean)
      await writeSubjectPaymentChanges({ inserts })
      let data = await load()
      const fresh = data?.students.find((item) => item.id === student.id)
      if (fresh) {
        // L'ancienne ligne du bloc devient le résumé « mois complet » si le
        // mois est réglé, et disparaît sinon (voir syncMonthSummaries).
        const rows = data.paymentSubjectsByStudent[fresh.id] || []
        await syncMonthSummaries({
          student: fresh,
          catalog: data.catalog,
          monthKeys: [month],
          payments: data.paymentsByStudent[fresh.id] || [],
          subjectRows: rows,
          previousRows: rows,
          userId: user?.id || null,
        })
        data = await load()
      }
      invalidateFeesCache()
      const reloaded = data?.students.find((item) => item.id === student.id)
      if (reloaded) {
        showPaymentForm(reloaded, index, data.paymentsByStudent[reloaded.id] || [], data.paymentSubjectsByStudent[reloaded.id] || [])
      } else {
        setSelected(null)
      }
    } catch (err) {
      console.error(err)
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleValidate = async () => {
    if (!selected || saving) return
    setSaving(true)
    setError('')
    try {
      const { student, index } = selected
      const month = monthDate(index, Number(schoolYearStart))

      if (!isSegmentedPayment(student)) {
        // Forfait / sans matière propre : un seul bloc, au montant saisi
        // (le forfait habituel par défaut).
        const amount = enteredAmount(blockAmount, student.du_mois || 0)
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
        invalidateFeesCache()
        // Recharge : la caisse du jour doit inclure ce paiement tout de suite.
        await load()
        const [line] = studentLineItems(student, catalog)
        setReceipt({
          student,
          month: schoolMonths[index]?.label || '',
          monthKey: month,
          catalog,
          total: amount,
          lines: [{ name: line?.name || 'Forfait', amount }],
        })
        setSelected(null)
        return
      }

      // Paiement par matière : chaque somme reçue est une ligne de
      // student_payment_subjects, comptée dans la caisse du jour où elle a été
      // reçue. On compare le total payé saisi à ce qui est déjà encaissé :
      //   - plus : un nouveau versement, ce mois-ci jusqu'à son prix, le
      //     surplus en avance sur les mois suivants ;
      //   - moins : correction, en retirant les versements les plus récents ;
      //   - décochée : tous ses versements du mois sont annulés.
      const coverage = monthCoverage(student, index)
      const { blockCovered, due } = coverage
      const locked = lockedPaidSubjects(student, index)
      // Une matière retirée de l'élève entre-temps n'est plus proposée ; une
      // matière figée (payée en bloc ou un jour passé) reste cochée.
      const selection = [
        ...new Set([...paidSelection.filter((name) => due.includes(name) && !locked[name]), ...due.filter((name) => locked[name])]),
      ]
      const nowIso = new Date().toISOString()
      const userId = user?.id || null
      const subjectRows = paymentSubjectsByStudent[student.id] || []
      const changes = { inserts: [], updates: [], deletes: [] }
      const touchedMonths = new Set([month])
      const advanceLines = []
      const pastDays = []
      const monthLabel = schoolMonths[index]?.label || ''
      const closed = monthClosedFor(index)

      for (const name of due) {
        // Couverte par un paiement en bloc : déjà comptée, en entier, le jour
        // où le bloc a été reçu.
        if (blockCovered.includes(name)) continue
        const subjectId = student.subjectDetails?.[name]?.subject_id
        if (!subjectId) continue
        const status = coverage.bySubject[name]
        const dueAmount = selectedSubjectAmount(name)
        const checked = selection.includes(name)
        const target = checked ? selectedSubjectPaid(name) : 0
        const already = status.paidAmount
        // Mois terminé (hors rôle « centre ») : on peut encore y encaisser, mais
        // ce qui est déjà payé ne se réduit plus et son prix ne change plus.
        if (locked[name] === 'closed') {
          if (target < already) {
            throw new Error(`${monthLabel} est terminé : seul un administrateur peut réduire ou annuler le paiement de ${name}.`)
          }
          if (dueAmount !== monthSubjectAmount(student, index, name)) {
            throw new Error(`${monthLabel} est terminé : seul un administrateur peut changer le prix de ${name}.`)
          }
        }
        // Montant augmenté sur une matière déjà payée : un nouveau versement
        // reçu aujourd'hui, ou la correction du dernier versement, qui garde sa
        // date et son auteur — l'historique de la caisse ne bouge pas.
        const latestRow = [...status.rows].sort((a, b) => new Date(b.paid_at || 0) - new Date(a.paid_at || 0))[0]
        const correction = target > already && already > 0 && Boolean(latestRow) && !closed && increaseModes[name] === 'correction'
        const newRow = (monthKey, amount, dueOfMonth) => ({
          student_id: student.id,
          subject_id: subjectId,
          month: monthKey,
          amount,
          due_amount: dueOfMonth,
          paid_at: correction ? latestRow.paid_at : nowIso,
          paid_by: correction ? latestRow.paid_by ?? userId : userId,
        })

        if (target > already) {
          const extra = target - already
          const forThisMonth = Math.min(extra, Math.max(0, dueAmount - already))
          if (correction) {
            if (forThisMonth > 0) {
              changes.updates.push({ id: latestRow.id, changes: { amount: toNumber(latestRow.amount) + forThisMonth } })
            }
            const day = normalizeDateKey(latestRow.paid_at)
            if (day && day !== currentDayKey) pastDays.push(day)
          } else if (forThisMonth > 0) {
            changes.inserts.push(newRow(month, forThisMonth, dueAmount))
          }
          const surplus = extra - forThisMonth
          if (surplus > 0) {
            const { parts, rest } = allocateAcrossMonths(
              surplus,
              laterSubjectSlots({ student, catalog, name, afterMonthKey: month, payments: paymentsByStudent[student.id] || [], subjectRows })
            )
            if (rest > 0) throw new Error(`Le montant payé pour ${name} dépasse ce qui reste à payer jusqu'en août.`)
            for (const part of parts) {
              changes.inserts.push(newRow(part.monthKey, part.amount, part.dueAmount))
              touchedMonths.add(part.monthKey)
              advanceLines.push({ name: `${name} — avance ${monthLabelOf(part.monthKey)}`, amount: part.amount })
            }
          }
        } else if (checked && target === 0 && already === 0 && dueAmount === 0) {
          // Matière offerte ce mois-ci : réglée sans encaissement.
          changes.inserts.push(newRow(month, 0, 0))
        } else if (target < already) {
          let excess = already - target
          for (const row of [...status.rows].sort((a, b) => new Date(b.paid_at || 0) - new Date(a.paid_at || 0))) {
            if (excess <= 0) break
            const amount = toNumber(row.amount)
            if (amount <= excess) changes.deletes.push(row.id)
            else changes.updates.push({ id: row.id, changes: { amount: amount - excess } })
            excess -= Math.min(amount, excess)
            const day = normalizeDateKey(row.paid_at)
            if (day && day !== currentDayKey) pastDays.push(day)
          }
        }

        // Le prix du mois est porté par chacun des versements de la matière.
        // Une ligne ancienne (sans prix) qu'on ne touche pas reste telle quelle.
        const untouched = target === already && dueAmount === status.dueAmount
        for (const row of status.rows) {
          if (changes.deletes.includes(row.id) || row.due_amount === dueAmount) continue
          if (untouched && row.due_amount == null) continue
          const update = changes.updates.find((u) => u.id === row.id)
          if (update) update.changes.due_amount = dueAmount
          else changes.updates.push({ id: row.id, changes: { due_amount: dueAmount } })
        }
      }

      // Corriger un encaissement d'un jour passé change la caisse de ce
      // jour-là : on le dit clairement avant de le faire.
      if (pastDays.length > 0) {
        const days = [...new Set(pastDays)].map((day) => formatFrenchDate(day)).join(', ')
        const ok = window.confirm(
          `Attention : cette correction modifie la caisse déjà enregistrée le ${days}. Continuer ?`
        )
        if (!ok) return
      }

      await writeSubjectPaymentChanges(changes)
      // student_payments (le résumé "mois complet") suit, pour ce mois et ceux
      // qui ont reçu une avance : présent seulement si TOUTES les matières du
      // mois sont soldées — c'est ce que lisent le Dashboard et les Rapports.
      const nextRows = applySubjectPaymentChanges(subjectRows, changes)
      await syncMonthSummaries({
        student,
        catalog,
        monthKeys: [...touchedMonths],
        payments: paymentsByStudent[student.id] || [],
        subjectRows: nextRows,
        previousRows: subjectRows,
        userId,
      })

      invalidateFeesCache()
      await load()
      // Reçu dès qu'une somme a été reçue : mois soldé, ou avance (le reçu
      // indique alors ce qui reste dû sur le mois).
      const nextReceipt = subjectsReceiptFor(student, index, nextRows, advanceLines)
      if (changes.inserts.some((row) => row.amount > 0) || nextReceipt.remaining === 0) setReceipt(nextReceipt)
      setSelected(null)
    } catch (err) {
      console.error(err)
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  // Corriger (ou annuler) le paiement d'un mois au forfait déjà réglé, ex. un
  // demi-mois saisi sur le mauvais mois. Le paiement garde sa date et son
  // auteur : c'est la caisse de CE jour-là qui est corrigée, après
  // confirmation explicite si ce n'est pas aujourd'hui.
  const correctBlockPayment = async (cancel) => {
    if (!selected || saving) return
    const { student, index } = selected
    const month = monthDate(index, Number(schoolYearStart))
    const payment = monthPaymentOf(student, index)
    if (!payment) return
    // Mois terminé : seul un rôle « centre » corrige ou annule le forfait.
    if (selectedBlockLocked) return
    const previous = toNumber(payment.amount)
    const amount = enteredAmount(blockAmount, previous)
    if (!cancel && amount === previous) return

    const label = schoolMonths[index]?.label || ''
    const day = normalizeDateKey(payment.paid_at)
    let message = cancel
      ? `Annuler le paiement de ${label} (${previous.toLocaleString('fr-FR')} DH) pour ${student.name} ?`
      : `Corriger le paiement de ${label} pour ${student.name} : ${previous.toLocaleString('fr-FR')} DH → ${amount.toLocaleString('fr-FR')} DH ?`
    if (day && day !== currentDayKey) message += `\n\nAttention : la caisse du ${formatFrenchDate(day)} sera modifiée.`
    if (!window.confirm(message)) return

    setSaving(true)
    setError('')
    try {
      const query = cancel
        ? supabase.from('student_payments').delete()
        : supabase.from('student_payments').update({ amount })
      const { error: err } = await query.eq('student_id', student.id).eq('month', month)
      if (err) throw err
      invalidateFeesCache()
      await load()
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
      const nowIso = new Date().toISOString()
      // Mois sans rien de payé : un paiement en bloc, comme avant. Mois déjà
      // réglé en partie : on complète matière par matière (les matières déjà
      // payées, et un éventuel bloc déjà reçu, ne sont pas touchés).
      const newSubjectRows = []
      const summaryRows = []
      for (const index of selectedMonths) {
        const month = monthDate(index, Number(schoolYearStart))
        const coverage = isSegmentedPayment(student) ? monthCoverage(student, index) : null
        if (!coverage || (coverage.rows.length === 0 && !coverage.block)) {
          summaryRows.push({
            student_id: student.id,
            month,
            amount: student.du_mois || 0,
            status: 'paid',
            paid_at: nowIso,
            paid_by: user?.id || null,
          })
          continue
        }
        // Matière partielle (avance déjà versée) : seul le reste est encaissé.
        for (const name of coverage.due.filter((n) => !coverage.paid.includes(n))) {
          const status = coverage.bySubject[name]
          const price = priceFor(catalog, student, name)
          newSubjectRows.push({
            student_id: student.id,
            subject_id: student.subjectDetails?.[name]?.subject_id,
            month,
            amount: status.partial ? status.remaining : price,
            due_amount: status.partial ? status.dueAmount : price,
            paid_at: nowIso,
            paid_by: user?.id || null,
          })
        }
        if (!coverage.block) {
          summaryRows.push({
            student_id: student.id,
            month,
            amount: coverage.due.reduce((sum, name) => sum + monthSubjectAmount(student, index, name), 0),
            status: 'paid',
            paid_at: nowIso,
            paid_by: user?.id || null,
          })
        }
      }
      await writeSubjectPaymentChanges({ inserts: newSubjectRows })
      if (summaryRows.length > 0) {
        const { error: err } = await supabase
          .from('student_payments')
          .upsert(summaryRows, { onConflict: 'student_id,month' })
        if (err) throw err
      }
      await load()
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

  // `paymentIndex` : la modale a été ouverte depuis la validation d'un mois.
  // Les matières ajoutées démarrent alors à ce mois-là, et on revient sur la
  // validation une fois l'enregistrement fait.
  const openEdit = (student, paymentIndex = null) => {
    setError('')
    setEditing({
      ...student,
      chosen: [...student.chosen],
      // Matières d'origine : une matière retirée qui a des versements sur un
      // mois encore ouvert demande de les garder ou de les supprimer.
      originalChosen: [...student.chosen],
      removedPayments: {},
      subjectDetails: { ...(student.subjectDetails || {}) },
      // Au forfait il n'y a qu'un montant à revoir, pas une liste de matières.
      packageAmount: String(student.du_mois ?? ''),
      paymentIndex,
    })
  }

  const toggleSubject = (subject) =>
    setEditing((e) => ({
      ...e,
      chosen: e.chosen.includes(subject) ? e.chosen.filter((s) => s !== subject) : [...e.chosen, subject],
      subjectDetails: {
        ...e.subjectDetails,
        [subject]: e.subjectDetails?.[subject] || { teacher: '', group_id: '', group: '', priceType: 'standard', manualPrice: '' },
      },
    }))

  // Les groupes proposés pour une matière, plus celui déjà enregistré s'il n'y
  // figure pas — un groupe sans matière propre n'apparaît sinon nulle part, le
  // menu s'affiche vide, et l'enregistrement détache l'élève de son groupe.
  const groupOptionsFor = (subject, details) => {
    // Les groupes sont organisés par niveau (un groupe enseigne plusieurs
    // matières) et n'ont en général pas de subject_id : chercher par matière
    // ne trouvait rien. On propose donc, comme à l'inscription, les groupes
    // actifs du niveau de l'élève — ceux où un professeur enseigne déjà cette
    // matière en premier.
    const subjectId = catalog?.subjectsByName?.[subject]?.id
    const teachesSubject = (group) =>
      Boolean(subjectId && catalog?.teacherByGroupSubject?.[`${group.id}:${subjectId}`]) || group.subject_id === subjectId
    const byId = new Map()
    for (const group of catalog?.groupsByLevel?.[editing?.level] || []) {
      if (group.status === 'active') byId.set(group.id, group)
    }
    for (const group of catalog?.groupsBySubject?.[subject] || []) byId.set(group.id, group)
    const options = [...byId.values()].sort(
      (a, b) => Number(teachesSubject(b)) - Number(teachesSubject(a)) || a.name.localeCompare(b.name)
    )
    // Le groupe déjà enregistré reste proposé, même s'il ne figure plus dans
    // la liste — sinon le menu s'affiche vide et l'enregistrement détache
    // l'élève de son groupe.
    const current = details?.group_id ? catalog?.groupsById?.[details.group_id] : null
    if (current && !options.some((group) => group.id === current.id)) options.unshift(current)
    return options
  }


  const setSubjectDetails = (subject, changes) =>
    setEditing((e) => ({ ...e, subjectDetails: { ...e.subjectDetails, [subject]: { ...e.subjectDetails?.[subject], ...changes } } }))

  // Préscolaire et primaire : l'élève suit tout le niveau pour un prix unique,
  // il n'y a donc pas de liste de matières à revoir, seulement ce montant.
  const editIsPackage = Boolean(editing && catalog && isPackageLevel(catalog, editing.level))

  const editTotal = useMemo(() => {
    if (!editing || !catalog) return 0
    if (isPackageLevel(catalog, editing.level)) {
      const amount = Number(editing.packageAmount)
      return Number.isFinite(amount) && amount >= 0 ? amount : 0
    }
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
      .filter((s) => tariffSubjectIds.has(s.id) || editing.chosen.includes(s.name) || (editing.originalChosen || []).includes(s.name))
      .map((s) => s.name)
  }, [editing, catalog])

  // Versements, sur les mois encore ouverts, d'une matière qu'on vient de
  // retirer à l'élève dans « Modifier les matières ».
  const removedSubjectRows = (subject) => {
    if (!editing || editing.chosen.includes(subject) || !(editing.originalChosen || []).includes(subject)) return []
    const subjectId = editing.subjectDetails?.[subject]?.subject_id
    return subjectId ? openMonthRowsOf(paymentSubjectsByStudent[editing.id] || [], subjectId) : []
  }
  const setRemovedPayments = (subject, choice) =>
    setEditing((current) => ({ ...current, removedPayments: { ...current.removedPayments, [subject]: choice } }))

  const saveEdit = async () => {
    if (!editing || saving) return

    // Une matière sans groupe s'enregistre avec group_id à null. La
    // synchronisation retire alors l'élève de ce groupe : il disparaît de la
    // fiche d'absence et du journal du professeur, sans que rien ne le signale.
    // On refuse donc l'enregistrement plutôt que de le détacher en silence.
    if (!editIsPackage) {
      const sansGroupe = (editing.chosen || []).filter(
        (name) => !editing.subjectDetails?.[name]?.group_id && !editing.subjectDetails?.[name]?.group
      )
      if (sansGroupe.length > 0) {
        setError(`Choisissez un groupe pour : ${sansGroupe.join(', ')}.`)
        return
      }
    }

    // Matière retirée avec des versements sur un mois encore ouvert : garder ou
    // supprimer ces versements est un choix explicite.
    const removedWithPayments = editIsPackage
      ? []
      : (editing.originalChosen || []).filter((subject) => removedSubjectRows(subject).length > 0)
    const undecided = removedWithPayments.filter((subject) => !editing.removedPayments?.[subject])
    if (undecided.length > 0) {
      setError(`Choisissez quoi faire des paiements de : ${undecided.join(', ')}.`)
      return
    }
    const rowsToDelete = removedWithPayments
      .filter((subject) => editing.removedPayments[subject] === 'delete')
      .flatMap((subject) => removedSubjectRows(subject))
    if (rowsToDelete.length > 0) {
      const total = rowsToDelete.reduce((sum, row) => sum + toNumber(row.amount), 0)
      const days = [...new Set(rowsToDelete.map((row) => normalizeDateKey(row.paid_at)).filter((day) => day && day !== currentDayKey))]
      let message = `Supprimer ${total.toLocaleString('fr-FR')} DH de paiements : ${paymentRowsLabel(rowsToDelete)} ?`
      if (days.length > 0) message += `\n\nAttention : la caisse du ${days.map((day) => formatFrenchDate(day)).join(', ')} sera modifiée.`
      if (!window.confirm(message)) return
    }

    setSaving(true)
    setError('')
    try {
      // Au forfait il n'y a aucune ligne par matière à synchroniser, et y
      // passer une liste vide retirerait l'élève de son groupe.
      if (!editIsPackage) {
        // Une matière ajoutée ici n'est due qu'à partir du mois validé (ou du
        // mois en cours depuis le crayon) : les mois déjà réglés sans elle ne
        // redeviennent pas impayés.
        const startedAt = editing.paymentIndex != null
          ? subjectStartForMonth(monthDate(editing.paymentIndex, Number(schoolYearStart)))
          : new Date().toISOString()
        await syncSubscriptions(
          editing.id,
          { chosen: editing.chosen, subjectDetails: editing.subjectDetails, level: editing.level },
          catalog,
          { startedAt }
        )
      }
      const { error: duError } = await supabase.from('students').update({ du_mois: editTotal }).eq('id', editing.id)
      if (duError) throw duError
      if (rowsToDelete.length > 0) await writeSubjectPaymentChanges({ deletes: rowsToDelete.map((row) => row.id) })
      let data = await load()
      if (rowsToDelete.length > 0 && data) {
        const updated = data.students.find((s) => s.id === editing.id)
        if (updated) {
          await resyncAfterDeletion({
            student: updated,
            catalog: data.catalog,
            payments: data.paymentsByStudent[updated.id] || [],
            subjectRows: data.paymentSubjectsByStudent[updated.id] || [],
            deletedRows: rowsToDelete,
            userId: user?.id || null,
          })
          data = await load()
        }
      }
      invalidateFeesCache()
      const paymentIndex = editing.paymentIndex
      const fresh = data?.students.find((s) => s.id === editing.id)
      setEditing(null)
      // Retour sur la validation du mois, avec les matières à jour. Les cases
      // déjà cochées sont conservées ; une matière ajoutée arrive décochée, à
      // son prix habituel.
      if (paymentIndex != null && fresh) {
        setSelected({ student: fresh, index: paymentIndex })
        setPaidAmounts((prev) =>
          Object.fromEntries(
            fresh.chosen.map((name) => [name, prev[name] ?? String(priceFor(data.catalog, fresh, name))])
          )
        )
        setPaidTotals((prev) =>
          Object.fromEntries(
            fresh.chosen.map((name) => [name, prev[name] ?? String(priceFor(data.catalog, fresh, name))])
          )
        )
      } else if (paymentIndex != null) {
        setSelected(null)
      }
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
        dueAmount={feeReceipt.dueAmount}
        paidBefore={feeReceipt.paidBefore}
        remaining={feeReceipt.remaining}
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
          <Link to="/accounting/registration-fees">Frais d'inscription</Link>
          <Link to="/accounting/formations">Frais de formation</Link>
          <Link to="/accounting/delinquencies">Retards & Impayés</Link>
          <Link to="/accounting/salaries">Salaires Profs</Link>
          <Link to="/accounting/expenses">Charges</Link>
          <Link to="/accounting/profit">Bénéfice net</Link>
        </nav>
        <div className="fees-toolbar">
          <label className="fees-year-select">
            <span>Année scolaire</span>
            <select value={schoolYearStart} onChange={(e) => changeSchoolYear(e.target.value)}>
              {schoolYearOptions().map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="fees-year-select">
            <span>Mois consulté</span>
            <select value={statsMonthIndex} onChange={(e) => setStatsMonthIndex(Number(e.target.value))}>
              {schoolMonths.map((m, i) => <option key={m.key} value={i}>{m.label}</option>)}
            </select>
          </label>
          <div className="fees-view-switch">
            <button className={activeView === 'calendar' ? 'active' : ''} onClick={() => setActiveView('calendar')}>Calendrier</button>
            <button className={activeView === 'history' ? 'active' : ''} onClick={() => setActiveView('history')}>Historique journalier</button>
          </div>
        </div>
        <section className="fee-stats">
          <article>
            <span>{isCenterWide ? "Total encaissé aujourd'hui" : "Mes encaissements aujourd'hui"}</span>
            <strong>{stats.totalCollected.toLocaleString('fr-FR')} DH</strong>
            <i className="fee-stat-icon fee-stat-icon--green"><TrendingUp size={20} /></i>
          </article>
          <article>
            <span>{isCenterWide ? 'Élèves encaissés' : 'Mes élèves encaissés'} — {schoolMonths[statsMonthIndex]?.label}</span>
            <strong>{stats.billed}</strong>
            <i className="fee-stat-icon"><Users size={20} /></i>
          </article>
          <article>
            <span>Dû mensuel — {schoolMonths[statsMonthIndex]?.label}</span>
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
          <DailyHistoryPanel
            payments={scopedPayments}
            schoolMonths={schoolMonths}
            schoolYearStart={schoolYearStart}
            branchId={selectedBranch}
            isCenterWide={isCenterWide}
            currentDayKey={currentDayKey}
            describePayments={describeDayPayments}
          />
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
                      <RegistrationFeeBadge fee={registrationFeeOf(student)} onOpen={() => setFeeModal({ student })} />
                    </td>
                    {schoolMonths.map((month, index) => {
                      const status = stateOf(student, index)
                      const disabled = status === 'inactive' || status === 'disabled'
                      if (!isSegmentedPayment(student)) {
                        return (
                          <td key={index}>
                            <button
                              aria-label={`${month.label} : ${status}`}
                              className={`payment-dot ${status}`}
                              disabled={disabled}
                              onClick={() => openPayment(student, index)}
                            />
                          </td>
                        )
                      }
                      // Un repère par matière due CE mois-ci : une matière ajoutée
                      // en cours d'année n'apparaît qu'à partir de son mois d'ajout.
                      // Orange : une avance a été versée, il reste à payer.
                      const coverage = monthCoverage(student, index)
                      const paidNames = disabled ? [] : coverage.paid
                      const partialNames = disabled ? [] : coverage.partial
                      const segmentNames = coverage.due.length > 0 ? coverage.due : student.chosen
                      const segmentClass = (name) =>
                        paidNames.includes(name) ? 'paid' : partialNames.includes(name) ? 'partial' : status
                      return (
                        <td key={index}>
                          <button
                            aria-label={`${month.label} : ${status} (${paidNames.length}/${segmentNames.length} matières${partialNames.length ? `, ${partialNames.length} en avance` : ''})`}
                            className={`payment-segments ${status}`}
                            disabled={disabled}
                            onClick={() => openPayment(student, index)}
                          >
                            {segmentNames.map((name) => (
                              <span
                                key={name}
                                className={`payment-segment ${segmentClass(name)}`}
                                title={partialNames.includes(name)
                                  ? `${name} : avance ${coverage.bySubject[name].paidAmount.toLocaleString('fr-FR')} DH, reste ${coverage.bySubject[name].remaining.toLocaleString('fr-FR')} DH`
                                  : name}
                              />
                            ))}
                          </button>
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

      {selected && !editing && (
        <div className="fee-overlay">
          <section className="payment-modal">
            <button className="modal-close" onClick={() => setSelected(null)}>×</button>
            <h2>Paiement — {schoolMonths[selected.index]?.label || ''}</h2>
            <div className="payment-person">
              <i>{initials(selected.student.name)}</i>
              <span><b>{selected.student.name}</b><small>{selected.student.code}</small></span>
              {catalog && !isPackageLevel(catalog, selected.student.level) && (
                <button
                  type="button"
                  className="payment-edit-subjects"
                  onClick={() => openEdit(selected.student, selected.index)}
                  title="Ajouter ou retirer des matières à cet élève"
                >
                  <Pencil size={16} /> Modifier les matières
                </button>
              )}
            </div>
            {error && <div className="fees-error">Erreur : {error}</div>}
            {isSegmentedPayment(selected.student) ? (
              <>
                <p className="payment-subjects-hint">
                  Sélectionnez les matières réglées ce mois-ci. « Prix » est le prix de la matière pour
                  ce mois seulement (½ pour un demi-mois) ; « Payé » est ce que l'élève a versé. Moins
                  que le prix : c'est une avance, la matière reste en orange jusqu'au paiement du reste.
                  Plus que le prix : le surplus va en avance sur les mois suivants. Tout reste modifiable
                  jusqu'à la fin du mois ; ensuite, seul un administrateur peut corriger ce qui est
                  enregistré (un retard peut toujours être encaissé).
                </p>
                <div className="payment-subjects-list">
                  {selectedDue.map((name) => {
                    const checked = paidSelection.includes(name)
                    const usualPrice = priceFor(catalog, selected.student, name)
                    const amount = selectedSubjectAmount(name)
                    const lock = selectedLocked[name]
                    const isBlock = lock === 'block'
                    const already = selectedCoverage.bySubject[name]?.paidAmount || 0
                    const paidTotal = checked ? selectedSubjectPaid(name) : 0
                    const paymentsLabel = selectedPaymentsLabel(name)
                    // Ce qui partira en avance sur les mois suivants à la validation.
                    const surplus = paidTotal > already ? paidTotal - Math.max(amount, already) : 0
                    const partial = checked && !isBlock && paidTotal < amount
                    return (
                      <label key={name} className={`payment-subject-row ${checked ? 'checked' : ''} ${lock ? 'locked' : ''} ${partial ? 'partial' : ''}`}>
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={Boolean(lock)}
                          onChange={() =>
                            setPaidSelection((prev) =>
                              prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
                            )
                          }
                        />
                        <span>
                          {name}
                          {amount !== usualPrice && (
                            <small className="payment-usual-price">Prix habituel : {usualPrice.toLocaleString('fr-FR')} DH</small>
                          )}
                          {isBlock && selectedCoverage.block?.paid_at && (
                            <small className="payment-paid-on">
                              Réglé avec le mois en bloc le {formatFrenchDate(normalizeDateKey(selectedCoverage.block.paid_at))}
                            </small>
                          )}
                          {!isBlock && paymentsLabel && (
                            <small className="payment-paid-on">
                              Encaissé : {paymentsLabel}
                              {selectedCoverage.bySubject[name]?.settled && ' — ✓ réglé'}
                              {lock === 'closed' && ' — mois terminé : seul un ajout est possible'}
                            </small>
                          )}
                          {partial && (
                            <small className="payment-partial-hint">
                              Avance — reste {(amount - paidTotal).toLocaleString('fr-FR')} DH à payer
                            </small>
                          )}
                          {checked && !isBlock && surplus > 0 && (
                            <small className="payment-advance-hint">
                              dont {surplus.toLocaleString('fr-FR')} DH d'avance sur les mois suivants
                            </small>
                          )}
                          {checked && !isBlock && already > 0 && paidTotal > already && !monthClosedFor(selected.index) && (
                            <span className="payment-increase-mode">
                              <button
                                type="button"
                                className={increaseModes[name] !== 'correction' ? 'active' : ''}
                                onClick={() => setIncreaseMode(name, 'new')}
                              >
                                Nouveau versement aujourd'hui
                              </button>
                              <button
                                type="button"
                                className={increaseModes[name] === 'correction' ? 'active' : ''}
                                onClick={() => setIncreaseMode(name, 'correction')}
                              >
                                Correction du versement du{' '}
                                {formatFrenchDate(normalizeDateKey(latestPaymentOf(name)?.paid_at))}
                              </button>
                            </span>
                          )}
                        </span>
                        <span className="payment-amount-fields">
                          <span className="payment-amount-field">
                            <em>Prix</em>
                            <button
                              type="button"
                              disabled={isBlock || lock === 'closed'}
                              title="Demi-mois : la moitié du prix habituel"
                              onClick={() => setSubjectDue(name, String(Math.round(usualPrice / 2)))}
                            >
                              ½
                            </button>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              inputMode="decimal"
                              aria-label={`Prix de ${name} pour ce mois`}
                              disabled={isBlock || lock === 'closed'}
                              value={paidAmounts[name] ?? ''}
                              onChange={(event) => setSubjectDue(name, event.target.value)}
                            />
                            <b>DH</b>
                          </span>
                          <span className="payment-amount-field">
                            <em>Payé</em>
                            <button
                              type="button"
                              disabled={isBlock}
                              title="Solder : payer tout le prix du mois"
                              onClick={() => setSubjectPaid(name, String(amount))}
                            >
                              ✓
                            </button>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              inputMode="decimal"
                              aria-label={`Montant payé pour ${name} ce mois-ci`}
                              disabled={isBlock}
                              value={paidTotals[name] ?? ''}
                              onChange={(event) => setSubjectPaid(name, event.target.value)}
                            />
                            <b>DH</b>
                          </span>
                        </span>
                      </label>
                    )
                  })}
                </div>
                <div className="payment-amount">
                  <span>Payé sur ce mois</span>
                  <strong>
                    {selectedDue
                      .filter((name) => paidSelection.includes(name))
                      .reduce((sum, name) => sum + Math.min(selectedSubjectPaid(name), selectedSubjectAmount(name)), 0)
                      .toLocaleString('fr-FR')} DH
                    <small>
                      / {selectedDue
                        .reduce((sum, name) => sum + selectedSubjectAmount(name), 0)
                        .toLocaleString('fr-FR')} DH
                    </small>
                  </strong>
                  {(() => {
                    // Somme réellement reçue à la validation (avances comprises).
                    const collectedNow = selectedDue
                      .filter((name) => paidSelection.includes(name) && !selectedCoverage.blockCovered.includes(name) && increaseModes[name] !== 'correction')
                      .reduce((sum, name) => sum + Math.max(0, selectedSubjectPaid(name) - (selectedCoverage.bySubject[name]?.paidAmount || 0)), 0)
                    return collectedNow > 0 ? <small>À encaisser maintenant : {collectedNow.toLocaleString('fr-FR')} DH</small> : null
                  })()}
                </div>
                {selectedCoverage.block && selectedCoverage.blockCovered.length > 0 && (
                  <div className="payment-block-paid">
                    Payé en bloc
                    {selectedCoverage.block.paid_at && ` le ${formatFrenchDate(normalizeDateKey(selectedCoverage.block.paid_at))}`}
                    {' : '}{toNumber(selectedCoverage.block.amount).toLocaleString('fr-FR')} DH
                    {selectedCoverage.blockCovered.length > 1 && ` pour ${selectedCoverage.blockCovered.join(', ')}`}
                    <div className="payment-block-detail">
                      {monthClosedFor(selected.index) ? (
                        <small>Mois terminé : seul un administrateur peut le détailler par matière.</small>
                      ) : (
                        <>
                          <button type="button" disabled={saving} onClick={detailBlockMonth}>
                            Détailler par matière
                          </button>
                          <small>Pour modifier une matière. Les montants et la date du paiement ne changent pas.</small>
                        </>
                      )}
                    </div>
                  </div>
                )}
                {selectedSaved?.settled && (
                  <div className="validated payment-month-status">
                    <Check size={18} /> {schoolMonths[selected.index]?.label} réglé — toutes les matières sont payées
                  </div>
                )}
                {selectedSaved && !selectedSaved.settled && (selectedSaved.rows.length > 0 || selectedSaved.payment) && (
                  <div className="payment-month-remaining">
                    Reste à payer sur {schoolMonths[selected.index]?.label} : {selectedSaved.remaining.toLocaleString('fr-FR')} DH
                  </div>
                )}
                <button className="validate-button" disabled={saving} onClick={handleValidate}>
                  {saving ? 'Enregistrement...' : selectedSaved?.settled ? 'Enregistrer les modifications' : 'Valider le paiement'}
                </button>
                {(stateOf(selected.student, selected.index) === 'paid' || selectedCoverage.rows.length > 0) && (
                  <button
                    className="receipt-button"
                    onClick={() => {
                      setReceipt(receiptFor(selected.student, selected.index))
                      setSelected(null)
                    }}
                  >
                    <Printer size={18} /> &nbsp; Imprimer le reçu
                  </button>
                )}
              </>
            ) : (
              <>
                {stateOf(selected.student, selected.index) === 'paid' ? (
                  <div className="payment-amount">
                    <span>Montant payé</span>
                    <strong>{monthBlockAmount(selected.student, selected.index).toLocaleString('fr-FR')} DH</strong>
                    {selectedBlockPayment?.paid_at && (
                      <small>Encaissé le {formatFrenchDate(normalizeDateKey(selectedBlockPayment.paid_at))}</small>
                    )}
                    <div className="payment-correction">
                      <span className="payment-amount-field payment-amount-field--block">
                        <button
                          type="button"
                          title="Demi-mois : la moitié du forfait"
                          onClick={() => setBlockAmount(String(Math.round((selected.student.du_mois || 0) / 2)))}
                        >
                          ½
                        </button>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          inputMode="decimal"
                          aria-label="Montant corrigé"
                          value={blockAmount}
                          onChange={(event) => setBlockAmount(event.target.value)}
                        />
                        <b>DH</b>
                      </span>
                      <div className="payment-correction-actions">
                        <button
                          type="button"
                          disabled={
                            saving ||
                            selectedBlockLocked ||
                            enteredAmount(blockAmount, monthBlockAmount(selected.student, selected.index)) ===
                              monthBlockAmount(selected.student, selected.index)
                          }
                          onClick={() => correctBlockPayment(false)}
                        >
                          Corriger le montant
                        </button>
                        {!selectedBlockLocked && (
                          <button type="button" className="danger" disabled={saving} onClick={() => correctBlockPayment(true)}>
                            Annuler ce paiement
                          </button>
                        )}
                      </div>
                      {selectedBlockLocked && (
                        <small className="payment-correction-locked">
                          Mois terminé : seul un administrateur peut corriger ou annuler ce paiement.
                        </small>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="payment-amount">
                    <span>Montant à encaisser ce mois-ci</span>
                    <span className="payment-amount-field payment-amount-field--block">
                      <button
                        type="button"
                        title="Demi-mois : la moitié du forfait"
                        onClick={() => setBlockAmount(String(Math.round((selected.student.du_mois || 0) / 2)))}
                      >
                        ½
                      </button>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        inputMode="decimal"
                        aria-label="Montant à encaisser ce mois-ci"
                        value={blockAmount}
                        onChange={(event) => setBlockAmount(event.target.value)}
                      />
                      <b>DH</b>
                    </span>
                    {enteredAmount(blockAmount, selected.student.du_mois || 0) !== (selected.student.du_mois || 0) && (
                      <small>Forfait habituel : {(selected.student.du_mois || 0).toLocaleString('fr-FR')} DH</small>
                    )}
                  </div>
                )}
                {stateOf(selected.student, selected.index) === 'paid' ? (
                  <>
                    <div className="validated"><Check size={18} /> Paiement validé</div>
                    <button
                      className="receipt-button"
                      onClick={() => {
                        setReceipt(receiptFor(selected.student, selected.index))
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
              </>
            )}
          </section>
        </div>
      )}

      {feeModal && (
        <RegistrationFeeModal
          name={feeModal.student.name}
          code={feeModal.student.code}
          schoolYear={schoolYearKeyLabel}
          fee={registrationFeeOf(feeModal.student)}
          defaultAmount={toNumber(appSettings?.registrationFee)}
          error={error}
          saving={saving}
          onClose={() => setFeeModal(null)}
          onSubmit={validateRegistrationFee}
        />
      )}

      {editing && (
        <div className="fee-overlay">
          <section className="edit-modal">
            <button className="modal-close" onClick={() => setEditing(null)}>×</button>
            <h2>{editIsPackage ? 'Modifier le forfait' : 'Modifier les matières & groupes'}</h2>
            <p>
              {editIsPackage
                ? `${editing.name} — ${editing.level} est facturé au forfait : toutes les matières sont comprises dans ce montant.`
                : `${editing.name} — sélectionnez les matières auxquelles l'élève est inscrit.`}
            </p>
            {!editIsPackage && (
              <p className="edit-start-hint">
                Une matière ajoutée est due à partir de{' '}
                <b>
                  {editing.paymentIndex != null
                    ? schoolMonths[editing.paymentIndex]?.label
                    : monthLabelOf(localMonthKey(new Date()))}
                </b>
                {' '}; les mois précédents ne changent pas. Une matière retirée n'est plus due ; si elle a
                des paiements sur les mois en cours, vous choisissez de les garder ou de les supprimer.
              </p>
            )}
            {error && <div className="fees-error">Erreur : {error}</div>}
            {editIsPackage ? (
              <div className="edit-package">
                <label>
                  Forfait mensuel (DH)
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={editing.packageAmount}
                    onChange={(e) => setEditing((current) => ({ ...current, packageAmount: e.target.value }))}
                  />
                </label>
                <small>Prix standard du niveau : {packagePrice(catalog, editing.level).toLocaleString('fr-FR')} DH/mois</small>
              </div>
            ) : (
            <div className="edit-subjects">
              {availableSubjects.map((subject) => {
                const isSelected = editing.chosen.includes(subject)
                const removedRows = removedSubjectRows(subject)
                const removedChoice = editing.removedPayments?.[subject]
                const details = editing.subjectDetails?.[subject] || { teacher: '', group_id: '', group: '', priceType: 'standard', manualPrice: '' }
                return (
                  <article key={subject} className={isSelected ? 'selected' : ''}>
                    <label className="edit-subject-toggle">
                      <input type="checkbox" checked={isSelected} onChange={() => toggleSubject(subject)} />
                      <span>
                        <b>{subject}</b>
                        <small>{priceFor(catalog, editing, subject, details).toLocaleString('fr-FR')} DH/mois</small>
                      </span>
                    </label>
                    {removedRows.length > 0 && (
                      <div className="edit-removed-payments">
                        <p>
                          Paiements sur les mois en cours : {paymentRowsLabel(removedRows)}. Les mois terminés
                          gardent les leurs.
                        </p>
                        <div>
                          <button
                            type="button"
                            className={removedChoice === 'keep' ? 'active' : ''}
                            onClick={() => setRemovedPayments(subject, 'keep')}
                          >
                            Garder ses paiements
                          </button>
                          <button
                            type="button"
                            className={removedChoice === 'delete' ? 'danger active' : 'danger'}
                            onClick={() => setRemovedPayments(subject, 'delete')}
                          >
                            Supprimer ses paiements
                          </button>
                        </div>
                      </div>
                    )}
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
                          <select
                            value={details.group_id || ''}
                            onChange={(e) => {
                              const id = e.target.value
                              // Le professeur suit le groupe choisi (celui qui y
                              // enseigne cette matière), comme à l'inscription.
                              const teacher = id ? teacherForGroupSubject(catalog, id, subject) : ''
                              setSubjectDetails(subject, {
                                group_id: id,
                                group: catalog.groupsById?.[id]?.name || '',
                                ...(teacher ? { teacher } : {}),
                              })
                            }}
                          >
                            <option value="">Choisir un groupe</option>
                            {groupOptionsFor(subject, details).map((group) => (
                              <option key={group.id} value={group.id}>{group.name}</option>
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
            )}
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
          amountOf={(index) => {
            // Mois sans aucun versement : payé en bloc au dû mensuel (validateAdvance).
            const coverage = isSegmentedPayment(advance) ? monthCoverage(advance, index) : null
            if (!coverage || (coverage.rows.length === 0 && !coverage.block)) return toNumber(advance.du_mois)
            return monthRemainingAsOf(advance, monthDate(index, Number(schoolYearStart)), null) || 0
          }}
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
