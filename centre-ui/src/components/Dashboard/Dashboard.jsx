import Icon from '../Icon'

function StatCard({ title, value, note, tone }) {
  return (
    <article className={`stat-card tone-${tone}`}>
      <div className="stat-card__header">
        <span>{title}</span>
        <span className="stat-card__badge" aria-hidden="true" />
      </div>
      <strong>{value}</strong>
      <p>{note}</p>
    </article>
  )
}

function LineChart({ revenueSeries }) {
  const points = revenueSeries
    .map((value, index) => {
      const x = (index / (revenueSeries.length - 1)) * 100
      const min = 22000
      const max = 24800
      const y = 100 - ((value - min) / (max - min)) * 100
      return `${x},${y}`
    })
    .join(' ')

  return (
    <div className="chart chart--line" aria-label="Évolution du chiffre d'affaires">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="revenue-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgba(57, 94, 255, 0.28)" />
            <stop offset="100%" stopColor="rgba(57, 94, 255, 0)" />
          </linearGradient>
        </defs>
        <polyline
          points={`0,90 ${points} 100,90`}
          fill="url(#revenue-fill)"
          stroke="none"
        />
        <polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
      <div className="chart__labels">
        {['Sept', 'Octo', 'Nove', 'Déce', 'Janv', 'Févr'].map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
    </div>
  )
}

function BranchChart({ branches }) {
  const scale = 23000

  return (
    <div className="chart chart--bars" aria-label="Rentabilité par succursale">
      <div className="bars">
        {branches.map((branch) => (
          <div className="bars__group" key={branch.name}>
            <div className="bars__stack">
              <div
                className="bar bar--revenue"
                style={{ height: `${Math.max((branch.revenue / scale) * 100, 12)}%` }}
              />
              <div
                className="bar bar--profit"
                style={{ height: `${Math.max((Math.abs(branch.profit) / scale) * 100, 18)}%` }}
              />
            </div>
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
