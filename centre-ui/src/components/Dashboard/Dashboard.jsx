import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../Icon'
import Header from '../shared/Header'
import { MenuSelect } from '../shared/Menu'
import { useAuth } from '../../context/AuthContext'
import { useBranch } from '../../context/BranchContext'
import { supabase } from '../../supabaseClient'
import { buildDebtors } from '../Accounting/delinquenciesApi'
import { subscribeFeesCache } from '../Accounting/feesApi'
import { academicYearStart, currentMonthKey, isEnrolledInMonth, monthLabelOf } from '../Accounting/monthUtils'
import './Dashboard.css'

const MONTHS_SHORT = ['Sept', 'Oct', 'Nov', 'Déc', 'Janv', 'Févr', 'Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Août']
const MONTH_NAMES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]
const PAID_STATUSES = ['paid', 'validated', 'validé']
const EVOLUTION_MONTHS = 6

const schoolYears = [
  `${academicYearStart() - 1}-${academicYearStart()}`,
  `${academicYearStart()}-${academicYearStart() + 1}`,
  `${academicYearStart() + 1}-${academicYearStart() + 2}`,
]

const monthKeyOf = (value) => {
  const match = /^(\d{4})-(\d{2})/.exec(String(value || ''))
  return match ? `${match[1]}-${match[2]}-01` : String(value || '')
}

const monthsForYear = (startYear) => {
  const months = []
  for (let i = 0; i < 12; i += 1) {
    const monthNum = ((i + 8) % 12) + 1
    const year = startYear + (i >= 4 ? 1 : 0)
    months.push({
      key: `${year}-${String(monthNum).padStart(2, '0')}-01`,
      label: `${MONTH_NAMES[monthNum - 1]} ${year}`,
      short: MONTHS_SHORT[i],
    })
  }
  return months
}

const isPaid = (p) => p.status && p.status !== 'unpaid'

const fmtDH = (value) => `${Math.round(Number(value) || 0).toLocaleString('fr-FR')} DH`
const signedDH = (value) => `${Number(value) < 0 ? '−' : ''}${fmtDH(Math.abs(value))}`

const sum = (items, pick) => items.reduce((total, item) => total + (Number(pick(item)) || 0), 0)

function niceStep(rough) {
  if (!rough || rough <= 0) return 1
  const pow = 10 ** Math.floor(Math.log10(rough))
  const n = rough / pow
  const factor = n < 1.5 ? 1 : n < 3.5 ? 2 : n < 7.5 ? 5 : 10
  return factor * pow
}

/** Courbe lissée (Catmull-Rom convertie en courbes de Bézier). */
function smoothPath(points) {
  if (!points.length) return ''
  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[Math.max(0, i - 1)]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[Math.min(points.length - 1, i + 2)]
    const c1x = p1.x + (p2.x - p0.x) / 6
    const c1y = p1.y + (p2.y - p0.y) / 6
    const c2x = p2.x - (p3.x - p1.x) / 6
    const c2y = p2.y - (p3.y - p1.y) / 6
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`
  }
  return d
}

function StatCard({ title, value, note, tone, icon, negative }) {
  return (
    <article className={`stat-card tone-${tone}`}>
      <div className="stat-card__header">
        <span>{title}</span>
        <span className="stat-card__badge" aria-hidden="true"><Icon name={icon} /></span>
      </div>
      <strong className={negative ? 'db-kpi-value db-kpi-value--negative' : 'db-kpi-value'}>{value}</strong>
      <p className="db-kpi-note">{note}</p>
    </article>
  )
}

function RevenueLineChart({ series }) {
  const W = 760
  const H = 280
  const L = 58
  const R = W - 24
  const T = 18
  const B = H - 36

  const values = series.map((entry) => Number(entry.value) || 0)
  const step = niceStep(Math.max(1, ...values) / 4)
  const MAX = step * 4
  const ticks = [0, 1, 2, 3, 4].map((index) => step * index)

  const yFor = (value) => B - (value / MAX) * (B - T)
  const xFor = (index) => (series.length === 1 ? (L + R) / 2 : L + (index / (series.length - 1)) * (R - L))

  const points = series.map((entry, index) => ({ ...entry, x: xFor(index), y: yFor(values[index]) }))
  const lineD = smoothPath(points)
  const last = points[points.length - 1]
  const first = points[0]
  const areaD = `${lineD} L ${last.x.toFixed(2)} ${B} L ${first.x.toFixed(2)} ${B} Z`

  return (
    <svg className="chart-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Évolution du chiffre d'affaires">
      <defs>
        <linearGradient id="dbAreaGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b63f0" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#3b63f0" stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {ticks.map((tick) => (
        <g key={tick}>
          <line className="chart-grid" x1={L} x2={R} y1={yFor(tick)} y2={yFor(tick)} />
          <text className="chart-tick" x={L - 10} y={yFor(tick)} textAnchor="end" dominantBaseline="middle">
            {tick.toLocaleString('fr-FR')}
          </text>
        </g>
      ))}
      <line className="chart-axis" x1={L} x2={R} y1={B} y2={B} />

      <path d={areaD} fill="url(#dbAreaGradient)" />
      <path className="chart-line" d={lineD} />

      {points.map((point) => (
        <g key={point.key}>
          <circle className="db-chart-dot" cx={point.x} cy={point.y} r="4" />
          <circle className="chart-hit" cx={point.x} cy={point.y} r="15">
            <title>{`${point.label} — ${fmtDH(point.value)}`}</title>
          </circle>
        </g>
      ))}

      {points.map((point) => (
        <text key={`label-${point.key}`} className="chart-label" x={point.x} y={B + 22} textAnchor="middle">
          {point.label}
        </text>
      ))}
    </svg>
  )
}

function BranchBarChart({ items }) {
  const W = 400
  const H = 250
  const L = 42
  const R = W - 12
  const T = 20
  const B = H - 42

  if (!items.length) {
    return <div className="db-empty">Aucune donnée de rentabilité pour ce mois.</div>
  }

  const maxAbs = Math.max(1, ...items.flatMap((item) => [Math.abs(item.revenue), Math.abs(item.net)]))
  const scale = (B - T) / (2 * maxAbs)
  const zeroY = (T + B) / 2
  const slotW = (R - L) / items.length
  const barW = Math.max(6, Math.min(30, slotW * 0.28))

  const shortName = (name) => {
    const cleaned = String(name).replace(/^Center\s+/i, '')
    return cleaned.length > 13 ? `${cleaned.slice(0, 12)}…` : cleaned
  }

  return (
    <div className="db-bars-wrap">
      <svg className="chart-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Rentabilité par succursale">
        <line className="chart-axis" x1={L} x2={R} y1={zeroY} y2={zeroY} />
        {items.map((item, index) => {
          const cx = L + slotW * index + slotW / 2
          const revenueH = item.revenue * scale
          const netH = item.net * scale
          const revenueY = zeroY - revenueH
          const netY = zeroY - netH
          return (
            <g key={item.id}>
              <rect
                className="db-bar db-bar--revenue"
                x={cx - barW - 2}
                y={Math.min(revenueY, zeroY)}
                width={barW}
                height={Math.abs(revenueH)}
                rx="4"
              >
                <title>{`${item.name} — CA ${fmtDH(item.revenue)}`}</title>
              </rect>
              <rect
                className="db-bar db-bar--profit"
                x={cx + 2}
                y={Math.min(netY, zeroY)}
                width={barW}
                height={Math.abs(netH)}
                rx="4"
              >
                <title>{`${item.name} — Bénéfice ${signedDH(item.net)}`}</title>
              </rect>
              <text className="chart-label" x={cx} y={B + 18} textAnchor="middle">{shortName(item.name)}</text>
            </g>
          )
        })}
      </svg>
      <div className="chart__legend">
        <span><i className="legend legend--revenue" />CA (revenus)</span>
        <span><i className="legend legend--profit" />Bénéfice net</span>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { profile } = useAuth()
  const { selectedBranch } = useBranch()
  const navigate = useNavigate()

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const [monthKey, setMonthKey] = useState(() => currentMonthKey())
  const [year, setYear] = useState(schoolYears[1])

  const branchFilter = selectedBranch && selectedBranch !== 'all' ? selectedBranch : null

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError('')

      let studentsQuery = supabase.from('students').select('id, first_name, last_name, status, du_mois, branch_id, cycle_id, registration_date, created_at')
      let paymentsQuery = supabase.from('student_payments').select('student_id, month, amount, status')
      let salariesQuery = supabase.from('teacher_salaries').select('teacher_id, month, amount, status')
      let expensesQuery = supabase.from('expenses').select('id, title, amount, month, branch_id, type')
      let teachersQuery = supabase.from('teachers').select('id, first_name, last_name, branch_id, status')
      if (branchFilter) {
        studentsQuery = studentsQuery.eq('branch_id', branchFilter)
        expensesQuery = expensesQuery.eq('branch_id', branchFilter)
        teachersQuery = teachersQuery.eq('branch_id', branchFilter)
      }

      try {
        const [studentsRes, paymentsRes, salariesRes, expensesRes, teachersRes, branchesRes, cyclesRes, settingsRes, feesRes] = await Promise.all([
          studentsQuery,
          paymentsQuery,
          salariesQuery,
          expensesQuery,
          teachersQuery,
          supabase.from('branches').select('id, name, status').order('name'),
          supabase.from('cycles').select('id, name'),
          supabase.from('center_settings').select('center_name').limit(1).maybeSingle(),
          supabase.from('registration_fees').select('student_id, amount, status, paid_at').eq('status', 'paid'),
        ])
        if (cancelled) return

        const firstError = [studentsRes, paymentsRes, salariesRes, expensesRes, teachersRes, branchesRes, cyclesRes, settingsRes].find((result) => result.error)
        if (firstError) throw new Error(firstError.error.message)

        // Registration fees are revenue for the month they were cashed in.
        const registrationFeePayments = (feesRes.data || [])
          .filter((fee) => fee.paid_at)
          .map((fee) => ({
            student_id: fee.student_id,
            amount: fee.amount,
            status: 'paid',
            month: `${String(fee.paid_at).slice(0, 7)}-01`,
          }))

        setData({
          students: studentsRes.data || [],
          payments: [...(paymentsRes.data || []), ...registrationFeePayments],
          salaries: salariesRes.data || [],
          expenses: expensesRes.data || [],
          teachers: teachersRes.data || [],
          branches: branchesRes.data || [],
          cycles: cyclesRes.data || [],
          centerName: settingsRes.data?.center_name || 'Centre Oskar',
        })
      } catch (err) {
        console.error(err)
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()

    const unsubscribe = subscribeFeesCache(() => {
      if (!cancelled) setReload((count) => count + 1)
    })
    const onStorage = (event) => {
      if (event.key === 'fees_cache_version' && !cancelled) setReload((count) => count + 1)
    }
    window.addEventListener('storage', onStorage)
    window.addEventListener('focus', () => {
      if (!cancelled) setReload((count) => count + 1)
    })

    return () => {
      cancelled = true
      unsubscribe()
      window.removeEventListener('storage', onStorage)
    }
  }, [reload, branchFilter])

  const students = useMemo(() => data?.students || [], [data])
  const payments = useMemo(() => data?.payments || [], [data])
  const salaries = useMemo(() => data?.salaries || [], [data])
  const expenses = useMemo(() => data?.expenses || [], [data])
  const teachers = useMemo(() => data?.teachers || [], [data])
  const branches = useMemo(() => data?.branches || [], [data])

  const branchId = useMemo(() => {
    if (!branchFilter) return null
    const found = branches.find((b) => b.id === branchFilter)
    return found ? found.id : null
  }, [branchFilter, branches])

  const studentBranch = useMemo(() => Object.fromEntries(students.map((s) => [s.id, s.branch_id])), [students])
  const teacherBranch = useMemo(() => Object.fromEntries(teachers.map((t) => [t.id, t.branch_id])), [teachers])

  const yearStart = Number(String(year).split('-')[0])
  const monthsFor = useMemo(() => monthsForYear(yearStart), [yearStart])
  const monthOptions = useMemo(() => monthsFor.map((m) => m.label), [monthsFor])

  const activeMonthKey = useMemo(
    () => (monthsFor.some((m) => m.key === monthKey) ? monthKey : monthsFor[0]?.key || monthKey),
    [monthsFor, monthKey]
  )

  const monthLabel = monthLabelOf(activeMonthKey)
  const monthPrefix = String(activeMonthKey).slice(0, 7)

  const branchStudents = useMemo(
    () => (branchId ? students.filter((s) => s.branch_id === branchId) : students),
    [students, branchId]
  )
  const activeStudents = useMemo(
    () => branchStudents.filter((s) => s.status === 'active'),
    [branchStudents]
  )

  const incomeByMonth = useMemo(() => {
    const map = {}
    for (const payment of payments) {
      if (!isPaid(payment)) continue
      if (branchId && studentBranch[payment.student_id] !== branchId) continue
      const key = monthKeyOf(payment.month)
      map[key] = (map[key] || 0) + (Number(payment.amount) || 0)
    }
    return map
  }, [payments, branchId, studentBranch])

  const collected = incomeByMonth[activeMonthKey] || 0
  const expected = useMemo(() => sum(activeStudents, (s) => s.du_mois), [activeStudents])
  const pending = Math.max(0, expected - collected)

  const lateCount = useMemo(() => {
    const paidIds = new Set()
    for (const payment of payments) {
      if (!isPaid(payment)) continue
      if (String(payment.month).slice(0, 7) !== monthPrefix) continue
      if (branchId && studentBranch[payment.student_id] !== branchId) continue
      paidIds.add(payment.student_id)
    }
    return activeStudents.filter((s) => {
      if ((Number(s.du_mois) || 0) <= 0) return false
      if (paidIds.has(s.id)) return false
      return isEnrolledInMonth({ registrationDate: s.registration_date, createdAt: s.created_at }, `${monthPrefix}-01`)
    }).length
  }, [payments, activeStudents, monthPrefix, branchId, studentBranch])

  const branchTeachers = useMemo(
    () => (branchId ? teachers.filter((t) => t.branch_id === branchId) : teachers),
    [teachers, branchId]
  )
  const teacherCount = branchTeachers.length
  const teacherActive = useMemo(() => branchTeachers.filter((t) => t.status === 'active').length, [branchTeachers])

  const monthSalaries = useMemo(
    () => salaries.filter(
      (s) => PAID_STATUSES.includes(s.status)
        && String(s.month).slice(0, 7) === monthPrefix
        && (!branchId || teacherBranch[s.teacher_id] === branchId)
    ),
    [salaries, monthPrefix, branchId, teacherBranch]
  )
  const salaryTotal = useMemo(() => sum(monthSalaries, (s) => s.amount), [monthSalaries])

  const monthExpenses = useMemo(
    () => expenses.filter(
      (e) => e.type === 'Manuel'
        && String(e.month).slice(0, 7) === monthPrefix
        && (!branchId || e.branch_id === branchId)
    ),
    [expenses, monthPrefix, branchId]
  )
  const expenseTotal = useMemo(() => sum(monthExpenses, (e) => e.amount), [monthExpenses])

  const netProfit = collected - salaryTotal - expenseTotal

  const revenueSeries = useMemo(
    () => monthsFor.slice(0, EVOLUTION_MONTHS).map((m) => ({ key: m.key, label: m.short, value: incomeByMonth[m.key] || 0 })),
    [monthsFor, incomeByMonth]
  )

  const branchItems = useMemo(() => {
    const compute = (branch) => {
      const revenue = payments.reduce((total, payment) => {
        if (!isPaid(payment)) return total
        if (String(payment.month).slice(0, 7) !== monthPrefix) return total
        if (studentBranch[payment.student_id] !== branch.id) return total
        return total + (Number(payment.amount) || 0)
      }, 0)
      const salary = salaries.reduce((total, record) => {
        if (!PAID_STATUSES.includes(record.status)) return total
        if (String(record.month).slice(0, 7) !== monthPrefix) return total
        if (teacherBranch[record.teacher_id] !== branch.id) return total
        return total + (Number(record.amount) || 0)
      }, 0)
      const expense = expenses.reduce((total, record) => {
        if (record.type !== 'Manuel') return total
        if (String(record.month).slice(0, 7) !== monthPrefix) return total
        if (record.branch_id !== branch.id) return total
        return total + (Number(record.amount) || 0)
      }, 0)
      const net = revenue - salary - expense
      return { id: branch.id, name: branch.name, revenue, salary, expense, net }
    }

    if (branchId) {
      const branch = branches.find((b) => b.id === branchId)
      return branch ? [compute(branch)] : []
    }
    return branches
      .filter((b) => b.status === 'active')
      .map(compute)
      .filter((item) => item.revenue > 0 || item.salary > 0 || item.expense > 0 || item.net !== 0)
  }, [payments, salaries, expenses, branches, branchId, studentBranch, teacherBranch, monthPrefix])

  const notificationCount = useMemo(() => {
    if (!data) return 0
    const debtorStudents = students.map((s) => ({
      id: s.id,
      name: `${s.first_name} ${s.last_name}`.trim(),
      active: s.status === 'active',
      du_mois: s.du_mois,
      registrationDate: s.registration_date || (s.created_at || '').slice(0, 10),
      createdAt: s.created_at || '',
    }))
    const byStudent = {}
    for (const payment of payments) {
      if (!byStudent[payment.student_id]) byStudent[payment.student_id] = []
      byStudent[payment.student_id].push({ month: payment.month, amount: Number(payment.amount) || 0, status: payment.status })
    }
    return buildDebtors(debtorStudents, byStudent).length
  }, [data, students, payments])

  const greetingName = `${profile?.first_name || ''}`.trim() || 'Directeur'
  const subtitle = `${monthLabel} — Année scolaire ${year}`

  const goEnroll = () => navigate('/students', { state: { quick: 'enroll' } })
  const changeMonth = (label) => {
    const found = monthsFor.find((m) => m.label === label)
    if (found) setMonthKey(found.key)
  }

  const inactiveStudents = branchStudents.length - activeStudents.length

  const statCards = [
    {
      title: 'CA du mois',
      value: fmtDH(collected),
      tone: 'blue',
      icon: 'coin',
      note: (
        <span className="db-kpi-split">
          <span className="db-kpi-split__paid">Encaissé {fmtDH(collected)}</span>
          <span className="db-kpi-split__pending">En attente {fmtDH(pending)}</span>
        </span>
      ),
    },
    {
      title: 'Élèves en retard',
      value: lateCount,
      tone: 'red',
      icon: 'alert',
      note: lateCount > 0 ? `${lateCount} élève${lateCount > 1 ? 's' : ''} avec impayé${lateCount > 1 ? 's' : ''} du mois` : 'Aucun impayé ce mois',
    },
    {
      title: 'Total élèves',
      value: branchStudents.length,
      tone: 'blue',
      icon: 'users',
      note: `${activeStudents.length} actifs · ${inactiveStudents} inactifs`,
    },
    {
      title: 'Professeurs',
      value: teacherCount,
      tone: 'amber',
      icon: 'cap',
      note: `${teacherActive} actif${teacherActive > 1 ? 's' : ''}`,
    },
    {
      title: 'Bénéfice net',
      value: signedDH(netProfit),
      tone: 'green',
      icon: 'wallet',
      negative: netProfit < 0,
      note: `CA ${fmtDH(collected)} − (salaires ${fmtDH(salaryTotal)} + charges ${fmtDH(expenseTotal)})`,
    },
  ]

  if (loading && !data) {
    return (
      <div className="dashboard-main">
        <main className="content">
          <div className="db-skeleton db-skeleton--hero" />
          <div className="db-skeleton-grid">
            {[0, 1, 2, 3, 4].map((index) => <div className="db-skeleton" key={index} />)}
          </div>
          <div className="db-skeleton-grid db-skeleton-grid--wide">
            {[0, 1].map((index) => <div className="db-skeleton" key={index} />)}
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="dashboard-main">
      <Header notificationCount={notificationCount} />

      <main className="content">
        {error && (
          <div className="db-error" role="alert">
            <Icon name="alert" />
            <span>Impossible de charger certaines données : {error}</span>
            <button type="button" onClick={() => setReload((count) => count + 1)}>Réessayer</button>
          </div>
        )}

        <section className="db-title">
          <h1>Bonjour, {greetingName} 👋</h1>
          <p>{subtitle}</p>
        </section>

        <section className="controls db-controls" aria-label="Filtres de période">
          <MenuSelect
            className="pill"
            icon="calendar"
            label="Choisir le mois"
            value={monthLabel}
            options={monthOptions}
            onChange={changeMonth}
          />
          <MenuSelect
            className="pill pill--light"
            label="Choisir l'année scolaire"
            value={year}
            options={schoolYears}
            onChange={setYear}
          />
          <button type="button" className="primary" onClick={goEnroll}>
            <Icon name="user-plus" />
            Nouvelle inscription
          </button>
          <button type="button" className="secondary" onClick={() => navigate('/accounting/delinquencies')}>
            <Icon name="eye" />
            Voir les impayés
          </button>
        </section>

        <section className="metrics-grid" aria-label="Indicateurs clés">
          {statCards.map((card) => (
            <StatCard key={card.title} {...card} />
          ))}
        </section>

        <section className="analytics-grid">
          <article className="panel panel--wide">
            <div className="panel__head">
              <div>
                <h2>Évolution du chiffre d'affaires</h2>
                <p>Encaissements réels de {MONTHS_SHORT[0]} à {MONTHS_SHORT[EVOLUTION_MONTHS - 1]} — {year}</p>
              </div>
              <span className="db-panel-icon"><Icon name="trending-up" /></span>
            </div>
            <RevenueLineChart series={revenueSeries} />
          </article>

          <article className="panel">
            <div className="panel__head">
              <div>
                <h2>Rentabilité par succursale</h2>
                <p>Revenus contre bénéfice net — {monthLabel}</p>
              </div>
              <span className="db-panel-icon"><Icon name="building" /></span>
            </div>
            <BranchBarChart items={branchItems} />
          </article>
        </section>
      </main>
    </div>
  )
}
