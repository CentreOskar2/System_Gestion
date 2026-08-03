import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Header from '../shared/Header'
import { initials } from '../Students/utils/studentHelpers'
import './DelinquenciesPage.css'

const debtors = [
  { id: 1, name: 'Zakaria Jaidi', code: 'REG-2026-1003', level: 'Tronc commun', months: 2, days: 60, debt: 4200 },
  { id: 2, name: 'Zakaria Jaidi', code: 'REG-2026-1023', level: '2ème Bac', months: 2, days: 60, debt: 4200 },
  { id: 3, name: 'Rim Ouazzani', code: 'REG-2026-1018', level: 'Tronc commun', months: 2, days: 60, debt: 3400 },
  { id: 4, name: 'Rim Ouazzani', code: 'REG-2026-1038', level: '2ème Bac', months: 2, days: 60, debt: 3400 },
  { id: 5, name: 'Rayan Bennani', code: 'REG-2026-1007', level: '8ème (2AC)', months: 2, days: 60, debt: 3200 },
  { id: 6, name: 'Rayan Bennani', code: 'REG-2026-1027', level: '7ème (1AC)', months: 2, days: 60, debt: 3200 },
  { id: 7, name: 'Lina Ghazi', code: 'REG-2026-1002', level: '9ème (3AC)', months: 2, days: 60, debt: 2600 },
  { id: 8, name: 'Anas Tazi', code: 'REG-2026-1013', level: '1ère Bac', months: 2, days: 60, debt: 2600 },
]

export default function DelinquenciesPage() {
  const [reminded, setReminded] = useState([])
  const list = useMemo(() => [...debtors].sort((a, b) => b.debt - a.debt), [])
  const sendReminder = (id) => setReminded((items) => items.includes(id) ? items : [...items, id])

  return <div className="delinquencies-page"><Header /><main className="delinquencies-content">
    <div className="fees-heading"><h1>Comptabilité</h1><p>Gestion financière du centre.</p></div>
    <nav className="accounting-tabs">
      <Link to="/accounting/fees">Frais de scolarité</Link><Link className="active" to="/accounting/delinquencies">Retards & Impayés</Link><button>Salaires Profs</button><button>Charges</button><button>Bénéfice net</button>
    </nav>
    <section className="delinquency-stats">
      <article><div><span>Élèves en retard</span><strong>40</strong></div><i className="danger">!</i></article>
      <article><div><span>Dette totale accumulée</span><strong>80 400 DH</strong></div><i className="danger">▣</i></article>
      <article><div><span>Retard moyen</span><strong>60 jours</strong></div><i className="warning">◷</i></article>
    </section>
    <section className="delinquency-radar"><header><h2>Radar des défaillants</h2><p>Trié par dette décroissante</p></header><div className="radar-scroll"><table><thead><tr><th>Élève</th><th>Niveau</th><th>Mois impayés</th><th>Durée</th><th>Dette</th><th>Action</th></tr></thead><tbody>{list.map(student => <tr key={student.id}><td><div className="debtor"><i>{initials(student.name)}</i><span><b>{student.name}</b><small>{student.code}</small></span></div></td><td><span className="level-pill">{student.level}</span></td><td>{student.months}</td><td><span className="delay-pill">{student.days} j</span></td><td><strong className="debt">{student.debt.toLocaleString('fr-FR')} DH</strong></td><td><button className={reminded.includes(student.id) ? 'reminder sent' : 'reminder'} onClick={() => sendReminder(student.id)}>{reminded.includes(student.id) ? '✓ Rappel envoyé' : '◯  Rappel'}</button></td></tr>)}</tbody></table></div></section>
  </main></div>
}
