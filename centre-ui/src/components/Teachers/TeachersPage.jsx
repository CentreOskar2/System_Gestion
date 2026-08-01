import { useMemo, useState } from 'react'
import Header from '../shared/Header'
import TeacherForm from './TeacherForm'
import TeachersToolbar from './TeachersToolbar'
import TeachersFilters from './TeachersFilters'
import TeachersTable from './TeachersTable'
import TeacherProfile from './TeacherProfile'
import { initialTeachers } from './data/mockTeachers'
import './Teachers.css'

export default function TeachersPage() {
  const [teachers, setTeachers] = useState(initialTeachers)
  const [query, setQuery] = useState('')
  const [formTeacher, setFormTeacher] = useState(undefined) // undefined: list, null: new, object: edit
  const [selectedTeacher, setSelectedTeacher] = useState(null)

  const filteredTeachers = useMemo(
    () =>
      teachers.filter((teacher) =>
        `${teacher.firstName} ${teacher.lastName}`
          .toLowerCase()
          .includes(query.toLowerCase())
      ),
    [teachers, query]
  )

  const handleSave = (teacher) => {
    setTeachers((items) =>
      items.some((item) => item.id === teacher.id)
        ? items.map((item) => (item.id === teacher.id ? teacher : item))
        : [...items, teacher]
    )
    setFormTeacher(undefined)
  }

  const handleToggleStatus = (teacherId) => {
    setTeachers((items) =>
      items.map((item) =>
        item.id === teacherId ? { ...item, active: !item.active } : item
      )
    )
  }

  if (formTeacher !== undefined) {
    return (
      <TeacherForm
        teacher={formTeacher || null}
        onClose={() => setFormTeacher(undefined)}
        onSave={handleSave}
      />
    )
  }

  if (selectedTeacher) {
    return <TeacherProfile teacher={selectedTeacher} onBack={() => setSelectedTeacher(null)} />
  }

  return (
    <div className="teachers-page">
      <Header />
      <main className="teachers-content">
        <TeachersToolbar
          count={teachers.length}
          onAdd={() => setFormTeacher(null)}
        />
        <TeachersFilters query={query} onQueryChange={setQuery} />
        <TeachersTable
          teachers={filteredTeachers}
          onEdit={setFormTeacher}
          onToggleStatus={handleToggleStatus}
          onView={setSelectedTeacher}
        />
      </main>
    </div>
  )
}
