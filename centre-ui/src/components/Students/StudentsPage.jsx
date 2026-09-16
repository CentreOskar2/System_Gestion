import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Header from '../shared/Header'
import StudentsToolbar from './StudentsToolbar'
import StudentsFilters from './StudentsFilters'
import StudentsTable from './StudentsTable'
import AttendanceModal from './modals/AttendanceModal'
import AbsenceSheetModal from './modals/AbsenceSheetModal'
import StudentSheetModal from './modals/StudentSheetModal'
import EnrollmentPage from './enrollment/EnrollmentPage'
import { fetchCatalog, fetchStudents, setStudentStatus } from './enrollment/enrollmentApi'
import { useBranch } from '../../context/BranchContext'

import './Students.css'

export default function StudentsPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { selectedBranch } = useBranch()
  const [items, setItems] = useState([])
  const [catalog, setCatalog] = useState(null)
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState(location.state?.query || '')
  const [activeCycle, setActiveCycle] = useState('Tous')
  const [activeLevel, setActiveLevel] = useState('Tous')
  const [activeSubject, setActiveSubject] = useState('Tous')
  const [activeGroup, setActiveGroup] = useState('')
  const [attendanceStudent, setAttendanceStudent] = useState(null)
  const [absenceSheetOpen, setAbsenceSheetOpen] = useState(location.state?.quick === 'absence-sheet')
  const [sheetStudent, setSheetStudent] = useState(null)
  const [editingStudent, setEditingStudent] = useState(null)
  const [isEnrolling, setIsEnrolling] = useState(location.state?.quick === 'enroll' || Boolean(location.state?.enroll))
  // Élève à ouvrir dès que la liste est chargée (arrivée depuis la recherche du bandeau).
  const [pendingFocusId, setPendingFocusId] = useState(location.state?.focusStudentId || null)
  const [consumedNavKey, setConsumedNavKey] = useState(null)

  // La recherche du bandeau transmet son terme (et l'élève à ouvrir) par l'état
  // de navigation. Il est appliqué pendant le rendu — le motif React
  // d'ajustement d'état — et non dans un effet : la liste s'affiche donc
  // directement filtrée, sans passer par un rendu intermédiaire non filtré.
  // `location.key` change à chaque navigation, y compris vers le même élève.
  const navSearch = location.state?.query
  const navFocusId = location.state?.focusStudentId
  if (consumedNavKey !== location.key && (typeof navSearch === 'string' || navFocusId)) {
    setConsumedNavKey(location.key)
    if (typeof navSearch === 'string') {
      setQuery(navSearch)
      setActiveCycle('Tous')
      setActiveLevel('Tous')
      setActiveSubject('Tous')
      setActiveGroup('')
    }
    setPendingFocusId(navFocusId || null)
  }

  const refresh = async () => {
    setLoading(true)
    try {
      const [nextCatalog, students] = await Promise.all([fetchCatalog(), fetchStudents(selectedBranch)])
      setCatalog(nextCatalog)
      setItems(students)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    Promise.all([fetchCatalog(), fetchStudents(selectedBranch)])
      .then(([nextCatalog, students]) => {
        if (!active) return
        setCatalog(nextCatalog)
        setItems(students)
        setLoading(false)
      })
      .catch((err) => {
        if (active) {
          console.error(err)
          setLoading(false)
        }
      })
    return () => {
      active = false
    }
  }, [selectedBranch])

  // Élèves retenus par le cycle, le niveau et la matière — mais pas encore par
  // le groupe ni par la recherche. C'est ce périmètre qui alimente la liste des
  // groupes proposés : filtrer aussi sur le groupe la réduirait au seul groupe
  // choisi, et filtrer sur la recherche la ferait fondre à chaque frappe.
  const scopedStudents = useMemo(
    () =>
      items.filter(
        (student) =>
          (activeCycle === 'Tous' || student.cycle === activeCycle) &&
          (activeLevel === 'Tous' || student.level === activeLevel) &&
          (activeSubject === 'Tous' || student.chosen?.includes(activeSubject))
      ),
    [items, activeCycle, activeLevel, activeSubject]
  )

  const shownStudents = useMemo(
    () =>
      scopedStudents.filter(
        (student) =>
          (!activeGroup || student.groupIds?.includes(activeGroup)) &&
          `${student.name} ${student.code} ${student.phone}`
            .toLowerCase()
            .includes(query.toLowerCase())
      ),
    [scopedStudents, query, activeGroup]
  )

  // Groupes proposés au filtre : TOUS les groupes du niveau choisi, lus dans le
  // catalogue — pas seulement ceux où se trouvent les élèves déjà affichés.
  // Un groupe vide reste une information utile, et le masquer donnait
  // l'impression que des groupes manquaient.
  //
  // Le rattachement testé est celui DU GROUPE (`group.level_id`), pas celui des
  // élèves : un élève de 2 BAC inscrit dans un groupe de 3 AC ne doit pas faire
  // remonter ce groupe ici.
  const groups = useMemo(() => {
    const levelsById = Object.fromEntries((catalog?.levels || []).map((level) => [level.id, level]))
    const selectedLevelId = activeLevel !== 'Tous' ? catalog?.levelByName?.[activeLevel]?.id : null
    const selectedCycleId = activeCycle !== 'Tous' ? catalog?.cycleByName?.[activeCycle]?.id : null

    const list = (catalog?.groups || []).filter((group) => {
      // Les groupes de formation ont leur propre écran : ils n'ont pas de
      // niveau scolaire et n'ont rien à faire dans ce filtre.
      if (group.formation_level_id) return false
      if (selectedLevelId) return group.level_id === selectedLevelId
      if (selectedCycleId) return levelsById[group.level_id]?.cycle_id === selectedCycleId
      return true
    })

    // Plusieurs groupes peuvent porter le même nom — « 2 BAC PC 2 » existe en
    // actif et en désactivé, « Groupe 1 » en trois exemplaires. Sans distinction
    // le menu propose des options identiques et on ne sait pas laquelle on choisit.
    const timesUsed = new Map()
    for (const group of list) timesUsed.set(group.name, (timesUsed.get(group.name) || 0) + 1)

    return list
      .map((group) => {
        const parts = [group.name]
        if (timesUsed.get(group.name) > 1) {
          const discriminant =
            catalog?.filiereById?.[group.filiere_id]?.name || levelsById[group.level_id]?.name
          if (discriminant) parts.push(discriminant)
        }
        if (group.status && group.status !== 'active') parts.push('inactif')
        return { id: group.id, name: parts.join(' · ') }
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
  }, [catalog, activeLevel, activeCycle])

  // Changer de niveau peut faire disparaître le groupe sélectionné. Sans cela il
  // resterait actif mais introuvable dans le menu, et viderait le tableau sans
  // qu'on comprenne pourquoi. Ajustement pendant le rendu, comme ailleurs dans
  // l'application, plutôt que dans un effet.
  if (activeGroup && !groups.some((group) => group.id === activeGroup)) {
    setActiveGroup('')
  }

  const cycleTabs = useMemo(() => {
    const all = [{ name: 'Tous', count: items.length }]
    const cycles = (catalog?.cycles || []).map((cycle) => ({
      name: cycle.name,
      count: items.filter((student) => student.cycle === cycle.name).length,
    }))
    return [...all, ...cycles]
  }, [catalog, items])

  const subjects = useMemo(() => (catalog?.subjects || []).map((subject) => subject.name), [catalog])

  const levels = useMemo(() => {
    if (activeCycle === 'Tous') {
      return [...new Set((catalog?.levels || []).map((level) => level.name))].sort()
    }
    return catalog?.levelsByCycle?.[activeCycle] || []
  }, [catalog, activeCycle])

  const handleToggleStatus = async (studentId) => {
    const student = items.find((item) => item.id === studentId)
    if (!student) return
    const newStatus = student.active ? 'inactive' : 'active'
    try {
      await setStudentStatus(studentId, newStatus)
      setItems((list) =>
        list.map((item) =>
          item.id === studentId ? { ...item, active: newStatus === 'active' } : item
        )
      )
    } catch (err) {
      console.error(err)
    }
  }

  const handleCycleChange = (cycle) => {
    setActiveCycle(cycle)
    setActiveLevel('Tous')
    setActiveSubject('Tous')
    setActiveGroup('')
  }

  const handleFinishEnrollment = async () => {
    setIsEnrolling(false)
    await refresh()
  }

  const handleFinishEdit = async () => {
    setEditingStudent(null)
    await refresh()
  }

  // Fiche affichée : celle ouverte depuis le tableau, sinon celle demandée par
  // la recherche du bandeau une fois la liste chargée. La déduire évite d'avoir
  // à la « pousser » depuis un effet quand les élèves finissent d'arriver.
  const focusedStudent =
    !sheetStudent && pendingFocusId && !loading
      ? items.find((student) => student.id === pendingFocusId) || null
      : null
  const openSheetStudent = sheetStudent || focusedStudent

  const closeSheet = () => {
    setSheetStudent(null)
    setPendingFocusId(null)
  }

  const handleOpenEdit = (student) => {
    closeSheet()
    setAttendanceStudent(null)
    setEditingStudent(student)
  }

  const sanitizeRedirect = (path) => {
    if (typeof path !== 'string' || !path) return '/students'
    if (!path.startsWith('/') || path.startsWith('//')) return '/students'
    if (/^(https?:|javascript:|data:)/i.test(path)) return '/students'
    return path
  }

  useEffect(() => {
    if (location.state?.quick) navigate(sanitizeRedirect(location.pathname), { replace: true, state: null })
  }, [location, navigate])

  if (isEnrolling) {
    return (
      <EnrollmentPage
        catalog={catalog}
        close={() => setIsEnrolling(false)}
        finish={handleFinishEnrollment}
      />
    )
  }

  if (editingStudent) {
    return (
      <EnrollmentPage
        catalog={catalog}
        close={() => setEditingStudent(null)}
        finish={handleFinishEdit}
        student={editingStudent}
        mode="edit"
      />
    )
  }

  if (absenceSheetOpen) {
    return <AbsenceSheetModal close={() => setAbsenceSheetOpen(false)} />
  }

  return (
    <div className="students-page">
      <Header />
      <main className="students-content">
        <StudentsToolbar
          onAddStudent={() => setIsEnrolling(true)}
          onOpenAbsenceSheet={() => setAbsenceSheetOpen(true)}
        />
        <StudentsFilters
          cycles={cycleTabs}
          activeCycle={activeCycle}
          onCycleChange={handleCycleChange}
          levels={levels}
          activeLevel={activeLevel}
          onLevelChange={setActiveLevel}
          subjects={subjects}
          activeSubject={activeSubject}
          onSubjectChange={setActiveSubject}
          groups={groups}
          activeGroup={activeGroup}
          onGroupChange={setActiveGroup}
          studentsCount={shownStudents.length}
          searchQuery={query}
          onSearchChange={setQuery}
        />
        {loading ? (
          <div className="students-loading">Chargement des étudiants...</div>
        ) : (
          <StudentsTable
            catalog={catalog}
            students={shownStudents}
            onOpenSheet={setSheetStudent}
            onEditStudent={handleOpenEdit}
            onToggleStatus={handleToggleStatus}
            onOpenAttendance={setAttendanceStudent}
          />
        )}
      </main>
      {attendanceStudent && (
        <AttendanceModal
          student={attendanceStudent}
          close={() => setAttendanceStudent(null)}
        />
      )}
      {openSheetStudent && (
        <StudentSheetModal
          student={openSheetStudent}
          close={closeSheet}
        />
      )}
    </div>
  )
}
