import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Coins, TrendingUp, Wallet } from 'lucide-react'
import Header from '../shared/Header'
import { supabase } from '../../supabaseClient'
import { useBranch } from '../../context/BranchContext'
import { academicMonths, calendarMonthOptions, currentMonthKey, schoolYearOptions } from './monthUtils'
import { subscribeFeesCache } from './feesApi'
import './NetProfitPage.css'

const CHART_LABELS = ['Sept', 'Oct', 'Nov', 'Déc', 'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin']
const PAID_STATUSES = ['paid', 'validé']

const sum = (items, pick) => items.reduce((total, item) => total + (Number(pick(item)) || 0), 0)
const sameMonth = (a, b) => String(a).slice(0, 7) === String(b).slice(0, 7)

function aggregateFrom(d, monthKey) {
  const ca = sum(d.paidPayments.filter((p) => sameMonth(p.month, monthKey)), (p) => p.amount)
  const charges = sum(d.manualExpenses.filter((e) => sameMonth(e.month, monthKey)), (e) => e.amount)
  const salaries = sum(d.validatedSalaries.filter((s) => sameMonth(s.month, monthKey)), (s) => s.amount)
  return { ca, charges, salaries, net: ca - charges - salaries }
}

const format = (value) => `${Math.abs(Number(value) || 0).toLocaleString('fr-FR')} DH`
const signed = (value) => `${value < 0 ? '-' : ''}${format(value)}`

function niceStep(rough) {
  if (!rough || rough <= 0) return 1
  const pow = 10 ** Math.floor(Math.log10(rough))
  const n = rough / pow
  const f = n < 1.5 ? 1 : n < 3.5 ? 2 : n < 7.5 ? 5 : 10
  return f * pow
}

function smoothPath(points) {
  if (!points.length) return ''
  let d = `M ${points[0].x} ${points[0].y}`
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[Math.max(0, i - 1)]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[Math.min(points.length - 1, i + 2)]
    const c1x = p1.x + (p2.x - p0.x) / 6
    const c1y = p1.y + (p2.y - p0.y) / 6
    const c2x = p2.x - (p3.x - p1.x) / 6
    const c2y = p2.y - (p3.y - p1.y) / 6
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x} ${p2.y}`
  }
  return d
}

function ProfitChart({ points }) {
  const width = 1040
  const height = 300
  const lineRef = useRef(null)

  useEffect(() => {
    const line = lineRef.current
    if (!line) return
    const length = line.getTotalLength()
    line.style.strokeDasharray = length
    line.style.strokeDashoffset = length
    line.getBoundingClientRect()
    line.style.transition = 'stroke-dashoffset 1.2s ease-out'
    line.style.strokeDashoffset = '0'
  }, [points])

  const values = points.map((p) => p.net)
  const min = Math.min(0, ...values)
  const max = Math.max(0, ...values)
  const pad = Math.max(1000, Math.ceil((max - min) * 0.08))
  const top = max + pad
  const bottom = min - pad
  const range = top - bottom || 1
  const step = niceStep(range / 4)
  const grid = []
  for (let v = Math.ceil(top / step) * step; v >= Math.floor(bottom / step) * step; v -= step) grid.push(v)

  const x = (index) => 48 + index * ((width - 80) / (points.length - 1))
  const y = (value) => 20 + ((top - value) / range) * (height - 44)
  const path = smoothPath(points.map((p, index) => ({ x: x(index), y: y(p.net) })))

  return (
    <section className="profit-chart-card">
      <h2>Évolution du bénéfice net</h2>
      <div className="profit-chart-scroll">
        <svg className="profit-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Évolution mensuelle du bénéfice net">
          {grid.map((value) => (
            <g key={value}>
              <line x1="48" x2={width - 18} y1={y(value)} y2={y(value)} className="profit-grid" />
              <text x="0" y={y(value) + 5}>{value.toLocaleString('fr-FR')}</text>
            </g>
          ))}
          {points.map((point, index) => (
            <g key={point.label}>
              <line x1={x(index)} x2={x(index)} y1="20" y2={height - 24} className="profit-grid" />
              <text x={x(index)} y={height - 4} textAnchor="middle">{point.label}</text>
            </g>
          ))}
          <path ref={lineRef} d={path} className="profit-line" />
        </svg>
      </div>
    </section>
  )
}

export default function NetProfitPage() {
  const { selectedBranch } = useBranch()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [reload, setReload] = useState(0)
  const initialPeriod = currentMonthKey()
  const [selectedMonthNumber, setSelectedMonthNumber] = useState(() => String(Number(initialPeriod.slice(5, 7))))
  const [selectedYear, setSelectedYear] = useState(() => initialPeriod.slice(0, 4))

  // An academic year begins in September: Jan–Aug belong to its following calendar year.
  const selectedCalendarYear = Number(selectedYear) + (Number(selectedMonthNumber) < 9 ? 1 : 0)
  const selectedMonth = `${selectedCalendarYear}-${selectedMonthNumber.padStart(2, '0')}-01`
  const monthOptions = calendarMonthOptions()
  const yearOptions = schoolYearOptions()

  const branchFilter = selectedBranch && selectedBranch !== 'all' ? selectedBranch : null

  useEffect(() => {
    let cancelled = false

    async function load() {
      let studentsQuery = supabase.from('students').select('id, branch_id')
      let expensesQuery = supabase.from('expenses').select('branch_id, month, amount, type')
      let teachersQuery = supabase.from('teachers').select('id, branch_id')
      if (branchFilter) {
        studentsQuery = studentsQuery.eq('branch_id', branchFilter)
        expensesQuery = expensesQuery.eq('branch_id', branchFilter)
        teachersQuery = teachersQuery.eq('branch_id', branchFilter)
      }
      const [paymentsRes, studentsRes, expensesRes, salariesRes, teachersRes, branchesRes, feesRes] = await Promise.all([
        supabase.from('student_payments').select('student_id, month, amount, status'),
        studentsQuery,
        expensesQuery,
        supabase.from('teacher_salaries').select('teacher_id, month, amount, status'),
        teachersQuery,
        supabase.from('branches').select('id, name, status'),
        supabase.from('registration_fees').select('student_id, amount, status, paid_at').eq('status', 'paid'),
      ])
      if (cancelled) return

      const studentBranch = Object.fromEntries((studentsRes.data || []).map((s) => [s.id, s.branch_id]))
      const teacherBranch = Object.fromEntries((teachersRes.data || []).map((t) => [t.id, t.branch_id]))

      // Registration fees count toward the month they were actually cashed in.
      const paidRegistrationFees = (feesRes.data || [])
        .filter((fee) => fee.paid_at)
        .map((fee) => ({
          student_id: fee.student_id,
          amount: fee.amount,
          status: 'paid',
          month: `${String(fee.paid_at).slice(0, 7)}-01`,
        }))

      let paidPayments = [
        ...(paymentsRes.data || []).filter((p) => PAID_STATUSES.includes(p.status)),
        ...paidRegistrationFees,
      ]
      let manualExpenses = (expensesRes.data || []).filter((e) => e.type !== 'Auto')
      let validatedSalaries = (salariesRes.data || []).filter((s) => s.status === 'paid' || s.status === 'validated')
      if (branchFilter) {
        paidPayments = paidPayments.filter((p) => studentBranch[p.student_id] === branchFilter)
        manualExpenses = manualExpenses.filter((e) => e.branch_id === branchFilter)
        validatedSalaries = validatedSalaries.filter((s) => teacherBranch[s.teacher_id] === branchFilter)
      }

      const chartMonths = academicMonths().slice(0, 10).map((m, index) => ({ ...m, label: CHART_LABELS[index] }))
      const payload = {
        paidPayments,
        manualExpenses,
        validatedSalaries,
        studentBranch,
        teacherBranch,
        activeBranches: (branchesRes.data || []).filter((b) => b.status === 'active'),
      }
      const points = chartMonths.map((m) => ({ ...m, ...aggregateFrom(payload, m.key) }))

      if (!cancelled) {
        setData({ ...payload, points })
        setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [reload, branchFilter])

  const current = data ? { key: selectedMonth, ...aggregateFrom(data, selectedMonth) } : null
  const branches = data
    ? data.activeBranches
        .filter((b) => (branchFilter ? b.id === branchFilter : true))
        .map((b) => {
          const ca = sum(data.paidPayments.filter((p) => data.studentBranch[p.student_id] === b.id && sameMonth(p.month, selectedMonth)), (p) => p.amount)
          const charges = sum(data.manualExpenses.filter((e) => e.branch_id === b.id && sameMonth(e.month, selectedMonth)), (e) => e.amount)
          const salaries = sum(data.validatedSalaries.filter((s) => data.teacherBranch[s.teacher_id] === b.id && sameMonth(s.month, selectedMonth)), (s) => s.amount)
          const net = ca - charges - salaries
          const margin = ca > 0 ? Math.round((net / ca) * 100) : 0
          return { id: b.id, name: b.name, ca, charges, salaries, net, margin }
        })
    : []

  useEffect(() => {
    const bump = () => setReload((count) => count + 1)
    const onStorage = (event) => {
      if (event.key === 'fees_cache_version') bump()
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') bump()
    }
    const unsubscribe = subscribeFeesCache(bump)
    window.addEventListener('storage', onStorage)
    window.addEventListener('focus', bump)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      unsubscribe()
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('focus', bump)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  return (
    <div className="profit-page">
      <Header />
      <main className="profit-content">
        <div className="fees-heading">
          <h1>Comptabilité</h1>
          <p>Gestion financière du centre.</p>
        </div>
        <nav className="accounting-tabs">
          <Link to="/accounting/fees">Frais de scolarité</Link>
          <Link to="/accounting/delinquencies">Retards & Impayés</Link>
          <Link to="/accounting/salaries">Salaires Profs</Link>
          <Link to="/accounting/expenses">Charges</Link>
          <Link className="active" to="/accounting/profit">Bénéfice net</Link>
        </nav>
        {loading || !data ? (
          <div className="fees-loading">Calcul du bénéfice net...</div>
        ) : (
          <>
            <div className="profit-period" aria-label="Période du bénéfice net">
              <label>
                <span>Mois</span>
                <select value={selectedMonthNumber} onChange={(event) => setSelectedMonthNumber(event.target.value)}>
                  {monthOptions.map((month) => (
                    <option key={month.value} value={month.value}>{month.label}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Année scolaire</span>
                <select value={selectedYear} onChange={(event) => setSelectedYear(event.target.value)}>
                  {yearOptions.map((year) => (
                    <option key={year.value} value={year.value}>{year.label}</option>
                  ))}
                </select>
              </label>
            </div>
            <section className="profit-formula">
              <span>FORMULE</span>
              <p>
                <b>CA encaissé</b> − <em>Charges</em> − <em>Salaires Profs (validés)</em> = <strong>Bénéfice net</strong>
              </p>
            </section>
            <section className="profit-stats">
              <article>
                <span>CA encaissé du mois</span>
                <strong className="positive">{format(current.ca)}</strong>
                <i><TrendingUp size={22} /></i>
              </article>
              <article>
                <span>Total charges + salaires</span>
                <strong className="negative">{format(current.charges + current.salaries)}</strong>
                <i><Coins size={22} /></i>
              </article>
              <article>
                <span>Bénéfice net</span>
                <strong className={current.net < 0 ? 'negative' : 'positive'}>{signed(current.net)}</strong>
                <i><Wallet size={22} /></i>
              </article>
            </section>
            <ProfitChart points={data.points} />
            <section className="profit-comparison">
              <h2>Comparatif par succursale</h2>
              <div className="profit-table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Succursale</th>
                      <th>CA encaissé</th>
                      <th>Charges</th>
                      <th>Salaires</th>
                      <th>Bénéfice net</th>
                      <th>Marge</th>
                    </tr>
                  </thead>
                  <tbody>
                    {branches.map((branch) => (
                      <tr key={branch.id}>
                        <td><b>{branch.name}</b></td>
                        <td>{format(branch.ca)}</td>
                        <td>{format(branch.charges)}</td>
                        <td>{format(branch.salaries)}</td>
                        <td className={branch.net < 0 ? 'negative' : 'positive'}><b>{signed(branch.net)}</b></td>
                        <td className={branch.margin < 0 ? 'negative' : 'positive'}><b>{branch.margin} %</b></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  )
}
