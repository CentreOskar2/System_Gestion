import { useEffect, useMemo, useState } from 'react'
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

const buildWhatsAppMessage = (student, date, groupLabel, lines) => {
  const list = lines.map((line) => `• ${line}`).join('\n')
  const groupLine = groupLabel ? `\nMatière / groupe : *${groupLabel}*\n` : ''
  return (
    `مرحباً،\n\n` +
    `تقرير المتابعة للتلميذ(ة) *${student.name}* بتاريخ *${formatDate(date)}* :\n` +
    `${groupLine}${list}\n\n` +
    `يرجى التواصل مع إدارة مركز أوسكار عند الحاجة.\n\n` +
    `مع تحياتنا،\n*مركز أوسكار*`
  )
}

export default function AttendanceModal({ student, close }) {
  const [date, setDate] = useState(today())
  const [selected, setSelected] = useState([])
  const [details, setDetails] = useState({})
  const [selectedGroupId, setSelectedGroupId] = useState('')
  const [groupOptions, setGroupOptions] = useState([])
  const [loadingGroups, setLoadingGroups] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    async function fetchGroups() {
      if (!student?.id) return
      setLoadingGroups(true)
      try {
        const { data, error: fetchError } = await supabase
          .from('student_subscriptions')
          .select('group_id, subject_id, groups(name), subjects(name)')
          .eq('student_id', student.id)
          .order('group_id', { ascending: true })

        if (fetchError) throw new Error(fetchError.message)

        const uniqueGroups = new Map()
        for (const row of data || []) {
          const groupId = row.group_id
          if (!groupId) continue
          const subjectName = row.subjects?.name || 'Matière'
          const groupName = row.groups?.name || `Groupe ${groupId}`
          const label = `${subjectName} — ${groupName}`
          if (!uniqueGroups.has(groupId)) {
            uniqueGroups.set(groupId, { id: String(groupId), label, subjectName, groupName })
          }
        }

        const nextOptions = [...uniqueGroups.values()]
        if (!active) return
        setGroupOptions(nextOptions)
        setSelectedGroupId((previous) => previous || nextOptions[0]?.id || '')
      } catch (err) {
        console.error(err)
        if (active) {
          setGroupOptions([])
          setSelectedGroupId('')
        }
      } finally {
        if (active) setLoadingGroups(false)
      }
    }

    fetchGroups()
    return () => { active = false }
  }, [student?.id])

  const selectedGroupLabel = useMemo(
    () => groupOptions.find((option) => option.id === selectedGroupId)?.label || '',
    [groupOptions, selectedGroupId]
  )

  const toggle = (id) => {
    setSelected((items) => {
      const selectedState = items.includes(id)
      if (selectedState) {
        setDetails((map) => {
          const next = { ...map }
          delete next[id]
          return next
        })
        return items.filter((item) => item !== id)
      }
      return [...items, id]
    })
  }

  const setDetail = (id, value) => {
    setDetails((map) => {
      const next = { ...map }
      const clean = String(value ?? '').trim()
      if (!clean) delete next[id]
      else next[id] = clean
      return next
    })
  }

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

    if (!selectedGroupId) {
      setError('Sélectionnez une matière / groupe concerné avant d’enregistrer.')
      return
    }

    if (selected.length === 0) {
      setError('Cochez au moins un événement avant d’enregistrer.')
      return
    }

    if (!date) {
      setError('Choisissez une date avant d’enregistrer.')
      return
    }

    const rows = selected.map((id) => ({
      student_id: student.id,
      // groups.id est un uuid : le convertir en nombre donnerait NaN.
      group_id: selectedGroupId,
      event_date: date,
      event_type: id,
      detail: id === 'retard' ? details[id] || null : details[id] || null,
    }))

    setSaving(true)
    try {
      const { error: insertError } = await supabase
        .from('student_events')
        .upsert(rows, { onConflict: 'student_id,event_date,event_type,group_id' })
      if (insertError) throw new Error(insertError.message)
      const message = buildWhatsAppMessage(student, date, selectedGroupLabel, selected.map(lineOf))
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
      <h2>Pointage — {student.name}</h2>
      <p>Cochez tous les événements applicables (cumulables).</p>

      <label className="attendance-group">
        <span>Matière / Groupe concerné *</span>
        <select
          value={selectedGroupId}
          onChange={(event) => setSelectedGroupId(event.target.value)}
          disabled={loadingGroups || groupOptions.length === 0}
        >
          {groupOptions.length === 0 ? (
            <option value="">Aucune matière / groupe inscrit</option>
          ) : (
            <>
              <option value="">Sélectionner une matière...</option>
              {groupOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </>
          )}
        </select>
      </label>

      <label className="attendance-date">
        <span>Date</span>
        <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
      </label>

      {attendanceItems.map((item) => (
        <label className={`attendance-item ${selected.includes(item.id) ? 'checked' : ''}`} key={item.id}>
          <span>
            <input type="checkbox" checked={selected.includes(item.id)} onChange={() => toggle(item.id)} />
            {item.text}
          </span>
          {selected.includes(item.id) && item.id === 'retard' ? (
            <label className="attendance-detail-field">
              <span>Nombre de minutes</span>
              <input
                type="number"
                min="0"
                value={details[item.id] || ''}
                onChange={(event) => setDetail(item.id, event.target.value)}
              />
            </label>
          ) : null}
          {selected.includes(item.id) && item.id !== 'retard' ? (
            <textarea
              className="attendance-detail-field"
              placeholder="Détail (optionnel)..."
              value={details[item.id] || ''}
              onChange={(event) => setDetail(item.id, event.target.value)}
            />
          ) : null}
        </label>
      ))}

      {error && <p className="sheet-empty" style={{ marginTop: 14 }}>{error}</p>}
      <footer>
        <button onClick={close}>Annuler</button>
        <button onClick={handleSave} disabled={saving || loadingGroups || groupOptions.length === 0}>
          {saving ? 'Enregistrement...' : 'Enregistrer'}
        </button>
      </footer>
    </section>
  </div>
}
