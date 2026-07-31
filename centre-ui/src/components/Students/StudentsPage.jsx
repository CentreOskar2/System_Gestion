import { useMemo, useState } from 'react'
import Header from '../shared/Header'
import StudentsToolbar from './StudentsToolbar'
import StudentsFilters from './StudentsFilters'
import StudentsTable from './StudentsTable'
import AttendanceModal from './modals/AttendanceModal'
import StudentSheetModal from './modals/StudentSheetModal'
import EnrollmentPage from './enrollment/EnrollmentPage'

import { students as initialStudents } from './data/mockStudents'
import './Students.css'

export default function StudentsPage() {
  const [items, setItems] = useState(initialStudents)
  const [query, setQuery] = useState('')
  const [activeCycle, setActiveCycle] = useState('Tous')
  const [attendanceStudent, setAttendanceStudent] = useState(null)
  const [sheetStudent, setSheetStudent] = useState(null)
  const [editingStudent, setEditingStudent] = useState(null)
  const [isEnrolling, setIsEnrolling] = useState(false)

  const shownStudents = useMemo(
    () =>
      items.filter(
        (student) =>
          (activeCycle === 'Tous' || student.cycle === activeCycle) &&
          `${student.name} ${student.code} ${student.phone}`
            .toLowerCase()
            .includes(query.toLowerCase())
      ),
    [items, query, activeCycle]
  )

  const cycleTabs = useMemo(() => {
    const all = [{ name: 'Tous', count: items.length }]
    const cycles = [...new Set(items.map(item => item.cycle))]
    const cycleCounts = cycles.map(cycle => ({
        name: cycle,
        count: items.filter(student => student.cycle === cycle).length
    }))
    return [...all, ...cycleCounts];
  }, [items])

  const handleDeactivateAll = () => {
    setItems(items.map((student) => ({ ...student, active: false })))
  }

  const handleToggleStatus = (studentId) => {
    setItems(
      items.map((student) =>
        student.id === studentId
          ? { ...student, active: !student.active }
          : student
      )
    )
  }

  const handleFinishEnrollment = (newStudentForm) => {
    const newStudent = {
      id: crypto.randomUUID(),
      name: `${newStudentForm.firstName} ${newStudentForm.lastName}`,
      code: newStudentForm.code,
      cycle: newStudentForm.cycle,
      level: newStudentForm.level,
      branch: 'Succursale Nord', // Default branch for new students
      subjects: newStudentForm.chosen.length,
      payment: 'N/A',
      active: true,
      phone: newStudentForm.phone,
      school: newStudentForm.school,
      alerts: newStudentForm.alerts,
      chosen: newStudentForm.chosen,
      subjectDetails: newStudentForm.subjectDetails,
    }
    setItems([...items, newStudent])
    setIsEnrolling(false)
  }

  const handleFinishEdit = (updatedStudentForm) => {
    setItems(
      items.map((student) =>
        student.id === editingStudent.id
          ? {
              ...student,
              name: `${updatedStudentForm.firstName} ${updatedStudentForm.lastName}`,
              code: updatedStudentForm.code,
              cycle: updatedStudentForm.cycle,
              level: updatedStudentForm.level,
              phone: updatedStudentForm.phone,
              subjects: updatedStudentForm.chosen.length,
              school: updatedStudentForm.school,
              alerts: updatedStudentForm.alerts,
              chosen: updatedStudentForm.chosen,
              subjectDetails: updatedStudentForm.subjectDetails,
            }
          : student
      )
    )
    setEditingStudent(null)
  }

  const handleOpenEdit = (student) => {
    setSheetStudent(null)
    setAttendanceStudent(null)
    setEditingStudent(student)
  }

  if (isEnrolling) {
    return (
      <EnrollmentPage
        close={() => setIsEnrolling(false)}
        finish={handleFinishEnrollment}
      />
    )
  }

  if (editingStudent) {
    return (
      <EnrollmentPage
        close={() => setEditingStudent(null)}
        finish={handleFinishEdit}
        student={editingStudent}
        mode="edit"
      />
    )
  }

  return (
    <div className="students-page">
      <Header />
      <main className="students-content">
        <StudentsToolbar
          onAddStudent={() => setIsEnrolling(true)}
          onDeactivateAll={handleDeactivateAll}
        />
        <StudentsFilters
            cycles={cycleTabs}
            activeCycle={activeCycle}
            onCycleChange={setActiveCycle}
            studentsCount={shownStudents.length}
            searchQuery={query}
            onSearchChange={setQuery}
        />
        <StudentsTable
          students={shownStudents}
          onOpenSheet={setSheetStudent}
          onEditStudent={handleOpenEdit}
          onToggleStatus={handleToggleStatus}
          onOpenAttendance={setAttendanceStudent}
        />
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
