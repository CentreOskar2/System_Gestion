import { useEffect, useMemo, useState } from 'react'
import Icon from '../../Icon'
import { supabase } from '../../../supabaseClient'
import { safeFilename } from '../../../utils/exportToPdf'
import { downloadPdfDocument } from '../../pdf/downloadPdf'
import AbsenceSheetPdf from '../../pdf/AbsenceSheetPdf'
import './AttendanceSheet.css'
import './AttendancePdf.css'

const ACADEMIC_YEAR = '2026 – 2027'
const sessions = Array.from({ length: 18 }, (_, index) => `S${index + 1}`)

function AbsenceSheet({ meta, students, close }) {
  const [isExporting, setIsExporting] = useState(false)
  const downloadPdf = async () => {
    setIsExporting(true)
    try {
      await downloadPdfDocument(
        <AbsenceSheetPdf meta={meta} students={students} />,
        `fiche-absence-${safeFilename(meta.teacher)}-${safeFilename(meta.subject)}-${safeFilename(meta.group)}.pdf`
      )
    } finally {
      setIsExporting(false)
    }
  }
  return (
    <main className="absence-sheet-page">
      <div className="absence-sheet-actions">
        <button onClick={close}>← Retour aux étudiants</button>
        <button className="absence-print" disabled={isExporting} onClick={downloadPdf}>
          {isExporting ? 'Génération du PDF…' : '▣  Télécharger le PDF'}
        </button>
      </div>
      <article className="absence-sheet">
        <header className="absence-sheet-header">
          <div className="absence-brand">
            <img src="/oskar-logo.png" alt="Centre Oskar" />
            <div>
              <strong>Centre Oskar</strong>
              <span>Fiche de présence —</span>
            </div>
          </div>
          <div>
            <strong>Fiche d'absence</strong>
            <span>Année scolaire {ACADEMIC_YEAR}</span>
          </div>
        </header>
        <section className="absence-details">
          <div><small>PROFESSEUR</small><b>{meta.teacher || '—'}</b></div>
          <div><small>MATIÈRE</small><b>{meta.subject || '—'}</b></div>
          <div><small>NIVEAU</small><b>{meta.level || '—'}</b></div>
          <div><small>GROUPE</small><b>{meta.group || '—'}</b></div>
        </section>
        <table className="absence-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Élève</th>
              <th>Matricule</th>
              <th>Note°1</th>
              <th>Note°2</th>
              {sessions.map((session) => <th key={session}>{session}</th>)}
            </tr>
          </thead>
          <tbody>
            {students.length === 0 ? (
              <tr><td colSpan={5 + sessions.length} style={{ height: 60, color: '#53647e' }}>Aucun élève inscrit dans ce groupe.</td></tr>
            ) : (
              students.map((student, index) => (
                <tr key={student.id}>
                  <td>{index + 1}</td>
                  <td>{student.name}</td>
                  <td>{student.registration_number || ''}</td>
                  <td />
                  <td />
                  {sessions.map((session) => <td key={session} />)}
                </tr>
              ))
            )}
          </tbody>
        </table>
        <p className="absence-help">Cocher <b>P</b> pour présent, <b>A</b> pour absent, <b>R</b> pour retard.</p>
        <footer className="absence-signatures"><span>Signature du professeur</span><span>Signature de l'administration</span></footer>
      </article>
    </main>
  )
}

export default function AbsenceSheetModal({ close }) {
  const [teachers, setTeachers] = useState([])
  const [subjects, setSubjects] = useState([])
  const [levels, setLevels] = useState([])
  const [groups, setGroups] = useState([])
  const [teacherAssignments, setTeacherAssignments] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [teacherId, setTeacherId] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [levelId, setLevelId] = useState('')
  const [groupId, setGroupId] = useState('')
  const [generating, setGenerating] = useState(false)
  const [sheet, setSheet] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function fetchCatalog() {
      setLoading(true)
      try {
        const [teachersRes, subjectsRes, levelsRes, groupsRes, gsRes, tgsRes, sgsRes] = await Promise.all([
          supabase.from('teachers').select('id, first_name, last_name').eq('status', 'active').order('last_name'),
          supabase.from('subjects').select('id, name').order('name'),
          supabase.from('levels').select('id, name').order('name'),
          supabase.from('groups').select('id, name, subject_id, level_id, teacher_id').eq('status', 'active').order('name'),
          supabase.from('group_students').select('group_id, student_id'),
          supabase.from('teacher_group_subjects').select('teacher_id, group_id, subject_id'),
          supabase.from('student_group_subjects').select('group_id, subject_id'),
        ])
        if (teachersRes.error) throw new Error(teachersRes.error.message)
        if (subjectsRes.error) throw new Error(subjectsRes.error.message)
        if (levelsRes.error) throw new Error(levelsRes.error.message)
        if (groupsRes.error) throw new Error(groupsRes.error.message)
        if (gsRes.error) throw new Error(gsRes.error.message)
        if (tgsRes.error) throw new Error(tgsRes.error.message)
        if (sgsRes.error) throw new Error(sgsRes.error.message)

        const groupSubjectIds = {}
        const groupTeacherIds = {}
        for (const row of [...(tgsRes.data || []), ...(sgsRes.data || [])]) {
          if (row.group_id && row.subject_id) {
            if (!groupSubjectIds[row.group_id]) groupSubjectIds[row.group_id] = new Set()
            groupSubjectIds[row.group_id].add(row.subject_id)
          }
        }
        for (const row of tgsRes.data || []) {
          if (row.group_id && row.teacher_id) {
            if (!groupTeacherIds[row.group_id]) groupTeacherIds[row.group_id] = new Set()
            groupTeacherIds[row.group_id].add(row.teacher_id)
          }
        }

        setTeachers((teachersRes.data || []).map((t) => ({ id: t.id, name: `${t.first_name} ${t.last_name}`.trim() || 'Professeur' })))
        setSubjects((subjectsRes.data || []).map((s) => ({ id: s.id, name: s.name })))
        setLevels((levelsRes.data || []).map((l) => ({ id: l.id, name: l.name })))
        setTeacherAssignments(tgsRes.data || [])
        setGroups((groupsRes.data || []).map((g) => {
          const subjectIds = new Set(groupSubjectIds[g.id] || [])
          if (g.subject_id) subjectIds.add(g.subject_id)
          const teacherIds = new Set(groupTeacherIds[g.id] || [])
          if (g.teacher_id) teacherIds.add(g.teacher_id)
          return { id: g.id, name: g.name, levelId: g.level_id || '', subjectIds: [...subjectIds], teacherIds: [...teacherIds] }
        }))
      } catch (err) {
        console.error(err)
        setLoadError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchCatalog()
    return () => { cancelled = true }
  }, [])

  const matchingGroups = useMemo(
    () =>
      groups.filter(
        (group) =>
          (!teacherId || group.teacherIds.includes(teacherId)) &&
          (!subjectId || group.subjectIds.includes(subjectId)) &&
          (!levelId || group.levelId === levelId) &&
          (!groupId || group.id === groupId)
      ),
    [groups, teacherId, subjectId, levelId, groupId]
  )
  const teacherOptions = useMemo(
    () => teachers.filter((teacher) => matchingGroups.some((group) => group.teacherIds.includes(teacher.id))),
    [teachers, matchingGroups]
  )
  const subjectOptions = useMemo(
    () => subjects.filter((subject) => matchingGroups.some((group) => group.subjectIds.includes(subject.id))),
    [subjects, matchingGroups]
  )
  const levelOptions = useMemo(
    () => levels.filter((level) => matchingGroups.some((group) => group.levelId === level.id)),
    [levels, matchingGroups]
  )
  const groupOptions = useMemo(
    () => matchingGroups,
    [matchingGroups]
  )

  const changeTeacher = (value) => {
    setTeacherId(value)
  }
  const changeSubject = (value) => {
    setSubjectId(value)
  }
  const changeLevel = (value) => {
    setLevelId(value)
  }
  const changeGroup = (value) => {
    setGroupId(value)
  }

  const handleGenerate = async () => {
    if (!groupId || generating) return
    setGenerating(true)
    setLoadError('')
    try {
      const group = groups.find((g) => g.id === groupId)
      if (!teacherId || !subjectId || !levelId) {
        throw new Error('Choisissez le professeur, la matière et le niveau avant de générer la fiche.')
      }

      const matchingAssignment = teacherAssignments.find(
        (row) =>
          String(row.group_id) === String(groupId) &&
          String(row.teacher_id) === String(teacherId) &&
          String(row.subject_id) === String(subjectId)
      )

      if (!matchingAssignment) {
        throw new Error('La combinaison professeur / matière / groupe sélectionnée ne correspond à aucune inscription enregistrée.')
      }

      const { data: rows, error } = await supabase
        .from('student_group_subjects')
        .select('student_id, subject_id, students(first_name, last_name, registration_number)')
        .eq('group_id', groupId)
        .eq('subject_id', subjectId)

      if (error) throw new Error(error.message)

      const seen = new Set()
      const roster = []
      for (const row of rows || []) {
        if (!row.students || seen.has(row.student_id)) continue
        seen.add(row.student_id)
        const s = row.students
        roster.push({
          id: row.student_id,
          name: `${s.first_name} ${s.last_name}`.trim(),
          registration_number: s.registration_number || '',
        })
      }
      roster.sort((a, b) => a.name.localeCompare(b.name))

      setSheet({
        meta: {
          teacher: teachers.find((t) => t.id === teacherId)?.name || '—',
          subject: subjects.find((s) => s.id === subjectId)?.name || '—',
          level: levels.find((l) => l.id === levelId)?.name || '—',
          group: group?.name || '—',
        },
        students: roster,
      })
    } catch (err) {
      console.error(err)
      setLoadError(err.message)
    } finally {
      setGenerating(false)
    }
  }

  if (sheet) return <AbsenceSheet meta={sheet.meta} students={sheet.students} close={close} />

  const ready = Boolean(groupId && teacherId && subjectId && levelId)

  return (
    <div className="student-overlay" onMouseDown={close}>
      <section className="absence-modal" onMouseDown={(event) => event.stopPropagation()}>
        <button className="student-close" onClick={close}><Icon name="close" /></button>
        <h2>Fiche d'absence vierge</h2>
        <p>Sélectionnez les paramètres pour générer la fiche imprimable.</p>
        {loading ? (
          <p className="absence-loading" style={{ marginTop: 20, color: '#647088' }}>Chargement des données…</p>
        ) : loadError ? (
          <p className="absence-error" style={{ marginTop: 20, color: '#c0392b' }}>{loadError}</p>
        ) : (
          <>
            <label>Professeur
              <select value={teacherId} onChange={(event) => changeTeacher(event.target.value)}>
                <option value="">— Tous —</option>
                {teacherOptions.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </label>
            <label>Matière
              <select value={subjectId} onChange={(event) => changeSubject(event.target.value)} disabled={subjectOptions.length === 0}>
                <option value="">—</option>
                {subjectOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            <label>Niveau
              <select value={levelId} onChange={(event) => changeLevel(event.target.value)} disabled={levelOptions.length === 0}>
                <option value="">—</option>
                {levelOptions.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </label>
            <label>Groupe
              <select value={groupId} onChange={(event) => changeGroup(event.target.value)} disabled={groupOptions.length === 0}>
                <option value="">—</option>
                {groupOptions.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </label>
            <footer>
              <button onClick={close}>Annuler</button>
              <button disabled={!ready || generating} onClick={handleGenerate}>
                {generating ? 'Génération…' : '▣  Générer la fiche'}
              </button>
            </footer>
          </>
        )}
      </section>
    </div>
  )
}
