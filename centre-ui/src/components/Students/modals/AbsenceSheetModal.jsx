import { useEffect, useMemo, useState } from 'react'
import Icon from '../../Icon'
import { supabase } from '../../../supabaseClient'
import { fetchAllRows } from '../../../utils/fetchAllRows'
import { safeFilename } from '../../../utils/exportToPdf'
import { downloadPdfDocument } from '../../pdf/downloadPdf'
import AbsenceSheetPdf from '../../pdf/AbsenceSheetPdf'
import './AttendanceSheet.css'
import './AttendancePdf.css'

const ACADEMIC_YEAR = '2026 – 2027'
const sessions = Array.from({ length: 18 }, (_, index) => `S${index + 1}`)

// Memes lignes vierges que sur le PDF : l'apercu doit montrer exactement ce
// qui sera imprime.
const BLANK_ROWS = 8
const blankRows = Array.from({ length: BLANK_ROWS }, (_, index) => index)

// 'AAAA-MM-JJ' -> 'JJ/MM/AAAA' ; découpage de la chaîne pour éviter tout
// décalage de fuseau horaire qu'introduirait new Date().
function formatEntryDate(value) {
  const [year, month, day] = String(value || '').slice(0, 10).split('-')
  return year && month && day ? `${day}/${month}/${year}` : ''
}

// ['a', 'b', 'c'] -> 'a, b et c'
function frenchList(items) {
  if (items.length <= 1) return items[0] || ''
  return `${items.slice(0, -1).join(', ')} et ${items[items.length - 1]}`
}

const byNaturalName = (a, b) => a.localeCompare(b, 'fr', { numeric: true })

// Nom d'une liste groupée. Des groupes qui ne diffèrent que par leur numéro
// final sont réunis : « Groupe 1 », « Groupe 2 », « Groupe 3 » -> « Groupe 1,
// 2 et 3 » ; « 1 BAC SVT 1 », « 1 BAC SVT 2 » -> « 1 BAC SVT 1 et 2 ».
// Sinon, les noms complets : « Groupe A et Groupe B ».
function groupsLabel(names) {
  const sorted = names.map((name) => String(name || '').trim()).filter(Boolean).sort(byNaturalName)
  const parts = sorted.map((name) => name.match(/^(.*?)(\d+)$/))
  const prefix = parts[0]?.[1]
  if (sorted.length > 1 && parts.every((part) => part && part[1] === prefix)) {
    return `${prefix}${frenchList(parts.map((part) => part[2]))}`
  }
  return frenchList(sorted)
}

const LIST_SINGLE = 'single'
const LIST_GROUPED = 'grouped'

function AbsenceSheet({ meta, students, onBack, close }) {
  const [isExporting, setIsExporting] = useState(false)
  const downloadPdf = async () => {
    setIsExporting(true)
    try {
      await downloadPdfDocument(
        <AbsenceSheetPdf meta={meta} students={students} />,
        `fiche-absence-${meta.grouped ? 'groupee-' : ''}${safeFilename(meta.teacher)}-${safeFilename(meta.subject)}-${safeFilename(meta.group)}.pdf`
      )
    } finally {
      setIsExporting(false)
    }
  }
  return (
    <main className="absence-sheet-page">
      <div className="absence-sheet-actions">
        <div className="absence-sheet-nav">
          <button onClick={onBack}>← Choisir une autre liste</button>
          <button onClick={close}>Retour aux étudiants</button>
        </div>
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
            <strong>{meta.grouped ? 'Fiche d\'absence groupée' : 'Fiche d\'absence'}</strong>
            <span>Année scolaire {ACADEMIC_YEAR}</span>
          </div>
        </header>
        <section className="absence-details">
          <div><small>PROFESSEUR</small><b>{meta.teacher || '—'}</b></div>
          <div><small>MATIÈRE</small><b>{meta.subject || '—'}</b></div>
          <div><small>NIVEAU</small><b>{meta.level || '—'}</b></div>
          <div><small>{meta.grouped ? 'GROUPES' : 'GROUPE'}</small><b>{meta.group || '—'}</b></div>
        </section>
        <table className="absence-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Élève</th>
              <th>Date d'entrée</th>
              <th>Note°1</th>
              <th>Note°2</th>
              {/* En-têtes de séances laissés vides : le professeur y inscrit la date à la main. */}
              {sessions.map((session) => <th key={session} />)}
            </tr>
          </thead>
          <tbody>
            {students.map((student, index) => (
              <tr key={student.id}>
                <td>{index + 1}</td>
                <td>{student.name}</td>
                <td>{student.entry_date || ''}</td>
                <td />
                <td />
                {sessions.map((session) => <td key={session} />)}
              </tr>
            ))}
            {blankRows.map((offset) => (
              <tr key={`blank-${offset}`}>
                <td>{students.length + offset + 1}</td>
                <td />
                <td />
                <td />
                <td />
                {sessions.map((session) => <td key={session} />)}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="absence-help">Cocher <b>P</b> pour présent, <b>A</b> pour absent, <b>R</b> pour retard.</p>
        <footer className="absence-signatures"><span>Signature du professeur</span><span>Signature de l'administration</span></footer>
      </article>
    </main>
  )
}

// view : 'form' (choix des paramètres) ou 'list' (fiche générée), lu dans
// l'adresse par StudentsPage. Les choix restent en mémoire entre les deux : en
// revenant de la liste, le professeur, le niveau, la matière et le groupe sont
// toujours sélectionnés.
export default function AbsenceSheetModal({ view = 'form', onShowList, onBackToForm, close }) {
  const [teachers, setTeachers] = useState([])
  const [subjects, setSubjects] = useState([])
  const [levels, setLevels] = useState([])
  const [groups, setGroups] = useState([])
  const [teacherAssignments, setTeacherAssignments] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  // Erreur de génération : affichée sous le formulaire, qui reste modifiable.
  const [generateError, setGenerateError] = useState('')
  const [teacherId, setTeacherId] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [levelId, setLevelId] = useState('')
  const [groupId, setGroupId] = useState('')
  // Liste simple : un groupe. Liste groupée : plusieurs groupes réunis dans une
  // même séance (ex. SVT de 1re Bac, quelques élèves par groupe), sur une
  // seule fiche.
  const [listMode, setListMode] = useState(LIST_SINGLE)
  const [groupIds, setGroupIds] = useState([])
  const grouped = listMode === LIST_GROUPED
  const [generating, setGenerating] = useState(false)
  const [sheet, setSheet] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function fetchCatalog() {
      setLoading(true)
      try {
        const [teachersRes, subjectsRes, levelsRes, groupsRes, gsRes, tgsRes, tgRes, sgsRes] = await Promise.all([
          supabase.from('teachers').select('id, first_name, last_name').eq('status', 'active').order('last_name'),
          supabase.from('subjects').select('id, name').order('name'),
          supabase.from('levels').select('id, name, cycles(has_fixed_price)').order('name'),
          supabase.from('groups').select('id, name, subject_id, level_id, teacher_id').eq('status', 'active').order('name'),
          // Tables lues par pages : elles dépassent la limite de 1000 lignes (voir fetchAllRows).
          fetchAllRows(() => supabase.from('group_students').select('group_id, student_id').order('student_id').order('group_id')),
          supabase.from('teacher_group_subjects').select('teacher_id, group_id, subject_id'),
          supabase.from('teacher_groups').select('teacher_id, group_id'),
          fetchAllRows(() => supabase.from('student_group_subjects').select('group_id, subject_id').order('student_id').order('group_id').order('subject_id')),
        ])
        if (teachersRes.error) throw new Error(teachersRes.error.message)
        if (subjectsRes.error) throw new Error(subjectsRes.error.message)
        if (levelsRes.error) throw new Error(levelsRes.error.message)
        if (groupsRes.error) throw new Error(groupsRes.error.message)
        if (gsRes.error) throw new Error(gsRes.error.message)
        if (tgsRes.error) throw new Error(tgsRes.error.message)
        if (tgRes.error) throw new Error(tgRes.error.message)
        if (sgsRes.error) throw new Error(sgsRes.error.message)

        const groupSubjectIds = {}
        const groupTeacherIds = {}
        for (const row of [...(tgsRes.data || []), ...(sgsRes.data || [])]) {
          if (row.group_id && row.subject_id) {
            if (!groupSubjectIds[row.group_id]) groupSubjectIds[row.group_id] = new Set()
            groupSubjectIds[row.group_id].add(row.subject_id)
          }
        }
        // Cycles au forfait : le professeur est rattaché au groupe entier,
        // sans matière — l'affectation vit dans teacher_groups.
        for (const row of [...(tgsRes.data || []), ...(tgRes.data || [])]) {
          if (row.group_id && row.teacher_id) {
            if (!groupTeacherIds[row.group_id]) groupTeacherIds[row.group_id] = new Set()
            groupTeacherIds[row.group_id].add(row.teacher_id)
          }
        }
        const packageLevelIds = new Set(
          (levelsRes.data || []).filter((l) => l.cycles?.has_fixed_price).map((l) => l.id)
        )

        setTeachers((teachersRes.data || []).map((t) => ({ id: t.id, name: `${t.first_name} ${t.last_name}`.trim() || 'Professeur' })))
        setSubjects((subjectsRes.data || []).map((s) => ({ id: s.id, name: s.name })))
        setLevels((levelsRes.data || []).map((l) => ({ id: l.id, name: l.name })))
        setTeacherAssignments(tgsRes.data || [])
        setGroups((groupsRes.data || []).map((g) => {
          const subjectIds = new Set(groupSubjectIds[g.id] || [])
          if (g.subject_id) subjectIds.add(g.subject_id)
          const teacherIds = new Set(groupTeacherIds[g.id] || [])
          if (g.teacher_id) teacherIds.add(g.teacher_id)
          return {
            id: g.id,
            name: g.name,
            levelId: g.level_id || '',
            subjectIds: [...subjectIds],
            teacherIds: [...teacherIds],
            isPackage: packageLevelIds.has(g.level_id),
          }
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

  // Groupes retenus par le professeur, la matière et le niveau : ce sont ceux
  // qu'on peut cocher dans une liste groupée.
  const candidateGroups = useMemo(
    () =>
      groups
        .filter(
          (group) =>
            (!teacherId || group.teacherIds.includes(teacherId)) &&
            (!subjectId || group.subjectIds.includes(subjectId)) &&
            (!levelId || group.levelId === levelId)
        )
        .sort((a, b) => byNaturalName(a.name, b.name)),
    [groups, teacherId, subjectId, levelId]
  )
  // Groupes cochés encore proposés : changer de professeur ou de matière
  // décoche ceux qui ne correspondent plus.
  const checkedGroupIds = useMemo(
    () => groupIds.filter((id) => candidateGroups.some((group) => group.id === id)),
    [groupIds, candidateGroups]
  )
  const checkedGroups = useMemo(
    () => candidateGroups.filter((group) => checkedGroupIds.includes(group.id)),
    [candidateGroups, checkedGroupIds]
  )
  // Ce qui restreint les autres listes : le groupe choisi, ou les groupes cochés.
  const matchingGroups = useMemo(() => {
    if (grouped) return checkedGroups.length > 0 ? checkedGroups : candidateGroups
    return candidateGroups.filter((group) => !groupId || group.id === groupId)
  }, [grouped, checkedGroups, candidateGroups, groupId])
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
  const toggleGroup = (id) => {
    setGroupIds((list) => (list.includes(id) ? list.filter((item) => item !== id) : [...checkedGroupIds, id]))
  }
  // Passer en liste groupée garde le groupe déjà choisi, coché.
  const changeListMode = (mode) => {
    if (mode === LIST_GROUPED && !grouped && groupId && groupIds.length === 0) setGroupIds([groupId])
    setListMode(mode)
    setGenerateError('')
  }

  const handleGenerate = async () => {
    if (generating) return
    if (grouped ? checkedGroups.length === 0 : !groupId) return
    setGenerating(true)
    setGenerateError('')
    try {
      const chosenGroups = grouped ? checkedGroups : groups.filter((g) => g.id === groupId)
      // Au forfait, le groupe couvre toutes les matières : il n'y en a aucune
      // à choisir, et l'effectif se lit directement sur le groupe.
      const packageOnly = chosenGroups.every((group) => group.isPackage)

      if (grouped) {
        // Le niveau n'est pas exigé : des groupes de niveaux voisins peuvent
        // être réunis, et la fiche affiche alors leurs niveaux.
        if (!teacherId || (!packageOnly && !subjectId)) {
          throw new Error(
            packageOnly
              ? 'Choisissez le professeur avant de générer la fiche.'
              : 'Choisissez le professeur et la matière avant de générer la fiche.'
          )
        }
        if (chosenGroups.length < 2) {
          throw new Error('Cochez au moins deux groupes pour une liste groupée (sinon, choisissez « Liste simple »).')
        }
      } else if (!teacherId || !levelId || (!packageOnly && !subjectId)) {
        throw new Error(
          packageOnly
            ? 'Choisissez le professeur et le niveau avant de générer la fiche.'
            : 'Choisissez le professeur, la matière et le niveau avant de générer la fiche.'
        )
      }

      const packageGroupIds = chosenGroups.filter((group) => group.isPackage).map((group) => group.id)
      const subjectGroups = chosenGroups.filter((group) => !group.isPackage)

      // Chaque groupe doit être enseigné par ce professeur dans cette matière.
      const unassigned = subjectGroups.filter(
        (group) =>
          !teacherAssignments.some(
            (row) =>
              String(row.group_id) === String(group.id) &&
              String(row.teacher_id) === String(teacherId) &&
              String(row.subject_id) === String(subjectId)
          )
      )
      if (unassigned.length > 0) {
        throw new Error(
          grouped
            ? `Ce professeur n'enseigne pas cette matière dans : ${frenchList(unassigned.map((group) => group.name))}. Décochez ${unassigned.length > 1 ? 'ces groupes' : 'ce groupe'} ou vérifiez l'affectation.`
            : 'La combinaison professeur / matière / groupe sélectionnée ne correspond à aucune inscription enregistrée.'
        )
      }

      const studentFields = 'students(first_name, last_name, registration_date, created_at, status)'
      const queries = []
      if (packageGroupIds.length > 0) {
        queries.push(
          supabase.from('group_students').select(`student_id, ${studentFields}`).in('group_id', packageGroupIds)
        )
      }
      if (subjectGroups.length > 0) {
        queries.push(
          supabase
            .from('student_group_subjects')
            .select(`student_id, subject_id, ${studentFields}`)
            .in('group_id', subjectGroups.map((group) => group.id))
            .eq('subject_id', subjectId)
        )
      }
      const results = await Promise.all(queries)
      const failed = results.find((result) => result.error)
      if (failed) throw new Error(failed.error.message)
      const rows = results.flatMap((result) => result.data || [])

      // Un élève inscrit dans deux des groupes réunis n'apparaît qu'une fois.
      const seen = new Set()
      const roster = []
      for (const row of rows) {
        if (!row.students || seen.has(row.student_id)) continue
        // Un élève désactivé reste dans le groupe (on ne le désinscrit pas),
        // mais il n'est plus facturé ni convoqué en classe : il n'a donc rien
        // à faire sur une fiche d'absence. Même règle que le journal des
        // salaires, qui l'exclut déjà pour la même raison.
        if (row.students.status !== 'active') continue
        seen.add(row.student_id)
        const s = row.students
        roster.push({
          id: row.student_id,
          name: `${s.first_name} ${s.last_name}`.trim(),
          entry_date: formatEntryDate(s.registration_date || (s.created_at || '').slice(0, 10)),
        })
      }
      roster.sort((a, b) => a.name.localeCompare(b.name))

      const levelNames = [
        ...new Set(chosenGroups.map((group) => levels.find((l) => l.id === group.levelId)?.name).filter(Boolean)),
      ].sort(byNaturalName)

      setSheet({
        meta: {
          grouped,
          teacher: teachers.find((t) => t.id === teacherId)?.name || '—',
          subject: packageOnly
            ? 'Toutes les matières'
            : subjects.find((s) => s.id === subjectId)?.name || '—',
          level: grouped
            ? frenchList(levelNames) || '—'
            : levels.find((l) => l.id === levelId)?.name || '—',
          group: grouped ? groupsLabel(chosenGroups.map((group) => group.name)) : chosenGroups[0]?.name || '—',
        },
        students: roster,
      })
      onShowList?.()
    } catch (err) {
      console.error(err)
      setGenerateError(err.message)
    } finally {
      setGenerating(false)
    }
  }

  // Une liste rouverte par l'adresse sans avoir été générée (page rechargée)
  // n'a rien à afficher : on montre le choix des paramètres.
  if (view === 'list' && sheet) {
    return <AbsenceSheet meta={sheet.meta} students={sheet.students} onBack={onBackToForm} close={close} />
  }

  const selectedGroup = groups.find((group) => group.id === groupId) || null
  // Un groupe au forfait n'a pas de matière : ne pas l'exiger pour générer.
  const packageOnly = grouped
    ? checkedGroups.length > 0 && checkedGroups.every((group) => group.isPackage)
    : Boolean(selectedGroup?.isPackage)
  const ready = grouped
    ? Boolean(teacherId && checkedGroups.length >= 2 && (packageOnly || subjectId))
    : Boolean(groupId && teacherId && levelId && (packageOnly || subjectId))
  const levelNameOf = (id) => levels.find((level) => level.id === id)?.name || ''

  return (
    <div className="student-overlay" onMouseDown={close}>
      <section className="absence-modal" onMouseDown={(event) => event.stopPropagation()}>
        <button className="student-close" onClick={close}><Icon name="close" /></button>
        <h2>Fiche d'absence vierge</h2>
        <p>
          {grouped
            ? 'Choisissez le professeur et la matière, puis cochez les groupes réunis dans la même séance : leurs élèves seront sur une seule fiche.'
            : 'Sélectionnez les paramètres pour générer la fiche imprimable.'}
        </p>
        {loading ? (
          <p className="absence-loading" style={{ marginTop: 20, color: '#647088' }}>Chargement des données…</p>
        ) : loadError ? (
          <p className="absence-error" style={{ marginTop: 20, color: '#c0392b' }}>{loadError}</p>
        ) : (
          <>
            <div className="absence-list-mode" role="radiogroup" aria-label="Type de liste">
              <button
                type="button"
                role="radio"
                aria-checked={!grouped}
                className={!grouped ? 'active' : ''}
                onClick={() => changeListMode(LIST_SINGLE)}
              >
                <b>Liste simple</b>
                <small>Un seul groupe</small>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={grouped}
                className={grouped ? 'active' : ''}
                onClick={() => changeListMode(LIST_GROUPED)}
              >
                <b>Liste groupée</b>
                <small>Plusieurs groupes sur une même fiche</small>
              </button>
            </div>
            <label>Professeur
              <select value={teacherId} onChange={(event) => changeTeacher(event.target.value)}>
                <option value="">— Tous —</option>
                {teacherOptions.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </label>
            <label>Matière
              <select
                value={subjectId}
                onChange={(event) => changeSubject(event.target.value)}
                disabled={subjectOptions.length === 0 || packageOnly}
              >
                <option value="">{packageOnly ? 'Toutes les matières' : '—'}</option>
                {subjectOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            <label>{grouped ? 'Niveau (facultatif)' : 'Niveau'}
              <select value={levelId} onChange={(event) => changeLevel(event.target.value)} disabled={levelOptions.length === 0}>
                <option value="">{grouped ? '— Tous —' : '—'}</option>
                {levelOptions.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </label>
            {grouped ? (
              <fieldset className="absence-groups">
                <legend>
                  Groupes à réunir
                  <small>{checkedGroups.length} coché{checkedGroups.length > 1 ? 's' : ''}</small>
                </legend>
                {candidateGroups.length === 0 ? (
                  <p className="absence-groups-empty">Aucun groupe ne correspond au professeur, à la matière et au niveau choisis.</p>
                ) : (
                  <div className="absence-groups-list">
                    {candidateGroups.map((group) => {
                      const checked = checkedGroupIds.includes(group.id)
                      return (
                        <label key={group.id} className={checked ? 'checked' : ''}>
                          <input type="checkbox" checked={checked} onChange={() => toggleGroup(group.id)} />
                          <span>
                            {group.name}
                            {/* Sans niveau choisi, plusieurs niveaux ont leur « Groupe 1 ». */}
                            {!levelId && levelNameOf(group.levelId) && <small>{levelNameOf(group.levelId)}</small>}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                )}
                {checkedGroups.length >= 2 && (
                  <p className="absence-groups-preview">
                    Fiche : <b>{groupsLabel(checkedGroups.map((group) => group.name))}</b>
                  </p>
                )}
              </fieldset>
            ) : (
              <label>Groupe
                <select value={groupId} onChange={(event) => changeGroup(event.target.value)} disabled={groupOptions.length === 0}>
                  <option value="">—</option>
                  {groupOptions.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </label>
            )}
            {generateError && <p className="absence-generate-error">{generateError}</p>}
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
