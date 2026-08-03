import { useEffect, useMemo, useState } from 'react'
import Icon from '../../Icon'
import { supabase } from '../../../supabaseClient'
import { initials } from '../../Students/utils/studentHelpers'

const toForm = (group) =>
  group
    ? {
        id: group.id,
        name: group.name || '',
        subject_id: group.subject_id || '',
        level_id: group.level_id || '',
        teacher_id: group.teacher_id || '',
        branch_id: group.branch_id || '',
        student_ids: group.student_ids || [],
      }
    : {
        name: '',
        subject_id: '',
        level_id: '',
        teacher_id: '',
        branch_id: '',
        student_ids: [],
      }

function Toast({ notice }) {
  if (!notice) return null
  return (
    <div className={`group-toast is-${notice.type}`} role="status">
      <span>{notice.type === 'success' ? '✓' : '✕'}</span>
      {notice.text}
    </div>
  )
}

export default function GroupModal({ group, close, save }) {
  const [form, setForm] = useState(() => toForm(group))
  const [subjects, setSubjects] = useState([])
  const [levels, setLevels] = useState([])
  const [branches, setBranches] = useState([])
  const [teachersData, setTeachersData] = useState({ teachers: [], subjectsByTeacher: {}, branchesByTeacher: {}, levelsByTeacher: {} })
  const [students, setStudents] = useState([])
  const [studentQuery, setStudentQuery] = useState('')
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState(null)

  const editing = Boolean(group)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [subjectsRes, levelsRes, branchesRes, teachersRes, tsRes, tbRes, tlRes] = await Promise.all([
        supabase.from('subjects').select('id, name').order('name'),
        supabase.from('levels').select('id, name').order('name'),
        supabase.from('branches').select('id, name').order('name'),
        supabase.from('teachers').select('id, first_name, last_name').order('first_name'),
        supabase.from('teacher_subjects').select('teacher_id, subject_id'),
        supabase.from('teacher_branches').select('teacher_id, branch_id'),
        supabase.from('teacher_levels').select('teacher_id, level_id'),
      ])
      if (cancelled) return
      if (subjectsRes.data) setSubjects(subjectsRes.data)
      if (levelsRes.data) setLevels(levelsRes.data)
      if (branchesRes.data) setBranches(branchesRes.data)
      if (teachersRes.data) {
        const subjectsByTeacher = {}
        for (const row of tsRes.data || []) {
          subjectsByTeacher[row.teacher_id] = [...(subjectsByTeacher[row.teacher_id] || []), row.subject_id]
        }
        const branchesByTeacher = {}
        for (const row of tbRes.data || []) {
          branchesByTeacher[row.teacher_id] = [...(branchesByTeacher[row.teacher_id] || []), row.branch_id]
        }
        const levelsByTeacher = {}
        for (const row of tlRes.data || []) {
          levelsByTeacher[row.teacher_id] = [...(levelsByTeacher[row.teacher_id] || []), row.level_id]
        }
        setTeachersData({
          teachers: teachersRes.data.map((t) => ({ id: t.id, name: `${t.first_name} ${t.last_name}` })),
          subjectsByTeacher,
          branchesByTeacher,
          levelsByTeacher,
        })
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoadingStudents(true)
      const { data } = await supabase
        .from('students')
        .select('id, first_name, last_name, levels(name)')
        .eq('branch_id', form.branch_id)
        .order('created_at')
      if (cancelled) return
      if (data) {
        setStudents(data.map((s) => ({
          id: s.id,
          name: `${s.first_name} ${s.last_name}`,
          level: s.levels?.name || '',
        })))
      }
      setLoadingStudents(false)
    }
    load()
    return () => { cancelled = true }
  }, [form.branch_id])

  const availableTeachers = useMemo(() => {
    const { teachers, subjectsByTeacher, branchesByTeacher, levelsByTeacher } = teachersData
    return teachers.filter((t) =>
      (!form.subject_id || (subjectsByTeacher[t.id] || []).includes(form.subject_id)) &&
      (!form.branch_id || (branchesByTeacher[t.id] || []).includes(form.branch_id)) &&
      (!form.level_id || (levelsByTeacher[t.id] || []).includes(form.level_id))
    )
  }, [teachersData, form.subject_id, form.branch_id, form.level_id])

  const update = (key, value) => {
    setForm((item) => {
      const next = { ...item, [key]: value }
      if (key === 'branch_id') next.student_ids = []
      if (key === 'subject_id' || key === 'level_id' || key === 'branch_id') next.teacher_id = ''
      return next
    })
  }

  const toggleStudent = (id) => {
    setForm((item) => ({
      ...item,
      student_ids: item.student_ids.includes(id)
        ? item.student_ids.filter((sid) => sid !== id)
        : [...item.student_ids, id],
    }))
  }

  const results = students.filter((student) =>
    student.name.toLowerCase().includes(studentQuery.toLowerCase())
  )

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setNotice(null)
    try {
      await save({ ...form }, editing)
    } catch (err) {
      setNotice({ type: 'error', text: err.message || 'Une erreur est survenue' })
      setSaving(false)
    }
  }

  const hasBranch = Boolean(form.branch_id)

  return (
    <div className="group-modal-bg" onMouseDown={close}>
      <section
        className="group-modal"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <button className="group-close" onClick={close} type="button" aria-label="Fermer">
          <Icon name="close" />
        </button>
        <h2>{editing ? 'Modifier le groupe' : 'Nouveau groupe'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="group-form-grid">
            <label>
              Nom du groupe *
              <input value={form.name} onChange={(e) => update('name', e.target.value)} required />
            </label>
            <label>
              Matière *
              <select value={form.subject_id} onChange={(e) => update('subject_id', e.target.value)} required>
                <option value="">—</option>
                {subjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <label>
              Niveau *
              <select value={form.level_id} onChange={(e) => update('level_id', e.target.value)} required>
                <option value="">—</option>
                {levels.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <label>
              Professeur *
              <select value={form.teacher_id} onChange={(e) => update('teacher_id', e.target.value)} required>
                <option value="">—</option>
                {availableTeachers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              {availableTeachers.length === 0 && (
                <small className="group-teacher-hint">
                  Aucun professeur ne correspond à la matière, au niveau et à la succursale choisis.
                </small>
              )}
            </label>
            <label>
              Succursale *
              <select value={form.branch_id} onChange={(e) => update('branch_id', e.target.value)} required>
                <option value="">—</option>
                {branches.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
          </div>
          <div className="group-students-head">
            <strong>Élèves ({form.student_ids.length} sélectionné{form.student_ids.length > 1 ? 's' : ''})</strong>
            <span>{hasBranch ? '' : 'Choisir d\'abord une succursale'}</span>
          </div>
          <label className="group-student-search">
            <Icon name="search" />
            <input
              value={studentQuery}
              onChange={(e) => setStudentQuery(e.target.value)}
              placeholder="Rechercher un élève..."
              disabled={!hasBranch}
            />
          </label>
          <div className="group-students">
            {!hasBranch ? (
              <p className="group-students-empty">Choisir d'abord une succursale pour voir les élèves.</p>
            ) : loadingStudents ? (
              <p className="group-students-loading">Chargement des élèves...</p>
            ) : results.length === 0 ? (
              <p className="group-students-empty">Aucun élève trouvé.</p>
            ) : (
              results.map((student) => (
                <label className={hasBranch ? '' : 'is-disabled'} key={student.id}>
                  <input
                    type="checkbox"
                    checked={form.student_ids.includes(student.id)}
                    onChange={() => toggleStudent(student.id)}
                    disabled={!hasBranch}
                  />
                  <span className="student-avatar">{initials(student.name)}</span>
                  <span className="student-details">
                    <b>{student.name}</b>
                    <small>{student.level || 'Niveau non renseigné'}</small>
                  </span>
                </label>
              ))
            )}
          </div>
          <footer>
            <button type="button" onClick={close}>Annuler</button>
            <button type="submit" disabled={saving}>
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </footer>
        </form>
        <Toast notice={notice} />
      </section>
    </div>
  )
}
