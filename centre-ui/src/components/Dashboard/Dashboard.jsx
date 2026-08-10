import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../Icon'
import Header from '../shared/Header'
import { MenuSelect } from '../shared/Menu'

const ALL_BRANCHES = 'Toutes les succursales'

function fmtDH(value) {
  return `${Math.round(value).toLocaleString('fr-FR')} DH`
}

/** Étiquette courte (4 lettres) utilisée sous l'axe des mois. */
function shortMonth(month) {
  return month.slice(0, 4)
}

function StatCard({ title, value, note, tone, icon }) {
  return (
    <article className={`stat-card tone-${tone}`}>
      <div className="stat-card__header">
        <span>{title}</span>
        <span className="stat-card__badge" aria-hidden="true"><Icon name={icon} /></span>
      </div>
      <strong>{value}</strong>
      <p>{note}</p>
    </article>
  )
}

/** Courbe lissée (Catmull-Rom convertie en courbes de Bézier). */
function buildCurve(pts) {
  let d = ''
  for (let i = 0; i < pts.length - 1; i += 1) {
    const p0 = pts[i - 1] || pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] || p2
    const c1x = p1.x + (p2.x - p0.x) / 6
    const c1y = p1.y + (p2.y - p0.y) / 6
    const c2x = p2.x - (p3.x - p1.x) / 6
    const c2y = p2.y - (p3.y - p1.y) / 6
    d += ` C ${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`
  }
  return d
}

function LineChart({ series }) {
  const LEFT = 62
  const RIGHT = 746
  const TOP = 12
  const BOTTOM = 256
  const MAX = 26000
  const TICKS = [0, 6500, 13000, 19500, 26000]

  const n = series.length
  const yFor = (value) => BOTTOM - (value / MAX) * (BOTTOM - TOP)
  const xFor = (index) => (n === 1 ? (LEFT + RIGHT) / 2 : LEFT + (index / (n - 1)) * (RIGHT - LEFT))

  const pts = series.map((entry, index) => ({
    x: xFor(index),
    y: yFor(entry.revenue),
    entry,
  }))
  const lineD = `M ${pts[0].x},${pts[0].y}${buildCurve(pts)}`

  return (
    <svg
      className="chart-svg"
      viewBox="0 0 760 300"
      role="img"
      aria-label="Évolution du chiffre d'affaires"
    >
      {TICKS.map((tick) => (
        <g key={tick}>
          <line className="chart-grid" x1={LEFT} x2={RIGHT} y1={yFor(tick)} y2={yFor(tick)} />
          <text className="chart-tick" x={LEFT - 12} y={yFor(tick)} textAnchor="end" dominantBaseline="middle">
            {tick}
          </text>
        </g>
      ))}

      <line className="chart-axis" x1={LEFT} x2={LEFT} y1={TOP} y2={BOTTOM} />
      <line className="chart-axis" x1={LEFT} x2={RIGHT} y1={BOTTOM} y2={BOTTOM} />

      <path className="chart-line" d={lineD} />

      {pts.map((point) => (
        <circle key={point.entry.month} className="chart-hit" cx={point.x} cy={point.y} r="12">
          <title>{`${point.entry.month} — ${fmtDH(point.entry.revenue)}`}</title>
        </circle>
      ))}

      {pts.map((point) => (
        <text
          key={point.entry.month}
          className="chart-label"
          x={point.x}
          y={BOTTOM + 24}
          textAnchor="middle"
        >
          {shortMonth(point.entry.month)}
        </text>
      ))}
    </svg>
  )
}

function BranchChart({ branches }) {
  const LEFT = 56
  const RIGHT = 412
  const TOP = 14
  const BOTTOM = 254
  const MIN = -22500
  const MAX = 7500
  const TICKS = [7500, 0, -7500, -15000, -22500]
  const BAR_W = 26
  const GAP = 6

  const yFor = (value) => BOTTOM - ((value - MIN) / (MAX - MIN)) * (BOTTOM - TOP)
  const zeroY = yFor(0)
  const groupW = (RIGHT - LEFT) / Math.max(branches.length, 1)

  const bar = (value, x) => ({
    x,
    width: BAR_W,
    y: value >= 0 ? yFor(value) : zeroY,
    height: Math.abs(yFor(value) - zeroY),
  })

  return (
    <svg
      className="chart-svg"
      viewBox="0 0 420 300"
      role="img"
      aria-label="Rentabilité par succursale"
    >
      {TICKS.map((tick) => (
        <g key={tick}>
          <line className="chart-grid" x1={LEFT} x2={RIGHT} y1={yFor(tick)} y2={yFor(tick)} />
          <text className="chart-tick" x={LEFT - 10} y={yFor(tick)} textAnchor="end" dominantBaseline="middle">
            {tick}
          </text>
        </g>
      ))}

      {branches.map((branch, index) => {
        const center = LEFT + groupW * (index + 0.5)
        const revenue = bar(branch.revenue, center - BAR_W - GAP / 2)
        const profit = bar(branch.profit, center + GAP / 2)

        return (
          <g key={branch.name}>
            <rect className="chart-bar chart-bar--revenue" rx="3" {...revenue}>
              <title>{`${branch.name} — CA ${fmtDH(branch.revenue)}`}</title>
            </rect>
            <rect className="chart-bar chart-bar--profit" rx="3" {...profit}>
              <title>{`${branch.name} — Bénéfice ${fmtDH(branch.profit)}`}</title>
            </rect>
            <text className="chart-label" x={center} y={BOTTOM + 24} textAnchor="middle">
              {branch.name}
            </text>
          </g>
        )
      })}

      <line className="chart-zero" x1={LEFT} x2={RIGHT} y1={zeroY} y2={zeroY} />
    </svg>
  )
}

export default function Dashboard({ metrics, monthlySeries, schoolYears, branches }) {
  const navigate = useNavigate()

  const [month, setMonth] = useState('Février')
  const [year, setYear] = useState('2025-2026')
  const [branch, setBranch] = useState(ALL_BRANCHES)

  const monthNames = monthlySeries.map((entry) => entry.month)
  const branchOptions = [ALL_BRANCHES, ...branches.map((item) => `Succursale ${item.name}`)]
  const endYear = year.split('-')[1]

  // Le mois choisi borne la courbe : on affiche l'historique jusqu'à ce mois inclus.
  const shownSeries = useMemo(() => {
    const index = monthlySeries.findIndex((entry) => entry.month === month)
    return index < 0 ? monthlySeries : monthlySeries.slice(0, index + 1)
  }, [monthlySeries, month])

  const shownBranches = useMemo(
    () => (branch === ALL_BRANCHES ? branches : branches.filter((item) => `Succursale ${item.name}` === branch)),
    [branches, branch]
  )

  // La carte « CA du mois » suit le mois sélectionné, le reste des indicateurs est annuel.
  const shownMetrics = useMemo(() => {
    const current = shownSeries[shownSeries.length - 1]
    if (!current) return metrics
    return metrics.map((metric) =>
      metric.id === 'revenue'
        ? {
            ...metric,
            value: fmtDH(current.revenue),
            note: `${fmtDH(current.collected)} encaissé · ${fmtDH(current.revenue - current.collected)} dû`,
          }
        : metric
    )
  }, [metrics, shownSeries])

  return (
    <div className="dashboard-main">
      <Header branch={branch} onBranchChange={setBranch} branchOptions={branchOptions} />

      <main className="content">
        <section className="hero-card">
          <div>
            <h1>Bonjour, Directeur 👋</h1>
            <p>Vue globale — {branch.toLowerCase()} · Période : {month} {endYear}</p>
          </div>

          <div className="controls">
            <div className="period-group">
              <MenuSelect
                className="pill"
                icon="calendar"
                label="Choisir le mois"
                value={month}
                options={monthNames}
                onChange={setMonth}
              />
              <MenuSelect
                className="pill pill--light"
                label="Choisir l'année scolaire"
                value={year}
                options={schoolYears}
                onChange={setYear}
              />
            </div>
            <button
              type="button"
              className="primary"
              onClick={() => navigate('/students', { state: { enroll: true } })}
            >
              <Icon name="user-plus" />
              Nouvelle inscription
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => navigate('/accounting/delinquencies')}
            >
              <Icon name="eye" />
              Voir les impayés
            </button>
          </div>
        </section>

        <section className="metrics-grid" aria-label="Indicateurs clés">
          {shownMetrics.map((metric) => (
            <StatCard key={metric.title} {...metric} />
          ))}
        </section>

        <section className="analytics-grid">
          <article className="panel panel--wide">
            <div className="panel__head">
              <div>
                <h2>Évolution du chiffre d'affaires — jusqu'à {month} {endYear}</h2>
              </div>
            </div>
            <LineChart series={shownSeries} />
          </article>

          <article className="panel">
            <div className="panel__head">
              <div>
                <h2>Rentabilité par succursale</h2>
              </div>
            </div>
            <BranchChart branches={shownBranches} />
            <div className="chart__legend">
              <span><i className="legend legend--revenue" />CA</span>
              <span><i className="legend legend--profit" />Bénéfice</span>
            </div>
          </article>
        </section>
      </main>
    </div>
  )
}
