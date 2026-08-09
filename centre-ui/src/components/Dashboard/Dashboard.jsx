import Icon from '../Icon'

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

const MONTHS = ['Sept', 'Oct', 'Nov', 'Déc', 'Janv', 'Févr']

function fmtDH(value) {
  return `${Math.round(value).toLocaleString('fr-FR')} DH`
}

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

function LineChart({ revenueSeries }) {
  const min = 22000
  const max = 24800
  const n = revenueSeries.length
  const pts = revenueSeries.map((value, index) => {
    const x = n === 1 ? 50 : (index / (n - 1)) * 100
    const y = 100 - ((value - min) / (max - min)) * 100
    return { x, y, value }
  })
  const curve = buildCurve(pts)
  const last = pts[pts.length - 1]
  const lineD = `M ${pts[0].x},${pts[0].y}${curve}`
  const areaD = `M ${pts[0].x},90 L ${pts[0].x},${pts[0].y}${curve} L ${last.x},${last.y} L ${last.x},90 Z`

  return (
    <div className="chart chart--line">
      <div className="chart__plot">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="revenue-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="rgba(57, 94, 255, 0.28)" />
              <stop offset="100%" stopColor="rgba(57, 94, 255, 0)" />
            </linearGradient>
          </defs>
          <path className="chart__area" d={areaD} />
          <path className="chart__line" d={lineD} />
        </svg>
        {pts.map((point, index) => (
          <span
            key={MONTHS[index]}
            className="chart__dot"
            style={{ left: `${point.x}%`, top: `${point.y}%` }}
            title={`${MONTHS[index]} — ${fmtDH(point.value)}`}
          />
        ))}
      </div>
      <div className="chart__labels">
        {MONTHS.map((label, index) => (
          <span key={label} style={{ left: `${(index / (n - 1)) * 100}%` }}>{label}</span>
        ))}
      </div>
    </div>
  )
}

function BranchChart({ branches }) {
  const maxMag = 22000
  const amplitude = 47

  const barStyle = (value) => {
    const pct = Math.min((Math.abs(value) / maxMag) * amplitude, amplitude)
    return value >= 0
      ? { top: `${50 - pct}%`, height: `${pct}%` }
      : { top: '50%', height: `${pct}%` }
  }

  return (
    <div className="chart chart--bars">
      <div className="bars">
        <div className="bars__zero" aria-hidden="true" />
        {branches.map((branch) => (
          <div className="bars__group" key={branch.name}>
            <div
              className="bar bar--revenue"
              style={barStyle(branch.revenue)}
              data-val={fmtDH(branch.revenue).replace(' DH', '')}
            />
            <div
              className={`bar bar--profit${branch.profit < 0 ? ' bar--below' : ''}`}
              style={barStyle(branch.profit)}
              data-val={fmtDH(branch.profit).replace(' DH', '')}
            />
            <span>{branch.name}</span>
          </div>
        ))}
      </div>
      <div className="chart__legend">
        <span><i className="legend legend--revenue" />CA</span>
        <span><i className="legend legend--profit" />Bénéfice</span>
      </div>
    </div>
  )
}

export default function Dashboard({ metrics, revenueSeries, branches }) {
  return (
    <div className="dashboard-main">
      <header className="topbar">
        <label className="searchbar">
          <span className="searchbar__icon">
            <Icon name="search" />
          </span>
          <input type="search" placeholder="Rechercher un élève, professeur..." />
        </label>

        <button type="button" className="branch-select">
          <span>Toutes les succursales</span>
          <span aria-hidden="true">⌄</span>
        </button>

        <button type="button" className="notifications" aria-label="Notifications">
          <Icon name="bell" />
          <span className="notifications__badge">40</span>
        </button>

        <div className="profile">
          <div className="profile__avatar">DA</div>
          <div>
            <strong>Directeur Oskar</strong>
            <span>Administrateur</span>
          </div>
        </div>
      </header>

      <main className="content">
        <section className="hero-card">
          <div>
            <h1>Bonjour, Directeur 👋</h1>
            <p>Vue globale — toutes les succursales · Période : Février 2026</p>
          </div>

          <div className="controls">
            <button type="button" className="pill">
              <Icon name="calendar" />
              Février
              <span aria-hidden="true">⌄</span>
            </button>
            <button type="button" className="pill pill--light">
              2026-2027
              <span aria-hidden="true">⌄</span>
            </button>
            <button type="button" className="primary">
              <span aria-hidden="true">+</span>
              Nouvelle inscription
            </button>
            <button type="button" className="secondary">
              <Icon name="eye" />
              Voir les impayés
            </button>
          </div>
        </section>

        <section className="metrics-grid" aria-label="Indicateurs clés">
          {metrics.map((metric) => (
            <StatCard key={metric.title} {...metric} />
          ))}
        </section>

        <section className="analytics-grid">
          <article className="panel panel--wide">
            <div className="panel__head">
              <div>
                <h2>Évolution du chiffre d'affaires — jusqu'à Février 2026</h2>
              </div>
            </div>
            <LineChart revenueSeries={revenueSeries} />
          </article>

          <article className="panel">
            <div className="panel__head">
              <div>
                <h2>Rentabilité par succursale</h2>
              </div>
            </div>
            <BranchChart branches={branches} />
          </article>
        </section>
      </main>
    </div>
  )
}
