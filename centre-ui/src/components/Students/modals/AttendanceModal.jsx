import { useState } from 'react'
import Icon from '../../Icon'
import { attendanceItems } from '../data/mockStudents'

export default function AttendanceModal({ student, close }) {
  const [selected, setSelected] = useState(['betise', 'retard'])
  const toggle = (id) => setSelected((items) => items.includes(id) ? items.filter((item) => item !== id) : [...items, id])

  return <div className="student-overlay" onMouseDown={close}>
    <section className="attendance-modal" onMouseDown={(event) => event.stopPropagation()}>
      <button className="student-close" onClick={close}><Icon name="close" /></button>
      <h2>Pointage — {student.name}</h2><p>Cochez tous les événements applicables (cumulables).</p>
      <label className="attendance-date">Date<input type="date" defaultValue="2026-07-29" /></label>
      {attendanceItems.map((item) => <label className={`attendance-item ${selected.includes(item.id) ? 'checked' : ''}`} key={item.id}><span><input type="checkbox" checked={selected.includes(item.id)} onChange={() => toggle(item.id)} />{item.text}</span>{selected.includes(item.id) && item.detail && (item.id === 'retard' ? <label>Nombre de minutes<input type="number" defaultValue="10" /></label> : <textarea placeholder={item.detail} />)}</label>)}
      <footer><button onClick={close}>Annuler</button><button onClick={close}>Enregistrer</button></footer>
    </section>
  </div>
}
