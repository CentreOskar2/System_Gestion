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
  const [attendanceStudent, setAttendanceStudent] = useState(null)
  const [absenceSheetOpen, setAbsenceSheetOpen] = useState(location.state?.quick === 'absence-sheet')
  const [sheetStudent, setSheetStudent] = useState(null)
  const [editingStudent, setEditingStudent] = useState(null)
  const [isEnrolling, setIsEnrolling] = useState(location.state?.quick === 'enroll' || Boolean(location.state?.enroll))

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
          `${student.name} ${student.code} ${student.phone}`
            .toLowerCase()
            .includes(query.toLowerCase())
      ),
    [items, query, activeCycle, activeLevel, activeSubject]
  )

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
  }

  const handleFinishEnrollment = async () => {
    setIsEnrolling(false)
    await refresh()
  }

  const handleFinishEdit = async () => {
    setEditingStudent(null)
    await refresh()
  }

  const handleOpenEdit = (student) => {
    setSheetStudent(null)
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
      {sheetStudent && (
        <StudentSheetModal
          student={sheetStudent}
          close={() => setSheetStudent(null)}
        />
      )}
    </div>
  )
}
