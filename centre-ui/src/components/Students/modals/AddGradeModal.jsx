import { useEffect, useState } from 'react'
import Icon from '../../Icon'
import { supabase } from '../../../supabaseClient'
import { today } from '../utils/studentHelpers'

export default function AddGradeModal({ student, onSaved, close }) {
  const [subjectOptions, setSubjectOptions] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [grade, setGrade] = useState({
    subjectId: '',
    value: '',
    exam: '',
    session: 'S1',
    date: today(),
  })

  useEffect(() => {
    let cancelled = false
    async function loadSubjects() {
      try {
        // Au forfait l'élève suit toutes les matières du niveau : il n'a pas
        // d'inscription par matière dont on pourrait déduire la liste.
        if (student.isPackage) {
          const { data, error: subjectsError } = await supabase.from('subjects').select('id, name').order('name')
          if (subjectsError) throw new Error(subjectsError.message)
          if (!cancelled) setSubjectOptions((data || []).map((s) => ({ id: s.id, name: s.name })))
          return
        }
        const { data, error: fetchError } = await supabase
          .from('student_subscriptions')
          .select('subject_id, subjects(name)')
          .eq('student_id', student.id)
        if (fetchError) throw new Error(fetchError.message)
        if (cancelled) return
        const seen = new Map()
        for (const sub of data || []) {
          if (!sub.subject_id || !sub.subjects?.name) continue
          if (!seen.has(sub.subject_id)) seen.set(sub.subject_id, sub.subjects.name)
        }
        setSubjectOptions([...seen.entries()].map(([id, name]) => ({ id, name })))
      } catch (err) {
        if (cancelled) return
        console.error(err)
        setError(err.message || 'Erreur lors du chargement des matières')
        setSubjectOptions([])
      }
    }
    loadSubjects()
    return () => { cancelled = true }
  }, [student.id, student.isPackage])

  const stopPropagation = (e) => e.stopPropagation()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (saving) return
    setSaving(true)
    setError('')
    try {
      const { error: saveError } = await supabase.from('student_grades').insert({
        student_id: student.id,
        subject_id: grade.subjectId,
        value: Number(grade.value),
        exam: grade.exam || null,
        session: grade.session,
        grade_date: grade.date || null,
        created_at: new Date().toISOString(),
      })
      if (saveError) throw new Error(saveError.message)
      onSaved?.()
      close()
    } catch (err) {
      console.error(err)
      setError(err.message)
    } finally {
      setSaving(false)
    }
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
              value={grade.subjectId}
              onChange={(e) => setGrade({ ...grade, subjectId: e.target.value })}
              disabled={subjectOptions === null}
            >
              {subjectOptions === null ? (
                <option>Chargement des matières...</option>
              ) : (
                <>
                  <option value="">—</option>
                  {subjectOptions.map((subject) => (
                    <option key={subject.id} value={subject.id}>{subject.name}</option>
                  ))}
                </>
              )}
            </select>
            {subjectOptions && subjectOptions.length === 0 && (
              <small style={{ color: '#b45309' }}>
                Aucune matière inscrite pour cet élève.
              </small>
            )}
          </label>
          <label>
            Note (sur 20) *
            <input
              required
              type="number"
              min="0"
              max="20"
              step="0.25"
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
          {error && <p className="sheet-empty" style={{ color: '#c0392b' }}>{error}</p>}
          <footer>
            <button type="button" onClick={close} disabled={saving}>
              Annuler
            </button>
            <button disabled={saving || subjectOptions === null}>
              {saving ? 'Enregistrement…' : 'Ajouter'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  )
}
