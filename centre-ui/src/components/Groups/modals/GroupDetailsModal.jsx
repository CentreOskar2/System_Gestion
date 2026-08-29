import { useEffect, useState } from 'react'
import Icon from '../../Icon'
import { supabase } from '../../../supabaseClient'
import { initials } from '../../Students/utils/studentHelpers'

const formatDate = (date) => {
  if (!date) return '—'
  return new Intl.DateTimeFormat('fr-MA').format(new Date(date))
}

export default function GroupDetailsModal({ group, close }) {
  const [teacherAssignments, setTeacherAssignments] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const none = Promise.resolve({ data: [], error: null })
        const [teachersRes, studentSubjectsRes, packageTeachersRes, groupStudentsRes] = await Promise.all([
          group
            ? supabase
                .from('teacher_group_subjects')
                .select('teacher_id, subject_id, teachers(first_name, last_name), subjects(name)')
                .eq('group_id', group.id)
            : none,
          group
            ? supabase
                .from('student_group_subjects')
                .select('student_id, subject_id, students(first_name, last_name, registration_number)')
                .eq('group_id', group.id)
            : none,
          // Cycles au forfait : professeurs et élèves sont rattachés au groupe
          // entier, sans matière.
          group
            ? supabase
                .from('teacher_groups')
                .select('teacher_id, teachers(first_name, last_name)')
                .eq('group_id', group.id)
            : none,
          group
            ? supabase
                .from('group_students')
                .select('student_id, students(first_name, last_name, registration_number)')
                .eq('group_id', group.id)
            : none,
        ])

        if (cancelled) return

        const teacherMap = new Map()
        for (const row of teachersRes.data || []) {
          const teacherId = row.teacher_id
          if (!teacherId) continue
          const teacherName = row.teachers ? `${row.teachers.first_name} ${row.teachers.last_name}`.trim() : 'Professeur'
          if (!teacherMap.has(teacherId)) {
            teacherMap.set(teacherId, {
              id: teacherId,
              name: teacherName,
              subjects: [],
            })
          }

          const teacher = teacherMap.get(teacherId)
          const subjectId = row.subject_id
          const subjectName = row.subjects?.name || '—'
          const existingSubject = teacher.subjects.find((subject) => subject.id === subjectId)
          if (!existingSubject) {
            teacher.subjects.push({
              id: subjectId,
              name: subjectName,
              students: [],
            })
          }
        }

        const studentRows = studentSubjectsRes.data || []
        for (const row of studentRows) {
          for (const teacher of teacherMap.values()) {
            const subject = teacher.subjects.find((entry) => entry.id === row.subject_id)
            if (!subject) continue
            const student = row.students
            if (!student) continue
            const studentEntry = {
              id: row.student_id,
              first_name: student.first_name,
              last_name: student.last_name,
              registration_number: student.registration_number,
            }
            const existingStudent = subject.students.find((item) => item.id === row.student_id)
            if (!existingStudent) subject.students.push(studentEntry)
          }
        }

        // Affectations sans matière : un seul bloc « toutes les matières »,
        // dont l'effectif est celui du groupe.
        const roster = []
        for (const row of groupStudentsRes.data || []) {
          const student = row.students
          if (!student || roster.some((item) => item.id === row.student_id)) continue
          roster.push({
            id: row.student_id,
            first_name: student.first_name,
            last_name: student.last_name,
            registration_number: student.registration_number,
          })
        }
        for (const row of packageTeachersRes.data || []) {
          const teacherId = row.teacher_id
          if (!teacherId) continue
          const teacherName = row.teachers ? `${row.teachers.first_name} ${row.teachers.last_name}`.trim() : 'Professeur'
          if (!teacherMap.has(teacherId)) {
            teacherMap.set(teacherId, { id: teacherId, name: teacherName, subjects: [] })
          }
          const teacher = teacherMap.get(teacherId)
          if (!teacher.subjects.some((subject) => subject.id === 'all')) {
            teacher.subjects.push({ id: 'all', name: 'Toutes les matières', students: roster })
          }
        }

        setTeacherAssignments([...teacherMap.values()].sort((a, b) => a.name.localeCompare(b.name)))
      } catch (err) {
        if (cancelled) {
          console.error(err)
          setTeacherAssignments([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [group])

  const occupied = (group.studentIds || []).length
  const free = group.capacity != null ? Math.max(0, group.capacity - occupied) : null

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
            <strong>Professeurs ({teacherAssignments.length})</strong>
          </div>
          {loading ? (
            <p className="group-students-loading">Chargement des professeurs...</p>
          ) : teacherAssignments.length === 0 ? (
            <p className="group-students-empty">Aucun professeur assigné à ce groupe.</p>
          ) : (
            <div className="group-teacher-cards">
              {teacherAssignments.map((teacher) => (
                <article className="group-teacher-card" key={teacher.id}>
                  <header className="group-teacher-card-header">
                    <div className="group-details-teacher-name">
                      <i>{initials(teacher.name)}</i>
                    </div>
                    <div className="group-teacher-card-meta">
                      <b>{teacher.name}</b>
                    </div>
                  </header>

                  {teacher.subjects.length === 0 ? (
                    <p className="group-students-empty">Aucune matière assignée.</p>
                  ) : (
                    teacher.subjects.map((subject) => (
                      <div className="group-teacher-subject-block" key={`${teacher.id}-${subject.id}`}>
                        <div className="group-teacher-subject-title">
                          <span>{subject.id === 'all' ? subject.name : `Matière : ${subject.name}`}</span>
                        </div>
                        <div className="group-teacher-subject-header">
                          <strong>Élèves ({subject.students.length})</strong>
                        </div>
                        {subject.students.length === 0 ? (
                          <p className="group-students-empty">
                            {subject.id === 'all' ? 'Aucun élève dans ce groupe.' : 'Aucun élève associé à cette matière.'}
                          </p>
                        ) : (
                          <div className="group-details-students-list group-details-subject-students">
                            {subject.students.map((student) => (
                              <div className="group-details-student-row" key={`${teacher.id}-${subject.id}-${student.id}`}>
                                <span className="group-details-student-name">
                                  <i>{initials(`${student.first_name} ${student.last_name}`)}</i>
                                  <b>{`${student.first_name} ${student.last_name}`}</b>
                                </span>
                                <span>{student.registration_number || '—'}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      </aside>
    </div>
  )
}
