import { useEffect, useState } from 'react'
import Icon from '../../Icon'
import { supabase } from '../../../supabaseClient'
import { initials } from '../../Students/utils/studentHelpers'

const formatDate = (date) => {
  if (!date) return '—'
  return new Intl.DateTimeFormat('fr-MA').format(new Date(date))
}

export default function GroupDetailsModal({ group, close }) {
  const [students, setStudents] = useState([])
  const [teachers, setTeachers] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const [studentsRes, teachersRes] = await Promise.all([
        group && (group.studentIds || []).length > 0
          ? supabase
              .from('students')
              .select('id, first_name, last_name, registration_number, phone1, registration_date')
              .in('id', group.studentIds)
          : Promise.resolve({ data: [], error: null }),
        group
          ? supabase
              .from('teacher_group_subjects')
              .select('teacher_id, subject_id, teachers(first_name, last_name), subjects(name)')
              .eq('group_id', group.id)
          : Promise.resolve({ data: [], error: null }),
      ])
      if (cancelled) return
      setStudents(studentsRes.data || [])
      setTeachers(teachersRes.data || [])
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [group])

  const occupied = (group.studentIds || []).length
  const free = group.capacity != null ? Math.max(0, group.capacity - occupied) : null

  const filtered = students.filter((student) =>
    `${student.first_name} ${student.last_name}`.toLowerCase().includes(query.toLowerCase())
  )

  const teachersList = []
  for (const row of teachers) {
    let entry = teachersList.find((t) => t.id === row.teacher_id)
    if (!entry) {
      entry = {
        id: row.teacher_id,
        name: row.teachers ? `${row.teachers.first_name} ${row.teachers.last_name}`.trim() : 'Professeur',
        subjects: [],
      }
      teachersList.push(entry)
    }
    if (row.subjects?.name && !entry.subjects.includes(row.subjects.name)) entry.subjects.push(row.subjects.name)
  }

  const meta = [
    { label: 'Niveau', value: group.level || '—' },
    { label: 'Filière / Option', value: group.filiere || '—' },
  ]

  return (
    <div className="group-details-bg" onMouseDown={close}>
      <aside
        className="group-details"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <header className="group-details-header">
          <div>
            <small>Détails du groupe</small>
            <h2>{group.name}</h2>
          </div>
          <button className="group-close" onClick={close} type="button" aria-label="Fermer">
            <Icon name="close" />
          </button>
        </header>

        <div className="group-details-meta">
          {meta.map((item) => (
            <div className="group-details-meta-item" key={item.label}>
              <span>{item.label}</span>
              <b>{item.value}</b>
            </div>
          ))}
          <div className="group-details-meta-item">
            <span>Capacité</span>
            <b>{free !== null ? `${occupied} / ${group.capacity} places` : `${occupied} élève${occupied > 1 ? 's' : ''}`}</b>
          </div>
          <div className="group-details-meta-item">
            <span>Statut</span>
            <span className={`group-status ${group.active ? 'active' : ''}`}>
              {group.active ? 'Actif' : 'Inactif'}
            </span>
          </div>
        </div>

        {free !== null && (
          <div className="group-capacity-bar">
            <div style={{ width: `${group.capacity ? Math.min(100, (occupied / group.capacity) * 100) : 0}%` }} />
          </div>
        )}

        <div className="group-details-teachers">
          <div className="group-details-students-head">
            <strong>Professeurs ({teachersList.length})</strong>
          </div>
          {loading ? (
            <p className="group-students-loading">Chargement des professeurs...</p>
          ) : teachersList.length === 0 ? (
            <p className="group-students-empty">Aucun professeur assigné à ce groupe.</p>
          ) : (
            <div className="group-details-teachers-list">
              <div className="group-details-teacher-row group-details-teacher-row--head">
                <span>Professeur</span>
                <span>Matières enseignées</span>
              </div>
              {teachersList.map((teacher) => (
                <div className="group-details-teacher-row" key={teacher.id}>
                  <span className="group-details-teacher-name">
                    <i>{initials(teacher.name)}</i>
                    <b>{teacher.name}</b>
                  </span>
                  <span className="group-details-teacher-subjects">
                    {teacher.subjects.length > 0 ? teacher.subjects.join(', ') : '—'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="group-details-students">
          <div className="group-details-students-head">
            <strong>Élèves ({filtered.length})</strong>
          </div>
          {!loading && students.length > 0 && (
            <label className="group-details-search">
              <Icon name="search" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher un élève par nom..."
              />
            </label>
          )}
          {loading ? (
            <p className="group-students-loading">Chargement des élèves...</p>
          ) : students.length === 0 ? (
            <p className="group-students-empty">Aucun élève inscrit dans ce groupe.</p>
          ) : filtered.length === 0 ? (
            <p className="group-students-empty">Aucun élève trouvé pour « {query} ».</p>
          ) : (
            <div className="group-details-students-list">
              <div className="group-details-student-row group-details-student-row--head">
                <span>Élève</span>
                <span>Matricule</span>
                <span>Téléphone</span>
                <span>Inscription</span>
              </div>
              {filtered.map((student) => (
                <div className="group-details-student-row" key={student.id}>
                  <span className="group-details-student-name">
                    <i>{initials(`${student.first_name} ${student.last_name}`)}</i>
                    <b>{`${student.first_name} ${student.last_name}`}</b>
                  </span>
                  <span>{student.registration_number || '—'}</span>
                  <span>{student.phone1 || '—'}</span>
                  <span>{formatDate(student.registration_date)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>
    </div>
  )
}
