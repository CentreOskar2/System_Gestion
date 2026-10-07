import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Header from '../shared/Header'
import { Search, TrendingUp, UserCheck, UserX } from 'lucide-react'
import { supabase } from '../../supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { useBranch } from '../../context/BranchContext'
import { fetchAllRows } from '../../utils/fetchAllRows'
import { fetchAppSettings } from '../../appSettings'
import { fetchRegistrationFees } from './registrationFeesApi'
import { fetchAccountingUsers } from './feesApi'
import {
  accountingDayBucket,
  currentMonthKey,
  formatFrenchDate,
  monthLabelOf,
  schoolYearLabel,
  schoolYearOptions,
} from './monthUtils'
import { initials } from '../Students/utils/studentHelpers'
import './FeesPage.css'
import './RegistrationFeesPage.css'

// Mêmes rôles « centre » que les autres pages d'encaissement : eux seuls voient
// la caisse entière, les autres ne voient que ce qu'ils ont eux-mêmes encaissé.
const CENTER_WIDE_ROLES = ['super_admin', 'admin', 'director']

// Valeur du filtre cycle pour les inscrits « formation seule » (sans cycle).
const FORMATION_ONLY = 'formation'

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

// Mois courant s'il appartient à l'année scolaire affichée, sinon toute l'année.
function defaultMonthFor(startYear) {
  const key = currentMonthKey()
  return buildSchoolMonths(startYear).some((m) => m.key === key) ? key.slice(0, 7) : ''
}

async function fetchStudents(branchId) {
  const { data, error } = await fetchAllRows(() => {
    let query = supabase
      .from('students')
      .select('id, first_name, last_name, registration_number, registration_date, created_at, phone1, status, level_id, cycle_id, branch_id, levels(name, cycle_id)')
      .order('id')
    if (branchId && branchId !== 'all') query = query.eq('branch_id', branchId)
    return query
  })
  if (error) throw new Error(error.message)
  return (data || []).map((s) => ({
    id: s.id,
    name: `${s.first_name || ''} ${s.last_name || ''}`.trim(),
    code: s.registration_number || '',
    registrationDate: s.registration_date || String(s.created_at || '').slice(0, 10),
    phone: s.phone1 || '',
    active: s.status === 'active',
    levelId: s.level_id || '',
    levelName: s.levels?.name || '',
    cycleId: s.cycle_id || s.levels?.cycle_id || '',
  }))
}

export default function RegistrationFeesPage() {
  const { user, role } = useAuth()
  const { selectedBranch } = useBranch()
  const isCenterWide = CENTER_WIDE_ROLES.includes(role)

  const [students, setStudents] = useState([])
  const [cycles, setCycles] = useState([])
  const [levels, setLevels] = useState([])
  const [fees, setFees] = useState({})
  const [appSettings, setAppSettings] = useState(null)
  const [accountingUsers, setAccountingUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [schoolYearStart, setSchoolYearStart] = useState(String(currentMonthKey().slice(0, 4)))
  const [month, setMonth] = useState(() => defaultMonthFor(currentMonthKey().slice(0, 4)))
  const [cycleFilter, setCycleFilter] = useState('')
  const [levelFilter, setLevelFilter] = useState('')
  // Liste ouverte au clic sur un KPI : 'paid', 'unpaid' ou null.
  const [openList, setOpenList] = useState(null)
  const [query, setQuery] = useState('')

  const schoolYearKeyLabel = schoolYearLabel(schoolYearStart)
  const schoolMonths = useMemo(() => buildSchoolMonths(schoolYearStart), [schoolYearStart])

  useEffect(() => {
    let active = true
    Promise.all([
      fetchStudents(selectedBranch),
      supabase.from('cycles').select('id, name').order('name'),
      supabase.from('levels').select('id, name, cycle_id').order('name'),
    ])
      .then(([studentRows, cyclesRes, levelsRes]) => {
        if (!active) return
        setStudents(studentRows)
        setCycles(cyclesRes.data || [])
        setLevels(levelsRes.data || [])
        setError(cyclesRes.error?.message || levelsRes.error?.message || '')
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
  }, [selectedBranch])

  useEffect(() => {
    let active = true
    fetchRegistrationFees(schoolYearKeyLabel)
      .then((rows) => {
        if (active) setFees(rows)
      })
      .catch((err) => console.error(err))
    return () => {
      active = false
    }
  }, [schoolYearKeyLabel])

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

  // Les noms des encaisseurs ne servent qu'à la vue « centre ».
  useEffect(() => {
    if (!isCenterWide) return undefined
    let active = true
    fetchAccountingUsers()
      .then((rows) => {
        if (active) setAccountingUsers(rows)
      })
      .catch((err) => console.error(err))
    return () => {
      active = false
    }
  }, [isCenterWide])

  const usersById = useMemo(
    () =>
      Object.fromEntries(
        accountingUsers.map((row) => [row.id, `${row.first_name || ''} ${row.last_name || ''}`.trim()])
      ),
    [accountingUsers]
  )

  const cycleNameById = useMemo(() => Object.fromEntries(cycles.map((c) => [c.id, c.name])), [cycles])
  const levelOptions = useMemo(
    () => (cycleFilter && cycleFilter !== FORMATION_ONLY ? levels.filter((l) => l.cycle_id === cycleFilter) : levels),
    [levels, cycleFilter]
  )

  const changeSchoolYear = (value) => {
    setSchoolYearStart(value)
    setMonth(defaultMonthFor(value))
  }

  const changeCycle = (value) => {
    setCycleFilter(value)
    setLevelFilter('')
  }

  // Fin de la période affichée (mois choisi, ou fin de l'année scolaire), au
  // format « AAAA-MM » : un élève inscrit après n'a encore rien à payer.
  const periodEnd = month || `${Number(schoolYearStart) + 1}-08`

  const filteredStudents = useMemo(
    () =>
      students.filter((student) => {
        if (cycleFilter === FORMATION_ONLY) {
          if (student.levelId) return false
        } else if (cycleFilter && student.cycleId !== cycleFilter) {
          return false
        }
        if (levelFilter && student.levelId !== levelFilter) return false
        return true
      }),
    [students, cycleFilter, levelFilter]
  )

  const { paidRows, unpaidRows, totalCollected } = useMemo(() => {
    const paid = []
    const unpaid = []
    for (const student of filteredStudents) {
      const fee = fees[student.id]
      const isPaid = fee?.status === 'paid'
      const paidMonth = isPaid ? accountingDayBucket(fee.paid_at).slice(0, 7) : ''
      // Payé pendant la période affichée : le mois choisi, ou toute l'année.
      const paidInPeriod = isPaid && (!month || paidMonth === month)
      if (paidInPeriod && (isCenterWide || fee.validated_by === user?.id)) {
        paid.push({ ...student, amount: toNumber(fee.amount), paidAt: fee.paid_at, paidBy: fee.validated_by })
      }
      // Non payé à la fin de la période : inscrit à cette date et pas encore
      // réglé (ou réglé seulement après). Un élève parti n'est plus relancé.
      const paidByPeriodEnd = isPaid && (!paidMonth || paidMonth <= periodEnd)
      if (!paidByPeriodEnd && student.active && student.registrationDate.slice(0, 7) <= periodEnd) {
        unpaid.push({ ...student, amount: toNumber(fee?.amount) || toNumber(appSettings?.registrationFee) })
      }
    }
    const byName = (a, b) => a.name.localeCompare(b.name, 'fr')
    return {
      paidRows: paid.sort(byName),
      unpaidRows: unpaid.sort(byName),
      totalCollected: paid.reduce((sum, row) => sum + row.amount, 0),
    }
  }, [filteredStudents, fees, month, periodEnd, isCenterWide, user?.id, appSettings])

  const shownRows = useMemo(() => {
    const listRows = openList === 'paid' ? paidRows : openList === 'unpaid' ? unpaidRows : []
    const text = query.trim().toLowerCase()
    if (!text) return listRows
    return listRows.filter((row) => `${row.name} ${row.code} ${row.phone}`.toLowerCase().includes(text))
  }, [openList, paidRows, unpaidRows, query])

  const periodLabel = month ? monthLabelOf(`${month}-01`) : schoolYearKeyLabel
  const classLabel = (row) =>
    row.levelId ? [cycleNameById[row.cycleId], row.levelName].filter(Boolean).join(' — ') : 'Formation seule'
  const toggleList = (name) => {
    setOpenList((current) => (current === name ? null : name))
    setQuery('')
  }

  return (
    <div className="fees-page registration-fees-page">
      <Header />
      <main className="fees-content">
        <div className="fees-heading">
          <h1>Comptabilité</h1>
          <p>Gestion financière du centre.</p>
        </div>
        <nav className="accounting-tabs">
          <Link to="/accounting/fees">Frais de scolarité</Link>
          <Link className="active" to="/accounting/registration-fees">Frais d'inscription</Link>
          <Link to="/accounting/formations">Frais de formation</Link>
          <Link to="/accounting/delinquencies">Retards & Impayés</Link>
          <Link to="/accounting/salaries">Salaires Profs</Link>
          <Link to="/accounting/expenses">Charges</Link>
          <Link to="/accounting/profit">Bénéfice net</Link>
        </nav>

        <div className="registration-filters">
          <label className="fees-year-select">
            <span>Année scolaire</span>
            <select value={schoolYearStart} onChange={(e) => changeSchoolYear(e.target.value)}>
              {schoolYearOptions().map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="fees-year-select">
            <span>Mois</span>
            <select value={month} onChange={(e) => setMonth(e.target.value)}>
              <option value="">Toute l'année</option>
              {schoolMonths.map((item) => (
                <option key={item.key} value={item.key.slice(0, 7)}>{item.label}</option>
              ))}
            </select>
          </label>
          <label className="fees-year-select">
            <span>Cycle</span>
            <select value={cycleFilter} onChange={(e) => changeCycle(e.target.value)}>
              <option value="">Tous les cycles</option>
              {cycles.map((cycle) => (
                <option key={cycle.id} value={cycle.id}>{cycle.name}</option>
              ))}
              <option value={FORMATION_ONLY}>Formation seule</option>
            </select>
          </label>
          <label className="fees-year-select">
            <span>Niveau</span>
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              disabled={cycleFilter === FORMATION_ONLY}
            >
              <option value="">Tous les niveaux</option>
              {levelOptions.map((level) => (
                <option key={level.id} value={level.id}>{level.name}</option>
              ))}
            </select>
          </label>
        </div>

        {error && <div className="fees-error">Erreur : {error}</div>}

        <section className="fee-stats">
          <article>
            <span>{isCenterWide ? 'Total encaissé' : 'Mes encaissements'} — {periodLabel}</span>
            <strong>{totalCollected.toLocaleString('fr-FR')} DH</strong>
            <i className="fee-stat-icon fee-stat-icon--green"><TrendingUp size={20} /></i>
          </article>
          <button
            type="button"
            className={`registration-kpi${openList === 'paid' ? ' active' : ''}`}
            onClick={() => toggleList('paid')}
            aria-pressed={openList === 'paid'}
          >
            <span>{isCenterWide ? 'Élèves payés' : 'Mes élèves encaissés'}</span>
            <strong>{loading ? '…' : paidRows.length}</strong>
            <small>Cliquez pour voir la liste</small>
            <i className="fee-stat-icon fee-stat-icon--green"><UserCheck size={20} /></i>
          </button>
          <button
            type="button"
            className={`registration-kpi unpaid${openList === 'unpaid' ? ' active' : ''}`}
            onClick={() => toggleList('unpaid')}
            aria-pressed={openList === 'unpaid'}
          >
            <span>Élèves non payés</span>
            <strong>{loading ? '…' : unpaidRows.length}</strong>
            <small>
              {unpaidRows.reduce((sum, row) => sum + row.amount, 0).toLocaleString('fr-FR')} DH à encaisser
            </small>
            <i className="fee-stat-icon fee-stat-icon--red"><UserX size={20} /></i>
          </button>
        </section>

        {openList && (
          <section className="registration-list">
            <header>
              <div>
                <h2>{openList === 'paid' ? 'Élèves payés' : 'Élèves non payés'}</h2>
                <p>
                  {openList === 'paid'
                    ? `Frais d'inscription encaissés — ${periodLabel}`
                    : `Frais d'inscription ${schoolYearKeyLabel} non réglés à la fin de : ${periodLabel}`}
                </p>
              </div>
              <button type="button" className="registration-list-close" onClick={() => setOpenList(null)}>Fermer</button>
            </header>
            <label className="fees-search registration-list-search">
              <Search size={20} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher un élève..." />
            </label>
            <div className="fees-table-wrap">
              <table className="fees-table registration-table">
                <thead>
                  <tr>
                    <th>Élève</th>
                    <th>Cycle / Niveau</th>
                    <th>Date d'inscription</th>
                    {openList === 'paid' ? (
                      <>
                        <th>Montant</th>
                        <th>Payé le</th>
                        {isCenterWide && <th>Encaissé par</th>}
                      </>
                    ) : (
                      <>
                        <th>Téléphone</th>
                        <th>Montant dû</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {shownRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="registration-empty">Aucun élève pour ce filtre.</td>
                    </tr>
                  ) : (
                    shownRows.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <div className="fee-student">
                            <i>{initials(row.name)}</i>
                            <span><b>{row.name}</b><small>{row.code}</small></span>
                          </div>
                        </td>
                        <td>{classLabel(row)}</td>
                        <td>{formatFrenchDate(row.registrationDate)}</td>
                        {openList === 'paid' ? (
                          <>
                            <td>{row.amount.toLocaleString('fr-FR')} DH</td>
                            <td>{formatFrenchDate(accountingDayBucket(row.paidAt))}</td>
                            {isCenterWide && <td>{usersById[row.paidBy] || (row.paidBy ? 'Utilisateur supprimé' : 'Non attribué')}</td>}
                          </>
                        ) : (
                          <>
                            <td>{row.phone || '—'}</td>
                            <td className="registration-due">{row.amount.toLocaleString('fr-FR')} DH</td>
                          </>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
