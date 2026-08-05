import { useMemo } from 'react'
import Header from '../shared/Header'
import Icon from '../Icon'
import { initials } from '../Students/utils/studentHelpers'
import { getMatchingGroups } from './data/mockTeachers'

const salaryHistory = [
  { month: 'Nov 2025', status: 'Validé' }, { month: 'Déc 2025', status: 'Validé' },
  { month: 'Jan 2026', status: 'Validé' }, { month: 'Fév 2026', status: 'En attente' },
]

const formatAmount = (value) => `${Number(value || 0).toLocaleString('fr-FR')} DH`

export default function TeacherProfile({ teacher, onBack }) {
  const fullName = `${teacher.firstName} ${teacher.lastName}`
  const fixedSalary = teacher.paymentType === 'fixe'
  
  // Get groups matching the teacher's selection
  const assignedGroups = useMemo(() => {
    return getMatchingGroups(teacher.cycles, teacher.levels, teacher.branches, teacher.subjects)
  }, [teacher.cycles, teacher.levels, teacher.branches, teacher.subjects])
  
  // Calculate total salary based on cycle-based rates
  const totalSalary = useMemo(() => {
    if (fixedSalary) {
      return Number(teacher.salary) || 0
    }
    
    const groups = getMatchingGroups(teacher.cycles, teacher.levels, teacher.branches, teacher.subjects)
    const rates = teacher.rates || {}
    
    let total = 0
    groups.forEach(group => {
      const cycleRate = rates[group.cycle] || 0
      total += (group.studentsCount * 500) * (cycleRate / 100)
    })
    
    return total
  }, [teacher.cycles, teacher.levels, teacher.branches, teacher.subjects, teacher.rates, fixedSalary, teacher.salary])
  
  return (
    <div className="teacher-profile-page">
      <Header />
      <main className="teacher-profile-content">
        <button className="teacher-profile-back" onClick={onBack}>← Retour aux professeurs</button>
        <div className="teacher-profile-layout">
          <aside className="teacher-profile-summary">
            <div className="teacher-profile-avatar">{initials(fullName)}</div>
            <h1>{fullName}</h1>
            <span className={`teacher-status ${teacher.active ? 'active' : ''}`}>{teacher.active ? 'Actif' : 'Inactif'}</span>
            <div className="teacher-contact-list">
              <p><Icon name="id" /> {teacher.cin}</p>
              <p><Icon name="phone" /> {teacher.phone}</p>
              <p><Icon name="pin" /> {teacher.address || '—'}</p>
              <p><Icon name="calendar" /> Embauché le {teacher.hiredAt || '—'}</p>
            </div>
          </aside>
          <section className="teacher-profile-details">
            <article className="teacher-profile-card teacher-remuneration">
              <div>
                <h2>Rémunération</h2>
                <p>{fixedSalary ? 'Salaire mensuel' : 'Taux par cycle'}</p>
                <strong>
                  {fixedSalary 
                    ? formatAmount(teacher.salary) 
                    : `${totalSalary.toLocaleString('fr-FR')} DH`}
                </strong>
              </div>
              <span className={`pay-tag ${fixedSalary ? 'fixe' : 'pourcentage'}`}>
                {fixedSalary ? 'Fixe' : 'Pourcentage'}
              </span>
            </article>
            
            <article className="teacher-profile-card">
              <h2>Cycles et niveaux</h2>
              <div className="teacher-profile-remuneration">
                <div>
                  <strong>Cycles:</strong>
                  <p>{teacher.cycles.length > 0 ? teacher.cycles.join(', ') : 'Aucun'}</p>
                </div>
                <div>
                  <strong>Niveaux:</strong>
                  <p>{teacher.levels.length > 0 ? teacher.levels.join(', ') : 'Aucun'}</p>
                </div>
                <div>
                  <strong>Matières:</strong>
                  <p>{teacher.subjects.length > 0 ? teacher.subjects.join(', ') : 'Aucune'}</p>
                </div>
                <div>
                  <strong>Succursales:</strong>
                  <p>{teacher.branches.length > 0 ? teacher.branches.join(', ') : 'Aucune'}</p>
                </div>
              </div>
            </article>
            
            <article className="teacher-profile-card">
              <h2>Groupes assignés</h2>
              {assignedGroups.length > 0 ? (
                <div className="teacher-groups-grid">
                  {assignedGroups.map((group) => (
                    <div className="teacher-group-card" key={group.id}>
                      <strong>{group.subject}</strong>
                      <span>{group.level} · {group.branch} · {group.code}</span>
                      <small>{group.studentsCount} élèves</small>
                    </div>
                  ))}
                </div>
              ) : (
                <p>Aucun groupe assigné</p>
              )}
            </article>
            
            <article className="teacher-profile-card teacher-salary-history">
              <h2>Historique des salaires</h2>
              <table>
                <thead>
                  <tr>
                    <th>Mois</th>
                    <th>Montant</th>
                    <th>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {salaryHistory.map((item) => (
                    <tr key={item.month}>
                      <td>{item.month}</td>
                      <td>{fixedSalary ? formatAmount(teacher.salary) : '—'}</td>
                      <td>
                        <span className={`salary-status ${item.status === 'Validé' ? 'valid' : 'pending'}`}>
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </article>
          </section>
        </div>
      </main>
    </div>
  )
}