import { Link } from 'react-router-dom'
import Header from '../shared/Header'
import './ProfitPage.css'

const monthlyProfit = [12000, 15000, 14000, 18000, 22000, -61000, 0, 0, 0, 0]
const months = ['Sept', 'Oct', 'Nov', 'Déc', 'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin']
const branches = [
  { name: 'Succursale Centre', revenue: 5950, expenses: 2200, salaries: 7000 },
  { name: 'Succursale Sud', revenue: 5050, expenses: 20500, salaries: 10000 },
  { name: 'Succursale Nord', revenue: 5700, expenses: 28000, salaries: 7000 },
]
const format = (value) => `${Math.abs(value).toLocaleString('fr-FR')} DH`

function ProfitChart() {
  const width = 1040
  const height = 300
  const min = -75000
  const max = 25000
  const x = (index) => 48 + index * ((width - 80) / (months.length - 1))
  const y = (value) => 20 + ((max - value) / (max - min)) * (height - 44)
  const path = monthlyProfit.map((value, index) => `${index ? 'L' : 'M'} ${x(index)} ${y(value)}`).join(' ')
  const grid = [25000, 0, -25000, -50000, -75000]

  return <section className="profit-chart-card">
    <h2>Évolution du bénéfice net</h2>
    <div className="profit-chart-scroll">
      <svg className="profit-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Évolution mensuelle du bénéfice net">
        {grid.map(value => <g key={value}><line x1="48" x2={width - 18} y1={y(value)} y2={y(value)} className="profit-grid" /><text x="0" y={y(value) + 5}>{value}</text></g>)}
        {months.map((month, index) => <g key={month}><line x1={x(index)} x2={x(index)} y1="20" y2={height - 24} className="profit-grid" /><text x={x(index)} y={height - 4} textAnchor="middle">{month}</text></g>)}
        <path d={path} className="profit-line" />
      </svg>
    </div>
  </section>
}

export default function ProfitPage() {
  const revenue = 16700
  const costs = 77700
  const profit = revenue - costs

  return <div className="profit-page">
    <Header />
    <main className="profit-content">
      <div className="fees-heading"><h1>Comptabilité</h1><p>Gestion financière du centre.</p></div>
      <nav className="accounting-tabs">
        <Link to="/accounting/fees">Frais de scolarité</Link>
        <Link to="/accounting/delinquencies">Retards & Impayés</Link>
        <Link to="/accounting/salaries">Salaires Profs</Link>
        <Link to="/accounting/expenses">Charges</Link>
        <Link className="active" to="/accounting/profit">Bénéfice net</Link>
      </nav>

      <section className="profit-formula"><span>FORMULE</span><p><b>CA encaissé</b> − <em>Charges</em> − <em>Salaires Profs (validés)</em> = <strong>Bénéfice net</strong></p></section>
      <section className="profit-stats">
        <article><span>CA encaissé du mois</span><strong className="positive">{format(revenue)}</strong><i>↗</i></article>
        <article><span>Total charges + salaires</span><strong className="negative">{format(costs)}</strong><i>⊘</i></article>
        <article><span>Bénéfice net</span><strong className={profit < 0 ? 'negative' : 'positive'}>{profit < 0 ? '-' : ''}{format(profit)}</strong><i>▣</i></article>
      </section>
      <ProfitChart />
      <section className="profit-comparison">
        <h2>Comparatif par succursale</h2>
        <div className="profit-table-scroll"><table><thead><tr><th>Succursale</th><th>CA encaissé</th><th>Charges</th><th>Salaires</th><th>Bénéfice net</th><th>Marge</th></tr></thead><tbody>
          {branches.map(branch => {
            const net = branch.revenue - branch.expenses - branch.salaries
            const margin = Math.round((net / branch.revenue) * 100)
            return <tr key={branch.name}><td><b>{branch.name}</b></td><td>{format(branch.revenue)}</td><td>{format(branch.expenses)}</td><td>{format(branch.salaries)}</td><td className={net < 0 ? 'negative' : 'positive'}><b>{net < 0 ? '-' : ''}{format(net)}</b></td><td className={margin < 0 ? 'negative' : 'positive'}><b>{margin} %</b></td></tr>
          })}
        </tbody></table></div>
      </section>
    </main>
  </div>
}
