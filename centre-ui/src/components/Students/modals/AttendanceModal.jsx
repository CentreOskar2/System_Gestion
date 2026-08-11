import { useState } from 'react'
import Icon from '../../Icon'
import { supabase } from '../../../supabaseClient'
import { attendanceItems } from '../data/mockStudents'
import { whatsappLink } from '../../Accounting/delinquenciesApi'
import { today } from '../utils/studentHelpers'

const formatDate = (value) => {
  const [year, month, day] = String(value || '').split('-')
  return year && month && day ? `${day}/${month}/${year}` : String(value || '')
}

const ARABIC_LABELS = {
  absence: 'غياب',
  cahier: 'الكراس غير مُحضَّر',
  exercice: 'التمرين غير منجَز / ناقص',
  betise: 'سلوك / مقالب',
  retard: 'تأخر',
}

const buildWhatsAppMessage = (student, date, lines) => {
  const list = lines.map((line) => `• ${line}`).join('\n')
  return (
    `مرحباً،\n\n` +
    `تقرير المتابعة للتلميذ(ة) *${student.name}* بتاريخ *${formatDate(date)}* :\n` +
    `${list}\n\n` +
    `يرجى التواصل مع إدارة مركز أوسكار عند الحاجة.\n\n` +
    `مع تحياتنا،\n*مركز أوسكار*`
  )
}

export default function AttendanceModal({ student, close }) {
  const [date, setDate] = useState(today())
  const [selected, setSelected] = useState([])
  const [details, setDetails] = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const toggle = (id) =>
    setSelected((items) =>
      items.includes(id) ? items.filter((item) => item !== id) : [...items, id]
    )

  const setDetail = (id, value) => setDetails((map) => ({ ...map, [id]: value }))

  const lineOf = (id) => {
    const text = ARABIC_LABELS[id] || id
    const detail = details[id]
    if (id === 'retard' && detail) return `تأخير: ${detail} دقائق`
    if (id === 'retard') return 'تأخير'
    if (detail) return `${text} (${detail})`
    return text
  }

  const handleSave = async () => {
    if (saving) return
    setError('')
    const rows = selected.map((id) => ({
      student_id: student.id,
      event_date: date,
      event_type: id,
      detail: id === 'retard' ? details[id] || null : details[id] || null,
    }))
    if (rows.length === 0) {
      setError('Cochez au moins un événement avant d’enregistrer.')
      return
    }
    if (!date) {
      setError('Choisissez une date avant d’enregistrer.')
      return
    }
    setSaving(true)
    try {
      const { error: insertError } = await supabase
        .from('student_events')
        .upsert(rows, { onConflict: 'student_id,event_date,event_type' })
      if (insertError) throw new Error(insertError.message)
      const message = buildWhatsAppMessage(student, date, selected.map(lineOf))
      const link = whatsappLink(student.phone, message)
      if (link) window.open(link, '_blank', 'noopener,noreferrer')
      close()
    } catch (err) {
      console.error(err)
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return <div className="student-overlay" onMouseDown={close}>
    <section className="attendance-modal" onMouseDown={(event) => event.stopPropagation()}>
      <button className="student-close" onClick={close}><Icon name="close" /></button>
      <h2>Pointage — {student.name}</h2><p>Cochez tous les événements applicables (cumulables).</p>
      <label className="attendance-date">Date<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
      {attendanceItems.map((item) => (
        <label className={`attendance-item ${selected.includes(item.id) ? 'checked' : ''}`} key={item.id}>
          <span><input type="checkbox" checked={selected.includes(item.id)} onChange={() => toggle(item.id)} />{item.text}</span>
          {selected.includes(item.id) && item.detail && (item.id === 'retard' ? (
            <label>Nombre de minutes<input type="number" value={details[item.id] || ''} onChange={(event) => setDetail(item.id, event.target.value)} /></label>
          ) : (
            <textarea placeholder={item.detail} value={details[item.id] || ''} onChange={(event) => setDetail(item.id, event.target.value)} />
          ))}
        </label>
      ))}
      {error && <p className="sheet-empty" style={{ marginTop: 14 }}>{error}</p>}
      <footer>
        <button onClick={close}>Annuler</button>
        <button onClick={handleSave} disabled={saving}>{saving ? 'Enregistrement...' : 'Enregistrer'}</button>
      </footer>
    </section>
  </div>
}
