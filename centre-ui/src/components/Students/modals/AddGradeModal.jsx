import { useState } from 'react'
import Icon from '../../Icon'
import { subjects } from '../data/mockStudents'

export default function AddGradeModal({ close, add }) {
  const [grade, setGrade] = useState({
    subject: '',
    value: '',
    exam: '',
    session: 'S1',
    date: '2026-07-29',
  })

  const stopPropagation = (e) => e.stopPropagation()

  const handleSubmit = (e) => {
    e.preventDefault()
    add(grade)
    close()
  }

  return (
    <div className="student-overlay grade-overlay" onMouseDown={close}>
      <section className="grade-modal" onMouseDown={stopPropagation}>
        <button className="student-close" onClick={close}>
          <Icon name="close" />
        </button>
        <h2>Ajouter une note</h2>
        <form onSubmit={handleSubmit}>
          <label>
            Matière *
            <select
              required
              value={grade.subject}
              onChange={(e) => setGrade({ ...grade, subject: e.target.value })}
            >
              <option value="">—</option>
              {subjects.map((subject) => (
                <option key={subject}>{subject}</option>
              ))}
            </select>
          </label>
          <label>
            Note (sur 20) *
            <input
              required
              type="number"
              min="0"
              max="20"
              value={grade.value}
              onChange={(e) => setGrade({ ...grade, value: e.target.value })}
            />
          </label>
          <div>
            <label>
              N° examen
              <input
                value={grade.exam}
                onChange={(e) => setGrade({ ...grade, exam: e.target.value })}
              />
            </label>
            <label>
              Session
              <select
                value={grade.session}
                onChange={(e) => setGrade({ ...grade, session: e.target.value })}
              >
                <option>S1</option>
                <option>S2</option>
              </select>
            </label>
          </div>
          <label>
            Date
            <input
              type="date"
              value={grade.date}
              onChange={(e) => setGrade({ ...grade, date: e.target.value })}
            />
          </label>
          <footer>
            <button type="button" onClick={close}>
              Annuler
            </button>
            <button>Ajouter</button>
          </footer>
        </form>
      </section>
    </div>
  )
}
