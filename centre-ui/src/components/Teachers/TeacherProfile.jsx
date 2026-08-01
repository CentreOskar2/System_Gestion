import Header from '../shared/Header'
import Icon from '../Icon'
import { initials } from '../Students/utils/studentHelpers'

const assignedGroups = [
  { level: '9ème (3AC)', code: 'G-C9-1', students: 3 },
  { level: 'Tronc commun', code: 'G-LT-1', students: 3 },
  { level: '8ème (2AC)', code: 'G-C8-1', students: 3 },
  { level: '2ème Bac', code: 'G-L2-1', students: 3 },
  { level: '7ème (1AC)', code: 'G-C7-1', students: 2 },
  { level: '1ère Bac', code: 'G-L1-1', students: 2 },
]

const salaryHistory = [
  { month: 'Nov 2025', status: 'Validé' }, { month: 'Déc 2025', status: 'Validé' },
  { month: 'Jan 2026', status: 'Validé' }, { month: 'Fév 2026', status: 'En attente' },
]

const formatAmount = (value) => `${Number(value || 0).toLocaleString('fr-FR')} DH`

export default function TeacherProfile({ teacher, onBack }) {
  const fullName = `${teacher.firstName} ${teacher.lastName}`
  const subject = teacher.subjects[0] || 'Matière non renseignée'
  const fixedSalary = teacher.paymentType === 'fixe'

  return <div className="teacher-profile-page">
    <Header />
    <main className="teacher-profile-content">
      <button className="teacher-profile-back" onClick={onBack}>← Retour aux professeurs</button>
      <div className="teacher-profile-layout">
        <aside className="teacher-profile-summary">
          <div className="teacher-profile-avatar">{initials(fullName)}</div>
          <h1>{fullName}</h1>
          <span className={`teacher-status ${teacher.active ? 'active' : ''}`}>{teacher.active ? 'Actif' : 'Inactif'}</span>
          <div className="teacher-contact-list">
            <p><Icon name="id" /> {teacher.cin}</p><p><Icon name="phone" /> {teacher.phone}</p>
            <p><Icon name="pin" /> {teacher.address || '—'}</p><p><Icon name="calendar" /> Embauché le {teacher.hiredAt || '—'}</p>
          </div>
        </aside>
        <section className="teacher-profile-details">
          <article className="teacher-profile-card teacher-remuneration"><div><h2>Rémunération</h2><p>{fixedSalary ? 'Salaire mensuel' : 'Taux par matière'}</p><strong>{fixedSalary ? formatAmount(teacher.salary) : `${teacher.rates?.[subject] || 0} %`}</strong></div><span className="pay-tag fixe">{fixedSalary ? 'Fixe' : 'Pourcentage'}</span></article>
          <article className="teacher-profile-card"><h2>Groupes assignés</h2><div className="teacher-groups-grid">{assignedGroups.map((group) => <div className="teacher-group-card" key={group.code}><strong>{subject}</strong><span>{group.level} · {group.code}</span><small>{group.students} élèves</small></div>)}</div></article>
          <article className="teacher-profile-card teacher-salary-history"><h2>Historique des salaires</h2><table><thead><tr><th>Mois</th><th>Montant</th><th>Statut</th></tr></thead><tbody>{salaryHistory.map((item) => <tr key={item.month}><td>{item.month}</td><td>{fixedSalary ? formatAmount(teacher.salary) : '—'}</td><td><span className={`salary-status ${item.status === 'Validé' ? 'valid' : 'pending'}`}>{item.status}</span></td></tr>)}</tbody></table></article>
        </section>
      </div>
    </main>
  </div>
}
