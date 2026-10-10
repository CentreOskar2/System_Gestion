import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Header from '../shared/Header'
import { CalendarPlus, Check, Pencil, Printer, Search, TrendingUp, Users, Wallet } from 'lucide-react'
import { supabase } from '../../supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { useBranch } from '../../context/BranchContext'
import { safeFilename } from '../../utils/exportToPdf'
import { downloadPdfDocument } from '../pdf/downloadPdf'
import FeeReceiptPdf from '../pdf/FeeReceiptPdf'
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
import { fetchRegistrationFees, payRegistrationFee } from './registrationFeesApi'
import DailyHistoryPanel from './DailyHistoryPanel'
import RegistrationFeeReceiptPdf from '../pdf/RegistrationFeeReceiptPdf'
import {
  monthDate,
  priceFor,
  studentLineItems,
  fetchFeesData,
  isBlockPayment,
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

// Mois (heure locale) d'un horodatage : "2026-10-01T00:30+01:00" est en
// octobre, même si sa forme UTC tombe encore en septembre.
function localMonthKey(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`
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
      // Montants réellement encaissés quand ils sont connus (prix du mois
      // modifié à la validation, ex. demi-mois) ; sinon les prix de l'élève.
      lines: r.lines || studentLineItems(r.student, catalog),
      total: r.total ?? (r.student.du_mois || 0),
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
  const [blockAmount, setBlockAmount] = useState('')

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
    const feePayments = Object.values(registrationFees)
      .filter((fee) => fee.status === 'paid' && fee.paid_at)
      .map((fee) => ({
        id: `registration-${fee.id}`,
        student_id: fee.student_id,
        amount: fee.amount,
        paid_at: fee.paid_at,
        status: 'paid',
        // Sur les frais d'inscription, l'encaisseur s'appelle validated_by ; on
        // l'aligne sur paid_by pour que les deux flux se comptent pareil.
        paid_by: fee.validated_by || null,
      }))
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
  const isSegmentedPayment = (student) =>
    Boolean(catalog) && !isPackageLevel(catalog, student.level) && student.chosen.length > 0

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
  const monthCoverage = (student, index, asOfDay = null) => {
    const monthKey = monthDate(index, Number(schoolYearStart))
    const receivedBy = (paidAt) => !asOfDay || !paidAt || accountingDayBucket(paidAt) <= asOfDay
    const payment = (paymentsByStudent[student.id] || []).find(
      (p) => normalizeMonthKey(p.month) === monthKey && (p.status === 'paid' || p.status === 'validé') && receivedBy(p.paid_at)
    ) || null
    const rows = (paymentSubjectsByStudent[student.id] || []).filter((r) => r.month === monthKey && receivedBy(r.paid_at))
    const block = isBlockPayment(payment, rows) ? payment : null
    const rowSubjectIds = new Set(rows.map((r) => r.subject_id))
    const startedAtOf = (name) => student.subjectDetails?.[name]?.startedAt || null
    const rawPaid = student.chosen.filter((name) => rowSubjectIds.has(student.subjectDetails?.[name]?.subject_id))
    const blockCovered = block
      ? student.chosen.filter((name) => {
          if (rawPaid.includes(name)) return false
          const startedAt = startedAtOf(name)
          return !startedAt || !block.paid_at || new Date(startedAt) <= new Date(block.paid_at)
        })
      : []
    const paid = student.chosen.filter((name) => rawPaid.includes(name) || blockCovered.includes(name))
    const due = student.chosen.filter((name) => {
      const startedAt = startedAtOf(name)
      return !startedAt || localMonthKey(startedAt) <= monthKey || paid.includes(name)
    })
    return { monthKey, payment, block, rows, rawPaid, blockCovered, paid, due }
  }

  // Une matière réglée un jour passé ne peut plus être décochée que par un
  // rôle « centre » : l'annuler retirerait l'encaissement de la caisse de ce
  // jour-là. Son montant, lui, reste corrigeable par tous (après confirmation).
  // Une matière couverte par un paiement en bloc est entièrement figée.
  const lockedPaidSubjects = (student, index) => {
    const { rows, blockCovered } = monthCoverage(student, index)
    const locked = {}
    for (const name of blockCovered) locked[name] = 'block'
    if (isCenterWide) return locked
    for (const name of student.chosen) {
      const row = rows.find((r) => r.subject_id === student.subjectDetails?.[name]?.subject_id)
      if (row && normalizeDateKey(row.paid_at) !== currentDayKey) locked[name] = 'past'
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
    // Un mois n'est exigible qu'à partir de la date anniversaire de l'inscription
    // (inscrit le 26/07 → échéance le 26 de chaque mois), et non dès le 1er du mois.
    const dueDate = billingDueDate(student.registrationDate, key)
    if (dueDate && today < dueDate) return 'pending'
    return 'unpaid'
  }

  const paymentsOf = (student) => schoolMonths.map((_, index) => stateOf(student, index))

  const studentsById = useMemo(() => Object.fromEntries(students.map((s) => [s.id, s])), [students])

  // Reste à régler sur un mois, à la fin d'un jour donné : les matières dues
  // pas encore payées, à leur prix habituel. Une matière réglée en demi-mois ou
  // avec une remise compte comme réglée, comme dans le calendrier.
  const monthRemainingAsOf = (student, monthKey, dayKey) => {
    const index = schoolMonths.findIndex((m) => m.key === monthKey)
    if (index < 0) return null
    const { payment, paid, due } = monthCoverage(student, index, dayKey)
    if (!isSegmentedPayment(student)) return payment ? 0 : toNumber(student.du_mois)
    return due
      .filter((name) => !paid.includes(name))
      .reduce((sum, name) => sum + priceFor(catalog, student, name), 0)
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

  const monthPaymentOf = (student, index) => {
    const key = monthDate(index, Number(schoolYearStart))
    return (paymentsByStudent[student.id] || []).find((p) => normalizeMonthKey(p.month) === key) || null
  }

  // Montant déjà enregistré pour cette matière ce mois-ci, sinon son prix habituel.
  const monthSubjectAmount = (student, index, name) => {
    const monthKey = monthDate(index, Number(schoolYearStart))
    const subjectId = student.subjectDetails?.[name]?.subject_id
    const row = (paymentSubjectsByStudent[student.id] || []).find(
      (r) => r.month === monthKey && r.subject_id === subjectId
    )
    return row ? toNumber(row.amount) : priceFor(catalog, student, name)
  }

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
  // Matières proposées dans la modale de validation : celles dues ce mois-là.
  const selectedCoverage = selected ? monthCoverage(selected.student, selected.index) : null
  const selectedDue = selectedCoverage?.due || []
  const selectedLocked = selected ? lockedPaidSubjects(selected.student, selected.index) : {}
  // Forfait déjà réglé : comme pour les matières, le montant reste corrigeable
  // par tous ; l'annulation d'un jour passé est réservée à un rôle « centre ».
  const selectedBlockPayment = selected ? monthPaymentOf(selected.student, selected.index) : null
  const selectedBlockLocked =
    Boolean(selectedBlockPayment) && !isCenterWide && normalizeDateKey(selectedBlockPayment.paid_at) !== currentDayKey

  // Date à laquelle une matière de la modale a été encaissée (ligne par
  // matière, ou paiement en bloc qui la couvre).
  const selectedPaidOn = (name) => {
    if (!selectedCoverage) return ''
    if (selectedCoverage.blockCovered.includes(name)) return selectedCoverage.block?.paid_at || ''
    const subjectId = selected.student.subjectDetails?.[name]?.subject_id
    return selectedCoverage.rows.find((r) => r.subject_id === subjectId)?.paid_at || ''
  }

  // Reçu d'un mois déjà payé : les montants enregistrés, pas les prix du moment.
  const receiptFor = (student, index) => {
    const monthKey = monthDate(index, Number(schoolYearStart))
    const base = { student, month: schoolMonths[index]?.label || '', monthKey, catalog }
    const payment = monthPaymentOf(student, index)
    if (!payment) return base
    const total = toNumber(payment.amount)

    // Forfait : une seule ligne, au montant encaissé.
    if (!isSegmentedPayment(student)) {
      const [line] = studentLineItems(student, catalog)
      return { ...base, total, lines: [{ name: line?.name || 'Forfait', amount: total }] }
    }

    // Mois réglé matière par matière : chaque ligne porte le montant enregistré.
    // Un mois payé en bloc (avance) n'a pas ce détail : lignes aux prix
    // habituels, limitées aux matières que ce paiement couvrait.
    const { rows, paid, due } = monthCoverage(student, index)
    if (rows.length === 0) {
      return { ...base, total, lines: paid.map((name) => ({ name, amount: priceFor(catalog, student, name) })) }
    }
    const lines = due.map((name) => ({ name, amount: monthSubjectAmount(student, index, name) }))
    return { ...base, total, lines }
  }

  const openPayment = (student, index) => {
    const status = stateOf(student, index)
    if (status === 'inactive' || status === 'disabled') return
    setSelected({ student, index })
    setPaidSelection(monthCoverage(student, index).paid)
    setPaidAmounts(Object.fromEntries(student.chosen.map((name) => [name, String(monthSubjectAmount(student, index, name))])))
    setBlockAmount(String(monthBlockAmount(student, index)))
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

      // Paiement par matière : on aligne student_payment_subjects sur les
      // cases cochées (ajouts et retraits). Chaque ligne est un encaissement
      // réel, compté dans la caisse du jour où il a été fait.
      const { rawPaid: alreadyPaid, blockCovered, block, due } = monthCoverage(student, index)
      const locked = lockedPaidSubjects(student, index)
      // Une matière retirée de l'élève entre-temps n'est plus proposée ; une
      // matière figée (payée en bloc ou un jour passé) reste comme elle est.
      const selection = [
        ...new Set([
          ...paidSelection.filter((name) => due.includes(name) && !locked[name]),
          ...due.filter((name) => locked[name] && (alreadyPaid.includes(name) || blockCovered.includes(name))),
        ]),
      ]
      // Les matières couvertes par un paiement en bloc n'ont pas de ligne à
      // créer : le bloc est déjà compté, en entier, le jour où il a été reçu.
      const toAdd = selection.filter((name) => !alreadyPaid.includes(name) && !blockCovered.includes(name))
      const toRemove = alreadyPaid.filter((name) => !selection.includes(name))
      const storedRowOf = (name) =>
        (paymentSubjectsByStudent[student.id] || []).find(
          (r) => r.month === month && r.subject_id === student.subjectDetails?.[name]?.subject_id
        )
      // Montant corrigé d'une matière déjà réglée (même jour, ou rôle centre).
      const toUpdate = alreadyPaid.filter(
        (name) => selection.includes(name) && locked[name] !== 'block' && toNumber(storedRowOf(name)?.amount) !== selectedSubjectAmount(name)
      )

      // Corriger un encaissement d'un jour passé change la caisse de ce
      // jour-là : on le dit clairement avant de le faire.
      const pastDays = [...toRemove, ...toUpdate]
        .map((name) => normalizeDateKey(storedRowOf(name)?.paid_at))
        .filter((day) => day && day !== currentDayKey)
      if (pastDays.length > 0) {
        const days = [...new Set(pastDays)].map((day) => formatFrenchDate(day)).join(', ')
        const ok = window.confirm(
          `Attention : cette correction modifie la caisse déjà enregistrée le ${days}. Continuer ?`
        )
        if (!ok) return
      }

      const nowIso = new Date().toISOString()
      if (toAdd.length > 0 || toUpdate.length > 0) {
        const rows = [...toAdd, ...toUpdate].map((name) => {
          const stored = toUpdate.includes(name) ? storedRowOf(name) : null
          return {
            student_id: student.id,
            subject_id: student.subjectDetails?.[name]?.subject_id,
            month,
            amount: selectedSubjectAmount(name),
            paid_at: stored?.paid_at || nowIso,
            paid_by: stored ? stored.paid_by ?? null : user?.id || null,
          }
        })
        const { error: err } = await supabase
          .from('student_payment_subjects')
          .upsert(rows, { onConflict: 'student_id,subject_id,month' })
        if (err) throw err
      }
      if (toRemove.length > 0) {
        const subjectIds = toRemove.map((name) => student.subjectDetails?.[name]?.subject_id).filter(Boolean)
        const { error: err } = await supabase
          .from('student_payment_subjects')
          .delete()
          .eq('student_id', student.id)
          .eq('month', month)
          .in('subject_id', subjectIds)
        if (err) throw err
      }

      // student_payments (le résumé "mois complet") suit : présent seulement
      // si TOUTES les matières du mois sont désormais payées, absent sinon —
      // c'est ce que lisent Retards & Impayés, le Dashboard et les Rapports.
      // Il ne compte plus dans la caisse du jour : le créer, le supprimer ou
      // changer son montant ne déplace aucun encaissement.
      // Un paiement en bloc, lui, est un vrai encaissement : on n'y touche pas.
      const fullyPaid = due.every((name) => selection.includes(name))
      const monthLines = due.map((name) => ({
        name,
        amount: blockCovered.includes(name) ? priceFor(catalog, student, name) : selectedSubjectAmount(name),
      }))
      const monthTotal = monthLines.reduce((sum, line) => sum + line.amount, 0)
      if (!block) {
        const changed = toAdd.length > 0 || toUpdate.length > 0 || toRemove.length > 0
        if (fullyPaid) {
          const existing = monthPaymentOf(student, index)
          const { error: err } = await supabase
            .from('student_payments')
            .upsert(
              {
                student_id: student.id,
                month,
                amount: monthTotal,
                status: 'paid',
                // Daté après les lignes qu'il résume : c'est ce qui le
                // distingue d'un paiement en bloc (voir isBlockPayment).
                paid_at: existing && !changed ? existing.paid_at : nowIso,
                paid_by: existing && !changed ? existing.paid_by ?? null : user?.id || null,
              },
              { onConflict: 'student_id,month' }
            )
          if (err) throw err
        } else {
          const { error: err } = await supabase
            .from('student_payments')
            .delete()
            .eq('student_id', student.id)
            .eq('month', month)
          if (err) throw err
        }
      }

      invalidateFeesCache()
      await load()
      if (fullyPaid) {
        setReceipt({
          student,
          month: schoolMonths[index]?.label || '',
          monthKey: month,
          catalog,
          total: monthTotal,
          lines: monthLines,
        })
      }
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
    // Annuler un forfait d'un jour passé reste réservé à un rôle « centre ».
    if (cancel && selectedBlockLocked) return
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
      const subjectRows = []
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
        for (const name of coverage.due.filter((n) => !coverage.paid.includes(n))) {
          subjectRows.push({
            student_id: student.id,
            subject_id: student.subjectDetails?.[name]?.subject_id,
            month,
            amount: priceFor(catalog, student, name),
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
      if (subjectRows.length > 0) {
        const { error: err } = await supabase
          .from('student_payment_subjects')
          .upsert(subjectRows, { onConflict: 'student_id,subject_id,month' })
        if (err) throw err
      }
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
      .filter((s) => tariffSubjectIds.has(s.id) || editing.chosen.includes(s.name))
      .map((s) => s.name)
  }, [editing, catalog])

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
      const data = await load()
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
                      const coverage = monthCoverage(student, index)
                      const paidNames = disabled ? [] : coverage.paid
                      const segmentNames = coverage.due.length > 0 ? coverage.due : student.chosen
                      return (
                        <td key={index}>
                          <button
                            aria-label={`${month.label} : ${status} (${paidNames.length}/${segmentNames.length} matières)`}
                            className={`payment-segments ${status}`}
                            disabled={disabled}
                            onClick={() => openPayment(student, index)}
                          >
                            {segmentNames.map((name) => (
                              <span
                                key={name}
                                className={`payment-segment ${paidNames.includes(name) ? 'paid' : status}`}
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
                  Sélectionnez les matières réglées ce mois-ci. Le montant de chaque matière peut
                  être modifié pour ce mois seulement (ex. inscription en milieu de mois), avant
                  comme après la validation. Une matière encaissée un jour précédent ne peut être
                  décochée que par un administrateur.
                </p>
                <div className="payment-subjects-list">
                  {selectedDue.map((name) => {
                    const checked = paidSelection.includes(name)
                    const usualPrice = priceFor(catalog, selected.student, name)
                    const amount = selectedSubjectAmount(name)
                    const lock = selectedLocked[name]
                    const paidOn = selectedPaidOn(name)
                    return (
                      <label key={name} className={`payment-subject-row ${checked ? 'checked' : ''} ${lock ? 'locked' : ''}`}>
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
                          {paidOn && (
                            <small className="payment-paid-on">
                              {lock === 'block' ? 'Réglé avec le mois en bloc' : 'Encaissé'} le {formatFrenchDate(normalizeDateKey(paidOn))}
                              {lock === 'past' && ' — montant modifiable'}
                            </small>
                          )}
                        </span>
                        <span className="payment-amount-field">
                          <button
                            type="button"
                            disabled={lock === 'block'}
                            title="Demi-mois : la moitié du prix habituel"
                            onClick={() => setPaidAmounts((prev) => ({ ...prev, [name]: String(Math.round(usualPrice / 2)) }))}
                          >
                            ½
                          </button>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            inputMode="decimal"
                            aria-label={`Montant ${name} pour ce mois`}
                            disabled={lock === 'block'}
                            value={paidAmounts[name] ?? ''}
                            onChange={(event) => setPaidAmounts((prev) => ({ ...prev, [name]: event.target.value }))}
                          />
                          <b>DH</b>
                        </span>
                      </label>
                    )
                  })}
                </div>
                <div className="payment-amount">
                  <span>Montant sélectionné</span>
                  <strong>
                    {selectedDue
                      .filter((name) => paidSelection.includes(name))
                      .reduce((sum, name) => sum + selectedSubjectAmount(name), 0)
                      .toLocaleString('fr-FR')} DH
                    <small>
                      / {selectedDue
                        .reduce((sum, name) => sum + selectedSubjectAmount(name), 0)
                        .toLocaleString('fr-FR')} DH
                    </small>
                  </strong>
                </div>
                <button className="validate-button" disabled={saving} onClick={handleValidate}>
                  {saving ? 'Enregistrement...' : 'Valider le paiement'}
                </button>
                {stateOf(selected.student, selected.index) === 'paid' && (
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
                          Encaissé un jour précédent : seul un administrateur peut annuler ce paiement.
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
                {' '}; les mois précédents ne changent pas. Une matière retirée n'est plus due, ses paiements
                déjà enregistrés sont conservés.
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
