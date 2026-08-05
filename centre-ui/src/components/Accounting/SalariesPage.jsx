import { useRef, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import Header from '../shared/Header'
import { initials } from '../Students/utils/studentHelpers'
import { exportToPdf, safeFilename } from '../../utils/exportToPdf'
import { initialTeachers, mockGroups } from '../Teachers/data/mockTeachers'
import './SalariesPage.css'

// Helper to get groups matching a teacher's selection
function getMatchingGroups(cycles, levels, branches, subjects) {
  if (!cycles?.length || !levels?.length || !branches?.length || !subjects?.length) {
    return []
  }
  return mockGroups.filter(group => 
    cycles.includes(group.cycle) &&
    levels.includes(group.level) &&
    branches.includes(group.branch) &&
    subjects.includes(group.subject)
  )
}

// Calculate salary based on cycle-based rates
function calculateSalary(teacher) {
  if (teacher.paymentType === 'fixe') {
    return Number(teacher.salary) || 0
  }
  
  // For percentage-based, calculate based on groups
  const groups = getMatchingGroups(teacher.cycles, teacher.levels, teacher.branches, teacher.subjects)
  const rates = teacher.rates || {}
  
  let total = 0
  groups.forEach(group => {
    const cycleRate = rates[group.cycle] || 0
    total += (group.studentsCount * 500) * (cycleRate / 100)
  })
  
  return total
}

const teachers = initialTeachers.map(t => ({
  ...t,
  type: t.paymentType === 'fixe' ? 'Fixe' : 'Pourcentage',
  amount: calculateSalary(t),
  subjects: t.subjects.join(', '),
  name: `${t.firstName} ${t.lastName}`
}))

const students = ['Yasmine Alaoui', 'Adam Drissi', 'Lina Ghazi', 'Zakaria Jaidi', 'Ines Mansouri', 'Mehdi Peretti', 'Sara Saidi', 'Rayan Bennani', 'Aya El Ouafi', 'Ilyas Hakim', 'Nour Kabbaj', 'Amine Naciri', 'Salma Qadiri', 'Anas Tazi', 'Malak Chraibi', 'Youssef Fassi', 'Kenza Idrissi', 'Hamza Lahlou', 'Rim Ouazzani', 'Bilal Riad', 'Yasmine Alaoui', 'Adam Drissi', 'Lina Ghazi', 'Zakaria Jaidi', 'Ines Mansouri', 'Mehdi Peretti']

function Journal({ teacher, close }) {
  const journalRef = useRef(null)
  const [isExporting, setIsExporting] = useState(false)
  const percentage = teacher.type === 'Pourcentage'
  
  // Get groups for the teacher
  const groups = useMemo(() => {
    return getMatchingGroups(teacher.cycles, teacher.levels, teacher.branches, teacher.subjects)
  }, [teacher.cycles, teacher.levels, teacher.branches, teacher.subjects])
  
  // Calculate rates for each group based on cycle
  const groupsWithRates = groups.map(group => {
    const cycleRate = teacher.rates?.[group.cycle] || 0
    return {
      ...group,
      rate: cycleRate
    }
  })
  
  // Calculate total per group
  const groupTotals = groupsWithRates.map(group => {
    return group.studentsCount * 500
  })
  
  // Calculate total salary
  const totalSalary = groupsWithRates.reduce((sum, group, index) => {
    const rate = groupsWithRates[index].rate
    return sum + (groupTotals[index] * rate / 100)
  }, 0)
  
  const downloadPdf = async () => { setIsExporting(true); try { await exportToPdf(journalRef.current, `journal-salaire-${safeFilename(teacher.name)}.pdf`) } finally { setIsExporting(false) } }
  
  return (
    <div className="salary-overlay" onMouseDown={close}>
      <section ref={journalRef} className="salary-journal" onMouseDown={(event) => event.stopPropagation()}>
        <button className="salary-close" onClick={close}>×</button>
        <h2>Journal de salaire</h2>
        <div className="journal-teacher">
          <i>{initials(teacher.name)}</i>
          <span>
            <b>{teacher.name}</b>
            <small>Février 2026</small>
          </span>
          <em className={percentage ? 'percentage' : 'fixed'}>{teacher.type}</em>
        </div>
        
        {groups.length > 0 ? (
          groupsWithRates.map((group, index) => (
            <article className="journal-group" key={group.id}>
              <header>
                <div>
                  <b>{group.name}</b>
                  <small>{group.subject} · {group.level} · {group.branch} · {group.studentsCount} élèves</small>
                </div>
                {group.rate && <span>Taux : {group.rate}%</span>}
              </header>
              <table>
                <thead>
                  <tr>
                    <th>Élève</th>
                    <th>Prix matière</th>
                  </tr>
                </thead>
                <tbody>
                  {students.slice(0, group.studentsCount).map((student, i) => (
                    <tr key={`${student}-${i}`}>
                      <td>{student}</td>
                      <td>500 DH</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th>Total du groupe</th>
                    <th>{groupTotals[index].toLocaleString('fr-FR')} DH</th>
                  </tr>
                </tfoot>
              </table>
            </article>
          ))
        ) : (
          <p>Aucun groupe assigné à ce professeur</p>
        )}
        
        <section className="journal-summary">
          <h3>Récapitulatif</h3>
          <div className="summary-head">
            <span>Groupe / Matière</span>
            <span>Total groupe</span>
            <span>Taux</span>
            <span>Montant dû</span>
          </div>
          {groupsWithRates.map((group, index) => (
            <div className="summary-row" key={group.id}>
              <span>{group.name}</span>
              <span>{groupTotals[index].toLocaleString('fr-FR')} DH</span>
              <span>{group.rate ? `${group.rate}%` : 'Fixe'}</span>
              <span>{percentage ? `${Math.round(groupTotals[index] * group.rate / 100).toLocaleString('fr-FR')} DH` : `${teacher.amount.toLocaleString('fr-FR')} DH`}</span>
            </div>
          ))}
          <div className="summary-total">
            <b>Salaire total à verser</b>
            <strong>{totalSalary.toLocaleString('fr-FR')} DH</strong>
          </div>
        </section>
        <footer>
          <button disabled={isExporting} onClick={downloadPdf}>
            {isExporting ? 'Génération du PDF…' : '▣  Télécharger le PDF'}
          </button>
          <button onClick={close}>Fermer</button>
        </footer>
      </section>
    </div>
  )
}

export default function SalariesPage() {
  const [selected, setSelected] = useState(null)
  const [validated, setValidated] = useState([])
  const openJournal = (teacher, validate) => {
    if (validate) setValidated((items) => items.includes(teacher.id) ? items : [...items, teacher.id])
    setSelected(teacher)
  }
  
  return (
    <div className="salaries-page">
      <Header />
      <main className="salaries-content">
        <div className="fees-heading">
          <h1>Comptabilité</h1>
          <p>Gestion financière du centre.</p>
        </div>
        <nav className="accounting-tabs">
          <Link to="/accounting/fees">Frais de scolarité</Link>
          <Link to="/accounting/delinquencies">Retards & Impayés</Link>
          <Link className="active" to="/accounting/salaries">Salaires Profs</Link>
          <button>Charges</button>
          <button>Bénéfice net</button>
        </nav>
        <section className="salary-stats">
          <article>
            <span>Masse salariale du mois</span>
            <strong>{teachers.reduce((sum, t) => sum + t.amount, 0).toLocaleString('fr-FR')} DH</strong>
            <i>▣</i>
          </article>
          <article>
            <span>Profs — salaire fixe</span>
            <strong>{teachers.filter(t => t.paymentType === 'fixe').length}</strong>
            <i>↗</i>
          </article>
          <article>
            <span>Profs — pourcentage</span>
            <strong>{teachers.filter(t => t.paymentType === 'pourcentage').length}</strong>
            <i>%</i>
          </article>
        </section>
        <label className="salary-month">
          Mois : <select defaultValue="Février 2026">
            <option>Février 2026</option>
            <option>Janvier 2026</option>
            <option>Mars 2026</option>
          </select>
        </label>
        <section className="salary-table-wrap">
          <table className="salary-table">
            <thead>
              <tr>
                <th>Professeur</th>
                <th>Type</th>
                <th>Cycle(s) / Niveau(x)</th>
                <th>Montant calculé</th>
                <th>Statut</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {teachers.map(teacher => {
                const isValidated = validated.includes(teacher.id)
                return (
                  <tr key={teacher.id}>
                    <td>
                      <div className="salary-person">
                        <i>{initials(teacher.name)}</i>
                        <b>{teacher.name}</b>
                      </div>
                    </td>
                    <td>
                      <span className={teacher.paymentType === 'fixe' ? 'type-fixed' : 'type-percent'}>
                        {teacher.type}
                      </span>
                    </td>
                    <td>
                      <small>{teacher.cycles.join(', ')}</small>
                      <br />
                      <small style={{ color: '#647088' }}>{teacher.levels.join(', ')}</small>
                    </td>
                    <td>
                      <b>{teacher.amount.toLocaleString('fr-FR')} DH</b>
                    </td>
                    <td>
                      <span className={isValidated ? 'salary-status paid' : 'salary-status'}>
                        {isValidated ? 'Validé' : 'En attente'}
                      </span>
                    </td>
                    <td>
                      <div className="salary-actions">
                        {teacher.paymentType === 'pourcentage' && (
                          <button className="journal-button" onClick={() => openJournal(teacher, false)}>
                            ▣  Imprimer journal
                          </button>
                        )}
                        <button
                          className={isValidated ? 'validate-salary done' : 'validate-salary'}
                          onClick={() => openJournal(teacher, true)}
                        >
                          {isValidated ? '✓ Validé' : '✓  Valider'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>
        {selected && <Journal teacher={selected} close={() => setSelected(null)} />}
      </main>
    </div>
  )
}