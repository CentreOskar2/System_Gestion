import { useState } from 'react'
import Icon from '../../Icon'
import { initials } from '../utils/studentHelpers'
import AddGradeModal from './AddGradeModal'

export default function StudentSheetModal({ student, close }) {
  // Mock local state for grades. In a real app, this would be fetched.
  const [grades, setGrades] = useState([
    { subject: 'Mathématiques', value: '16', exam: 'Ex 1', session: 'S2', date: '2026-01-10' },
    { subject: 'Physique-Chimie', value: '18', exam: 'Ex 2', session: 'S1', date: '2026-02-11' },
    { subject: 'SVT', value: '10', exam: 'Ex 3', session: 'S2', date: '2026-03-12' },
  ])
  const [gradeOpen, setGradeOpen] = useState(false)

  const addGrade = (newGrade) => {
    setGrades([...grades, newGrade])
  }

  const stopPropagation = (e) => e.stopPropagation()

  return (
    <>
      <div className="student-overlay sheet-overlay" onMouseDown={close}>
        <section className="student-sheet" onMouseDown={stopPropagation}>
          <button className="student-close" onClick={close}>
            <Icon name="close" />
          </button>
          <aside>
            <div className="sheet-profile">
              <span>{initials(student.name)}</span>
              <h2>{student.name}</h2>
              <small>{student.code}</small>
              <b>{student.level}</b>
            </div>
            <p>♟ &nbsp; 2013-04-13</p>
            <p>⌖ &nbsp; 13 Rue des Écoles, {student.branch}</p>
            <p>♧ &nbsp; {student.phone}</p>
            <p>☎ &nbsp; 0723200273 <small>(2)</small></p>
            <p>♜ &nbsp; Lycée Descartes · 4D</p>
            <section className="sheet-alerts">
              <h3>Alertes médicales / comportementales</h3>
              <p>{student.alerts || 'Aucune alerte enregistrée.'}</p>
            </section>
            <div className="sheet-contact">
              <button>⌕ &nbsp; Appeler</button>
              <button>◯ &nbsp; WhatsApp</button>
            </div>
          </aside>
          <main>
            <div className="paid-card">
              <small>MOIS PAYÉS</small>
              <strong>4/6</strong>
            </div>
            <section className="monthly">
              <header>
                <h3>⌁ &nbsp; Suivi mensuel</h3>
                <div>
                  <select>
                    <option>Février 2026</option>
                  </select>
                  <button>▣ &nbsp; Imprimer</button>
                </div>
              </header>
              <div className="monthly-stats">
                {[
                  ['ABSENCES', 2, 6],
                  ['CAHIERS', 0, 3],
                  ['EXERCICES', 1, 8],
                  ['BÊTISES', 0, 1],
                  ['RETARDS', 0, 3],
                ].map(([label, count, total]) => (
                  <div key={label}>
                    <small>{label}</small>
                    <b>{count}</b>
                    <span>Cumul : {total}</span>
                  </div>
                ))}
              </div>
            </section>
            <section className="grades">
              <header>
                <h3>Notes scolaires</h3>
                <button onClick={() => setGradeOpen(true)}>＋ Ajouter une note</button>
              </header>
              <table>
                <thead>
                  <tr>
                    <th>Matière</th>
                    <th>Note</th>
                    <th>N° examen</th>
                    <th>Session</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {grades.map((grade, i) => (
                    <tr key={`${grade.subject}-${i}`}>
                      <td><b>{grade.subject}</b></td>
                      <td><span>{grade.value} / 20</span></td>
                      <td>{grade.exam}</td>
                      <td>{grade.session}</td>
                      <td>{grade.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
            <section className="enrolled-subjects">
              <h3>Matières inscrites</h3>
              <div>
                {(student.chosen || ['Mathématiques', 'Français', 'Physique-Chimie']).map((subject, index) => (
                  <article key={subject}>
                    <b>{subject}</b>
                    <small>{student.subjectDetails?.[subject]?.group || `Groupe ${String.fromCharCode(65 + index)}`}</small>
                    <span>{student.subjectDetails?.[subject]?.priceType === 'manual'
                      ? `${student.subjectDetails[subject].manualPrice || 0} DH`
                      : index % 2 === 0 ? '450 DH' : '400 DH'}</span>
                  </article>
                ))}
              </div>
            </section>
          </main>
        </section>
      </div>
      {gradeOpen && <AddGradeModal add={addGrade} close={() => setGradeOpen(false)} />}
    </>
  )
}
