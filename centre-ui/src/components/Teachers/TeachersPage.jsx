import { useEffect, useMemo, useState } from 'react'
import Header from '../shared/Header'
import TeacherForm from './TeacherForm'
import TeachersToolbar from './TeachersToolbar'
import TeachersFilters from './TeachersFilters'
import TeachersTable from './TeachersTable'
import TeacherProfile from './TeacherProfile'
import { supabase } from '../../supabaseClient'
import { uploadImage } from '../../utils/storage'
import { fetchCurrentUserBranchId } from '../../utils/currentUserBranch'
import './Teachers.css'

function Toast({ notice }) {
  if (!notice) return null
  return (
    <div className={`teacher-toast is-${notice.type}`} role="status">
      <span>{notice.type === 'success' ? '✓' : '✕'}</span>
      {notice.text}
    </div>
  )
}

export default function TeachersPage() {
  const [teachers, setTeachers] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [formTeacher, setFormTeacher] = useState(undefined) // undefined: list, null: new, object: edit
  const [selectedTeacher, setSelectedTeacher] = useState(null)
  const [notice, setNotice] = useState(null)

  useEffect(() => { fetchTeachers() }, [])

  async function fetchTeachers() {
    setLoading(true)
    const [teachersRes, subjectsRes, levelsRes, branchesRes, tsRes, tbRes, tlRes] = await Promise.all([
      supabase.from('teachers').select('*').order('created_at', { ascending: false }),
      supabase.from('subjects').select('id, name'),
      supabase.from('levels').select('id, name'),
      supabase.from('branches').select('id, name'),
      supabase.from('teacher_subjects').select('teacher_id, subject_id'),
      supabase.from('teacher_branches').select('teacher_id, branch_id'),
      supabase.from('teacher_levels').select('teacher_id, level_id'),
    ])
    if (teachersRes.data) {
      const subjectMap = Object.fromEntries((subjectsRes.data || []).map((s) => [s.id, s.name]))
      const levelMap = Object.fromEntries((levelsRes.data || []).map((l) => [l.id, l.name]))
      const branchMap = Object.fromEntries((branchesRes.data || []).map((b) => [b.id, b.name]))
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
      setTeachers(
        teachersRes.data.map((t) => {
          const subjectIds = subjectsByTeacher[t.id] || []
          const branchIds = branchesByTeacher[t.id] || []
          const levelIds = levelsByTeacher[t.id] || []
          return {
            id: t.id,
            firstName: t.first_name,
            lastName: t.last_name,
            cin: t.cin || '',
            phone: t.phone || '',
            address: t.address || '',
            hiredAt: t.hire_date || '',
            photoUrl: t.photo_url || '',
            status: t.status,
            active: t.status === 'active',
            paymentType: t.remuneration_type,
            salary: t.remuneration_type === 'fixe' ? String(t.remuneration_amount ?? '') : '',
            remuneration_amount: t.remuneration_amount,
            rates: {},
            subject_ids: subjectIds,
            branch_ids: branchIds,
            level_ids: levelIds,
            branch_id: t.branch_id,
            subjects: subjectIds.map((id) => subjectMap[id]).filter(Boolean),
            branches: branchIds.map((id) => branchMap[id]).filter(Boolean),
            levels: levelIds.map((id) => levelMap[id]).filter(Boolean),
          }
        })
      )
    }
    setLoading(false)
  }

  const filteredTeachers = useMemo(
    () =>
      teachers.filter((teacher) =>
        `${teacher.firstName} ${teacher.lastName}`
          .toLowerCase()
          .includes(query.toLowerCase())
      ),
    [teachers, query]
  )

  const junctionColumn = {
    teacher_subjects: 'subject_id',
    teacher_branches: 'branch_id',
    teacher_levels: 'level_id',
  }

  async function syncJunction(teacherId, table, currentIds, newIds) {
    const column = junctionColumn[table]
    const toRemove = currentIds.filter((id) => !newIds.includes(id))
    const toAdd = newIds.filter((id) => !currentIds.includes(id))
    if (toRemove.length > 0) {
      const { error } = await supabase.from(table).delete().eq('teacher_id', teacherId).in(column, toRemove)
      if (error) throw new Error(error.message)
    }
    if (toAdd.length > 0) {
      const { error } = await supabase.from(table).insert(
        toAdd.map((id) => ({ teacher_id: teacherId, [column]: id }))
      )
      if (error) throw new Error(error.message)
    }
  }

  async function saveTeacher(form, editing) {
    const branchId = form.branch_ids[0] || (await fetchCurrentUserBranchId())
    const payload = {
      first_name: form.first_name,
      last_name: form.last_name,
      cin: form.cin,
      phone: form.phone,
      address: form.address,
      hire_date: form.hire_date,
      photo_url: form.photo_url,
      status: form.active ? 'active' : 'inactive',
      remuneration_type: form.remuneration_type,
      remuneration_amount: form.remuneration_amount === '' || form.remuneration_amount == null
        ? null
        : Number(form.remuneration_amount),
      branch_id: branchId,
    }

    let teacherId = form.id
    if (editing) {
      const { error } = await supabase.from('teachers').update(payload).eq('id', teacherId)
      if (error) throw new Error(error.message)

      const [subsRes, brsRes, lvRes] = await Promise.all([
        supabase.from('teacher_subjects').select('subject_id').eq('teacher_id', teacherId),
        supabase.from('teacher_branches').select('branch_id').eq('teacher_id', teacherId),
        supabase.from('teacher_levels').select('level_id').eq('teacher_id', teacherId),
      ])
      await syncJunction(
        teacherId,
        'teacher_subjects',
        (subsRes.data || []).map((r) => r.subject_id),
        form.subject_ids
      )
      await syncJunction(
        teacherId,
        'teacher_branches',
        (brsRes.data || []).map((r) => r.branch_id),
        form.branch_ids
      )
      await syncJunction(
        teacherId,
        'teacher_levels',
        (lvRes.data || []).map((r) => r.level_id),
        form.level_ids
      )
    } else {
      const { data, error } = await supabase.from('teachers').insert(payload).select('id').single()
      if (error) throw new Error(error.message)
      teacherId = data.id
      if (form.subject_ids.length > 0) {
        await syncJunction(teacherId, 'teacher_subjects', [], form.subject_ids)
      }
      if (form.branch_ids.length > 0) {
        await syncJunction(teacherId, 'teacher_branches', [], form.branch_ids)
      }
      if (form.level_ids.length > 0) {
        await syncJunction(teacherId, 'teacher_levels', [], form.level_ids)
      }
    }

    if (form.photoFile) {
      const photoUrl = await uploadImage({ entity: 'teachers', id: teacherId, file: form.photoFile })
      if (photoUrl) {
        const { error: photoError } = await supabase.from('teachers').update({ photo_url: photoUrl }).eq('id', teacherId)
        if (photoError) throw new Error(photoError.message)
      }
    }

    await fetchTeachers()
    setFormTeacher(undefined)
    setNotice({
      type: 'success',
      text: editing ? 'Professeur modifié avec succès' : 'Professeur ajouté avec succès',
    })
  }

  const handleToggleStatus = async (teacherId) => {
    const teacher = teachers.find((item) => item.id === teacherId)
    if (!teacher) return
    const newStatus = teacher.active ? 'inactive' : 'active'
    const { error } = await supabase.from('teachers').update({ status: newStatus }).eq('id', teacherId)
    if (!error) {
      setTeachers((items) =>
        items.map((item) =>
          item.id === teacherId ? { ...item, active: newStatus === 'active', status: newStatus } : item
        )
      )
    }
  }

  if (formTeacher !== undefined) {
    return (
      <TeacherForm
        teacher={formTeacher || null}
        onClose={() => setFormTeacher(undefined)}
        onSave={saveTeacher}
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
        {loading ? (
          <div className="teachers-loading">Chargement des professeurs...</div>
        ) : (
          <TeachersTable
            teachers={filteredTeachers}
            onEdit={setFormTeacher}
            onToggleStatus={handleToggleStatus}
            onView={setSelectedTeacher}
          />
        )}
      </main>
      <Toast notice={notice} />
    </div>
  )
}
