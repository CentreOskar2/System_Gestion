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

  const shownStudents = useMemo(
    () =>
      items.filter(
        (student) =>
          (activeCycle === 'Tous' || student.cycle === activeCycle) &&
          (activeLevel === 'Tous' || student.level === activeLevel) &&
          (activeSubject === 'Tous' || student.chosen?.includes(activeSubject)) &&
          (!activeGroup || student.groupSelections?.some((group) => group.groupId === activeGroup)) &&
          `${student.name} ${student.code} ${student.phone}`
            .toLowerCase()
            .includes(query.toLowerCase())
      ),
    [items, query, activeCycle, activeLevel, activeSubject, activeGroup]
  )

  const groups = useMemo(() => {
    const uniqueGroups = new Map()
    for (const student of items) {
      for (const group of student.groupSelections || []) {
        if (group.groupId && group.groupName) uniqueGroups.set(group.groupId, group.groupName)
      }
    }
    return [...uniqueGroups]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
  }, [items])

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
