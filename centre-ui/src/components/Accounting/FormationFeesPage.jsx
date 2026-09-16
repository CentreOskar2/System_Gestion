import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Header from '../shared/Header'
import { Search, TrendingUp, Users, Wallet } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useBranch } from '../../context/BranchContext'
import { fetchFormationFeesData, recordFormationPayment, cancelFormationPayment } from '../Formations/formationsApi'
import {
  accountingDayBucket,
  billingDueDate,
  formatFrenchDate,
  monthLabelOf,
  normalizeMonthKey,
  parseLocalDate,
  schoolYearOptions,
  schoolYearLabel,
  currentMonthKey,
} from './monthUtils'
import { fetchAppSettings } from '../../appSettings'
import { fetchRegistrationFees, payRegistrationFee } from './registrationFeesApi'
import { downloadPdfDocument } from '../pdf/downloadPdf'
import { safeFilename } from '../../utils/exportToPdf'
import RegistrationFeeReceiptPdf from '../pdf/RegistrationFeeReceiptPdf'
import FormationFeeReceiptPdf from '../pdf/FormationFeeReceiptPdf'
import DailyHistoryPanel from './DailyHistoryPanel'
import './FeesPage.css'
import './FormationFeesPage.css'

// Mêmes rôles « centre » que le calendrier de scolarité : eux seuls voient la
// caisse entière, les autres ne voient que leurs propres encaissements.
const CENTER_WIDE_ROLES = ['super_admin', 'admin', 'director']

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

export default function FormationFeesPage() {
  const { user, role } = useAuth()
  const { selectedBranch } = useBranch()
  const isCenterWide = CENTER_WIDE_ROLES.includes(role)

  const [rows, setRows] = useState([])
  const [paymentsByEnrollment, setPaymentsByEnrollment] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [schoolYearStart, setSchoolYearStart] = useState(String(currentMonthKey().slice(0, 4)))
  const [selected, setSelected] = useState(null)
  const [saving, setSaving] = useState(false)
  const [nowTick, setNowTick] = useState(() => Date.now())
  const [activeView, setActiveView] = useState('calendar')
  const [appSettings, setAppSettings] = useState(null)
  const [registrationFees, setRegistrationFees] = useState({})
  const [feeModal, setFeeModal] = useState(null)

  const schoolYearKeyLabel = schoolYearLabel(schoolYearStart)
  const reload = useMemo(() => ({ branch: selectedBranch }), [selectedBranch])

  useEffect(() => {
    let active = true
    fetchFormationFeesData(reload.branch)
      .then((data) => {
        if (!active) return
        setRows(data.rows)
        setPaymentsByEnrollment(data.paymentsByEnrollment)
        setError('')
      })
      .catch((err) => {
        console.error(err)
        if (active) setError(err.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [reload])

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
      .then((fees) => {
        if (active) setRegistrationFees(fees)
      })
      .catch((err) => console.error(err))
    return () => {
      active = false
    }
  }, [schoolYearKeyLabel])

  const schoolMonths = useMemo(() => buildSchoolMonths(schoolYearStart), [schoolYearStart])
  const today = useMemo(() => parseLocalDate(accountingDayBucket(new Date(nowTick))), [nowTick])
  const currentDayKey = accountingDayBucket(new Date(nowTick))

  // Un encaissement de formation est rattaché à une INSCRIPTION (élève × niveau).
  // On le ramène à l'élève : les KPI et l'historique comptent des élèves
  // distincts, pas des inscriptions.
  const studentIdByEnrollment = useMemo(
    () => Object.fromEntries(rows.map((row) => [row.id, row.studentId])),
    [rows]
  )

  const allPayments = useMemo(() => {
    const formationPayments = Object.entries(paymentsByEnrollment).flatMap(([enrollmentId, list]) =>
      (list || [])
        .filter(() => studentIdByEnrollment[enrollmentId])
        .map((payment) => ({ ...payment, student_id: studentIdByEnrollment[enrollmentId] }))
    )
    // Les frais d'inscription d'un élève « formation seule » sont encaissés sur
    // cette page : ils comptent donc dans cette caisse, et dans aucune autre —
    // la page Scolarité les exclut symétriquement.
    const formationOnlyIds = new Set(rows.filter((row) => row.formationOnly).map((row) => row.studentId))
    const feePayments = Object.values(registrationFees)
      .filter((fee) => fee.status === 'paid' && fee.paid_at && formationOnlyIds.has(fee.student_id))
      .map((fee) => ({
        id: `registration-${fee.id}`,
        student_id: fee.student_id,
        amount: Number(fee.amount || 0),
        paid_at: fee.paid_at,
        status: 'paid',
        paid_by: fee.validated_by || null,
      }))
    return [...formationPayments, ...feePayments]
  }, [paymentsByEnrollment, studentIdByEnrollment, registrationFees, rows])

  const scopedPayments = useMemo(
    () => (isCenterWide ? allPayments : allPayments.filter((payment) => payment.paid_by === user?.id)),
    [allPayments, isCenterWide, user?.id]
  )

  const stats = useMemo(() => {
    const totalCollected = scopedPayments
      .filter((payment) => accountingDayBucket(payment.paid_at) === currentDayKey)
      .reduce((sum, payment) => sum + toNumber(payment.amount), 0)

    // Un élève inscrit à deux formations ne compte qu'une fois.
    const monthPrefix = currentDayKey.slice(0, 7)
    const studentIds = new Set()
    for (const payment of scopedPayments) {
      if (accountingDayBucket(payment.paid_at).slice(0, 7) === monthPrefix) studentIds.add(payment.student_id)
    }

    const dueTotal = rows
      .filter((row) => row.active)
      .reduce((sum, row) => sum + toNumber(row.monthlyPrice), 0)

    return { totalCollected, billed: studentIds.size, dueTotal }
  }, [scopedPayments, rows, currentDayKey])

  const shown = useMemo(
    () =>
      rows.filter((row) =>
        `${row.studentName} ${row.code} ${row.formationName} ${row.levelName}`
          .toLowerCase()
          .includes(query.toLowerCase())
      ),
    [rows, query]
  )

  const paymentFor = (row, monthKey) =>
    (paymentsByEnrollment[row.id] || []).find((payment) => normalizeMonthKey(payment.month) === monthKey)

  const stateOf = (row, index) => {
    const monthKey = schoolMonths[index]?.key
    if (!monthKey) return 'disabled'
    // Avant son inscription à la formation, le mois n'a pas à être facturé.
    const enrolledMonth = normalizeMonthKey(row.enrolledAt)
    if (enrolledMonth && monthKey < enrolledMonth) return 'disabled'
    if (paymentFor(row, monthKey)) return 'paid'
    if (!row.active) return 'inactive'
    // L'échéance suit le jour d'inscription à la formation, pas le 1er du mois.
    const dueDate = billingDueDate(row.enrolledAt, monthKey)
    if (dueDate && today && today < dueDate) return 'pending'
    return 'unpaid'
  }

  const openCell = (row, index) => {
    const status = stateOf(row, index)
    if (status === 'disabled' || status === 'inactive') return
    setSelected({ row, index, status })
  }

  const validatePayment = async () => {
    if (!selected || saving) return
    setSaving(true)
    setError('')
    try {
      const { row, index } = selected
      const monthKey = schoolMonths[index].key
      const saved = await recordFormationPayment({
        enrollmentId: row.id,
        month: monthKey,
        amount: row.monthlyPrice,
        userId: user?.id || null,
      })
      setPaymentsByEnrollment((prev) => ({
        ...prev,
        [row.id]: [
          ...(prev[row.id] || []).filter((payment) => normalizeMonthKey(payment.month) !== monthKey),
          {
            id: saved.id,
            month: monthKey,
            amount: Number(saved.amount || 0),
            status: 'paid',
            paid_at: saved.paid_at,
            paid_by: saved.paid_by,
          },
        ],
      }))
      setSelected(null)
      await printFormationReceipt(row, schoolMonths[index].label, row.monthlyPrice, saved.paid_at)
    } catch (err) {
      console.error(err)
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const undoPayment = async () => {
    if (!selected || saving) return
    const { row, index } = selected
    const monthKey = schoolMonths[index].key
    const payment = paymentFor(row, monthKey)
    if (!payment?.id) return
    setSaving(true)
    setError('')
    try {
      await cancelFormationPayment(payment.id)
      setPaymentsByEnrollment((prev) => ({
        ...prev,
        [row.id]: (prev[row.id] || []).filter((item) => item.id !== payment.id),
      }))
      setSelected(null)
    } catch (err) {
      console.error(err)
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  // Le reçu est imprimé APRÈS l'enregistrement du paiement, et son échec ne doit
  // jamais laisser croire que l'encaissement a échoué : d'où le message distinct.
  const printFormationReceipt = async (row, monthLabel, amount, paidAt) => {
    try {
      await downloadPdfDocument(
        <FormationFeeReceiptPdf
          student={{ name: row.studentName, code: row.code, photoUrl: row.photoUrl }}
          formationName={row.formationName}
          levelName={row.levelName}
          groupName={row.groupName}
          monthLabel={monthLabel}
          amount={amount}
          dateLabel={formatFrenchDate(String(paidAt || new Date().toISOString()).slice(0, 10))}
        />,
        safeFilename(`recu-formation-${row.studentName}-${monthLabel}`)
      )
    } catch (err) {
      console.error(err)
      setError("Le paiement est bien enregistré, mais le reçu n'a pas pu être généré.")
    }
  }

  const registrationFeeOf = (row) => registrationFees[row.studentId] || null
  const registrationFeeAmountFor = (row) =>
    toNumber(registrationFeeOf(row)?.amount) || toNumber(appSettings?.registrationFee)

  const validateRegistrationFee = async () => {
    if (!feeModal || saving) return
    setSaving(true)
    setError('')
    try {
      const { row } = feeModal
      const amount = registrationFeeAmountFor(row)
      const saved = await payRegistrationFee({
        studentId: row.studentId,
        schoolYear: schoolYearKeyLabel,
        amount,
        userId: user?.id || null,
      })
      setRegistrationFees((prev) => ({ ...prev, [row.studentId]: saved }))
      setFeeModal(null)
      try {
        await downloadPdfDocument(
          <RegistrationFeeReceiptPdf
            student={{ name: row.studentName, code: row.code, level: row.formationName, photoUrl: row.photoUrl }}
            amount={amount}
            schoolYear={schoolYearKeyLabel}
            dateLabel={formatFrenchDate(String(saved.paid_at || '').slice(0, 10))}
          />,
          safeFilename(`recu-inscription-${row.studentName}-${schoolYearKeyLabel}`)
        )
      } catch (err) {
        console.error(err)
        setError("Les frais sont bien encaissés, mais le reçu n'a pas pu être généré.")
      }
    } catch (err) {
      console.error(err)
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  // La colonne « Frais d'inscription » se lit par ÉLÈVE, pas par inscription :
  // un élève suivant deux formations ne doit pas voir deux fois le même bouton.
  // On ne l'affiche donc que sur sa première ligne du tableau.
  const firstRowIdByStudent = useMemo(() => {
    const seen = new Map()
    for (const row of shown) {
      if (!seen.has(row.studentId)) seen.set(row.studentId, row.id)
    }
    return seen
  }, [shown])

  return (
    <div className="fees-page">
      <Header />
      <main className="fees-content">
        <div className="fees-heading">
          <h1>Comptabilité</h1>
          <p>Gestion financière du centre.</p>
        </div>
        <nav className="accounting-tabs">
          <Link to="/accounting/fees">Frais de scolarité</Link>
          <Link className="active" to="/accounting/formations">Frais de formation</Link>
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
            <span>{isCenterWide ? "Total encaissé aujourd'hui" : "Mes encaissements aujourd'hui"}</span>
            <strong>{stats.totalCollected.toLocaleString('fr-FR')} DH</strong>
            <i className="fee-stat-icon fee-stat-icon--green"><TrendingUp size={20} /></i>
          </article>
          <article>
            <span>{isCenterWide ? 'Élèves encaissés ce mois' : 'Mes élèves encaissés ce mois'}</span>
            <strong>{stats.billed}</strong>
            <i className="fee-stat-icon"><Users size={20} /></i>
          </article>
          <article>
            <span>Dû mensuel formations</span>
            <strong>{stats.dueTotal.toLocaleString('fr-FR')} DH</strong>
            <i className="fee-stat-icon"><Wallet size={20} /></i>
          </article>
        </section>

        {error && <div className="fees-error">Erreur : {error}</div>}

        <label className="fees-search">
          <Search size={22} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher un élève ou une formation..." />
        </label>

        {activeView === 'history' ? (
          <DailyHistoryPanel
            payments={scopedPayments}
            schoolMonths={schoolMonths}
            schoolYearStart={schoolYearStart}
            branchId={selectedBranch}
            isCenterWide={isCenterWide}
            currentDayKey={currentDayKey}
            sheetName="Historique formations"
            filePrefix="historique-formations"
          />
        ) : loading ? (
          <div className="fees-loading">Chargement des frais de formation...</div>
        ) : rows.length === 0 ? (
          <div className="fees-loading">
            Aucune inscription en formation. Créez vos formations dans Paramètres &gt; Formations,
            puis inscrivez un élève depuis la page Étudiants.
          </div>
        ) : (
          <div className="fees-table-wrap">
            <table className="fees-table">
              <thead>
                <tr>
                  <th>Élève</th>
                  <th>Formation</th>
                  <th>Niveau</th>
                  <th>Groupe</th>
                  <th>Dû/mois</th>
                  <th>Frais d'inscription</th>
                  {schoolMonths.map((month) => <th key={month.key}>{month.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {shown.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <div className="fee-student">
                        <span><b>{row.studentName}</b><small>{row.code}</small></span>
                      </div>
                    </td>
                    <td>{row.formationName}</td>
                    <td>{row.levelName}</td>
                    <td>{row.groupName || <span className="formation-no-group">—</span>}</td>
                    <td><b>{row.monthlyPrice.toLocaleString('fr-FR')} DH</b></td>
                    <td>
                      {!row.formationOnly ? (
                        // L'élève suit aussi un cursus : ses frais d'inscription
                        // se règlent sur le calendrier de scolarité, où il figure.
                        <span className="registration-elsewhere" title="Cet élève est inscrit à un cycle : ses frais d'inscription se règlent sur la page Frais de scolarité.">
                          Sur la scolarité
                        </span>
                      ) : firstRowIdByStudent.get(row.studentId) !== row.id ? (
                        <span className="registration-elsewhere">—</span>
                      ) : registrationFeeOf(row)?.status === 'paid' ? (
                        <span className="registration-badge paid">Payé</span>
                      ) : (
                        <button
                          className="registration-badge unpaid"
                          onClick={() => setFeeModal({ row })}
                          title="Valider le paiement des frais d'inscription"
                        >
                          Impayé
                        </button>
                      )}
                    </td>
                    {schoolMonths.map((month, index) => {
                      const status = stateOf(row, index)
                      return (
                        <td key={month.key}>
                          <button
                            aria-label={`${month.label} : ${status}`}
                            className={`payment-dot ${status}`}
                            disabled={status === 'inactive' || status === 'disabled'}
                            onClick={() => openCell(row, index)}
                          />
                        </td>
                      )
                    })}
                  </tr>
                ))}
                {shown.length === 0 && (
                  <tr><td colSpan={6 + schoolMonths.length} className="daily-history-empty">Aucun résultat pour cette recherche.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {selected && (
        <div className="fee-modal-bg" onMouseDown={() => !saving && setSelected(null)}>
          <section className="fee-modal" onMouseDown={(e) => e.stopPropagation()}>
            <h2>{selected.status === 'paid' ? 'Annuler le paiement' : 'Valider le paiement'}</h2>
            <p>
              <b>{selected.row.studentName}</b> — {selected.row.formationName} · {selected.row.levelName}
              <br />
              {schoolMonths[selected.index]?.label} · <b>{selected.row.monthlyPrice.toLocaleString('fr-FR')} DH</b>
            </p>
            <footer>
              <button type="button" onClick={() => setSelected(null)} disabled={saving}>Fermer</button>
              {selected.status === 'paid' ? (
                <button type="button" className="fee-danger" onClick={undoPayment} disabled={saving}>
                  {saving ? 'Annulation...' : 'Annuler le paiement'}
                </button>
              ) : (
                <button type="button" className="fee-validate" onClick={validatePayment} disabled={saving}>
                  {saving ? 'Validation...' : 'Valider le paiement'}
                </button>
              )}
            </footer>
          </section>
        </div>
      )}

      {feeModal && (
        <div className="fee-modal-bg" onMouseDown={() => !saving && setFeeModal(null)}>
          <section className="fee-modal" onMouseDown={(e) => e.stopPropagation()}>
            <h2>Frais d'inscription</h2>
            <p>
              <b>{feeModal.row.studentName}</b> — {schoolYearKeyLabel}
              <br />
              Montant : <b>{registrationFeeAmountFor(feeModal.row).toLocaleString('fr-FR')} DH</b>
            </p>
            <p className="formation-fee-note">
              Cet élève ne suit aucun cycle : ses frais d'inscription se règlent ici.
              Ils ne seront plus demandés cette année, même s'il rejoint un cycle plus tard.
            </p>
            <footer>
              <button type="button" onClick={() => setFeeModal(null)} disabled={saving}>Fermer</button>
              <button type="button" className="fee-validate" onClick={validateRegistrationFee} disabled={saving}>
                {saving ? 'Validation...' : 'Valider le paiement'}
              </button>
            </footer>
          </section>
        </div>
      )}
    </div>
  )
}
