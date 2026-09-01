import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Coins, TrendingUp, Wallet } from 'lucide-react'
import Header from '../shared/Header'
import { supabase } from '../../supabaseClient'
import { useBranch } from '../../context/BranchContext'
import { academicMonths, calendarMonthOptions, currentMonthKey, schoolYearOptions } from './monthUtils'
import { subscribeFeesCache } from './feesApi'
import { computeTeacherSalaries, fetchSalaryContext } from './salariesApi'
import './NetProfitPage.css'

const CHART_LABELS = ['Sept', 'Oct', 'Nov', 'Déc', 'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août']
const PAID_STATUSES = ['paid', 'validé']
const UNASSIGNED = 'unassigned'

const sum = (items, pick) => items.reduce((total, item) => total + (Number(pick(item)) || 0), 0)
const sameMonth = (a, b) => String(a).slice(0, 7) === String(b).slice(0, 7)

// `scope` vaut null pour le centre entier, un id de succursale, ou UNASSIGNED
// pour ce qui n'est rattaché à aucune succursale active.
function inScope(branchId, scope, knownBranchIds) {
  if (!scope) return true
  if (scope === UNASSIGNED) return !branchId || !knownBranchIds.has(branchId)
  return branchId === scope
}

function aggregateFrom(d, monthKey, salaryRows, scope = null) {
  const known = d.knownBranchIds
  const ca = sum(
    d.paidPayments.filter((p) => sameMonth(p.month, monthKey) && inScope(d.studentBranch[p.student_id], scope, known)),
    (p) => p.amount
  )
  const charges = sum(
    d.manualExpenses.filter((e) => sameMonth(e.month, monthKey) && inScope(e.branch_id, scope, known)),
    (e) => e.amount
  )
  const salaries = sum(
    (salaryRows || []).filter((s) => inScope(s.branch_id, scope, known)),
    (s) => s.amount
  )
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
      if (branchFilter) {
        studentsQuery = studentsQuery.eq('branch_id', branchFilter)
        expensesQuery = expensesQuery.eq('branch_id', branchFilter)
      }
      const [paymentsRes, studentsRes, expensesRes, branchesRes, feesRes, salaryContext] = await Promise.all([
        supabase.from('student_payments').select('student_id, month, amount, status'),
        studentsQuery,
        expensesQuery,
        supabase.from('branches').select('id, name, status'),
        supabase.from('registration_fees').select('student_id, amount, status, paid_at').eq('status', 'paid'),
        fetchSalaryContext({ branchId: branchFilter }),
      ])
      if (cancelled) return

      const studentBranch = Object.fromEntries((studentsRes.data || []).map((s) => [s.id, s.branch_id]))

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
      // Les charges de type « Auto » sont les salaires validés : elles sont
      // déjà portées par le calcul de paie, les compter ici les doublerait.
      let manualExpenses = (expensesRes.data || []).filter((e) => e.type !== 'Auto')
      if (branchFilter) {
        paidPayments = paidPayments.filter((p) => studentBranch[p.student_id] === branchFilter)
        manualExpenses = manualExpenses.filter((e) => e.branch_id === branchFilter)
      }

      const activeBranches = (branchesRes.data || []).filter((b) => b.status === 'active')

      if (!cancelled) {
        setData({
          paidPayments,
          manualExpenses,
          studentBranch,
          salaryContext,
          activeBranches,
          knownBranchIds: new Set(activeBranches.map((b) => b.id)),
        })
        setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [reload, branchFilter])

  // Le graphique suit l'année scolaire choisie, et couvre ses douze mois :
  // juillet et août portent eux aussi des encaissements.
  const chartMonths = useMemo(
    () => academicMonths(Number(selectedYear)).map((m, index) => ({ ...m, label: CHART_LABELS[index] })),
    [selectedYear]
  )

  // Paie due pour un mois : le montant figé si elle a été validée, le calcul en
  // cours sinon. Le contexte est rejoué en mémoire, sans requête supplémentaire.
  const salariesByMonth = useMemo(() => {
    if (!data?.salaryContext) return {}
    const keys = new Set([selectedMonth, ...chartMonths.map((m) => m.key)])
    const result = {}
    for (const key of keys) {
      const { teachers } = computeTeacherSalaries(data.salaryContext, key)
      result[key.slice(0, 7)] = teachers.map((t) => ({
        branch_id: t.branch_id,
        amount: Number(t.effectiveAmount) || 0,
      }))
    }
    return result
  }, [data, selectedMonth, chartMonths])

  const salaryRowsFor = (monthKey) => salariesByMonth[String(monthKey).slice(0, 7)] || []

  const points = useMemo(
    () => (data ? chartMonths.map((m) => ({ ...m, ...aggregateFrom(data, m.key, salaryRowsFor(m.key)) })) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, chartMonths, salariesByMonth]
  )

  const current = data ? { key: selectedMonth, ...aggregateFrom(data, selectedMonth, salaryRowsFor(selectedMonth)) } : null

  const branches = useMemo(() => {
    if (!data) return []
    const salaryRows = salaryRowsFor(selectedMonth)
    const withMargin = (scope, id, name) => {
      const totals = aggregateFrom(data, selectedMonth, salaryRows, scope)
      return {
        id,
        name,
        ...totals,
        // Une marge de 0 % sur un mois déficitaire serait un contresens : sans
        // chiffre d'affaires il n'y a pas de marge à exprimer.
        margin: totals.ca > 0 ? Math.round((totals.net / totals.ca) * 100) : null,
      }
    }
    const rows = data.activeBranches
      .filter((b) => (branchFilter ? b.id === branchFilter : true))
      .map((b) => withMargin(b.id, b.id, b.name))

    // Ce qui n'est rattaché à aucune succursale active (loyer du centre,
    // succursale fermée…) : sans cette ligne, le tableau ne totalise pas le KPI.
    if (!branchFilter) {
      const orphan = withMargin(UNASSIGNED, UNASSIGNED, 'Centre (sans succursale)')
      if (orphan.ca || orphan.charges || orphan.salaries) rows.push(orphan)
    }
    return rows
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, selectedMonth, salariesByMonth, branchFilter])

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
                <b>CA encaissé</b> − <em>Charges</em> − <em>Salaires Profs (validés + en attente)</em> = <strong>Bénéfice net</strong>
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
            <ProfitChart points={points} />
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
                        <td className={branch.margin != null && branch.margin < 0 ? 'negative' : 'positive'}>
                          <b>{branch.margin == null ? '—' : `${branch.margin} %`}</b>
                        </td>
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
