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
    const [teachersRes, subjectsRes, levelsRes, branchesRes, cyclesRes, tsRes, tbRes, tlRes, tgRes, groupsRes] = await Promise.all([
      supabase.from('teachers').select('*').order('created_at', { ascending: false }),
      supabase.from('subjects').select('id, name'),
      supabase.from('levels').select('id, name, cycle_id'),
      supabase.from('branches').select('id, name'),
      supabase.from('cycles').select('id, name'),
      supabase.from('teacher_subjects').select('teacher_id, subject_id'),
      supabase.from('teacher_branches').select('teacher_id, branch_id'),
      supabase.from('teacher_levels').select('teacher_id, level_id'),
      supabase.from('teacher_group_subjects').select('teacher_id, group_id, subject_id'),
      supabase.from('groups').select('id, name').order('name'),
    ])
    if (teachersRes.data) {
      const subjectMap = Object.fromEntries((subjectsRes.data || []).map((s) => [s.id, s.name]))
      const levelMap = Object.fromEntries((levelsRes.data || []).map((l) => [l.id, l.name]))
      const branchMap = Object.fromEntries((branchesRes.data || []).map((b) => [b.id, b.name]))
      const cycleMap = Object.fromEntries((cyclesRes.data || []).map((c) => [c.id, c.name]))
      const groupMap = Object.fromEntries((groupsRes.data || []).map((g) => [g.id, g.name]))
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
      const assignmentsByTeacher = {}
      for (const row of tgRes.data || []) {
        if (!assignmentsByTeacher[row.teacher_id]) assignmentsByTeacher[row.teacher_id] = {}
        if (!assignmentsByTeacher[row.teacher_id][row.group_id]) {
          assignmentsByTeacher[row.teacher_id][row.group_id] = { group_id: row.group_id, subject_ids: [] }
        }
        assignmentsByTeacher[row.teacher_id][row.group_id].subject_ids.push(row.subject_id)
      }
      setTeachers(
        teachersRes.data.map((t) => {
          const subjectIds = subjectsByTeacher[t.id] || []
          const branchIds = branchesByTeacher[t.id] || []
          const levelIds = levelsByTeacher[t.id] || []
          const groupAssignments = Object.values(assignmentsByTeacher[t.id] || {})
          const cycleIds = t.cycle_ids || []
          const cycleRates = t.cycle_rates || {}
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
            fixed_salary: t.fixed_salary ?? (t.remuneration_type === 'fixe' ? t.remuneration_amount : ''),
            cycle_ids: cycleIds,
            cycle_rates: cycleRates,
            rates: cycleRates,
            subject_ids: subjectIds,
            branch_ids: branchIds,
            level_ids: levelIds,
            group_assignments: groupAssignments,
            groups: groupAssignments.map((a) => a.group_id),
            assigned_groups: groupAssignments.map((a) => a.group_id),
            group_names: groupAssignments.map((a) => groupMap[a.group_id]).filter(Boolean),
            branch_id: t.branch_id,
            subjects: subjectIds.map((id) => subjectMap[id]).filter(Boolean),
            branches: branchIds.map((id) => branchMap[id]).filter(Boolean),
            levels: levelIds.map((id) => levelMap[id]).filter(Boolean),
            cycles: cycleIds.map((id) => ({ id, name: cycleMap[id] })).filter((c) => c.name),
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

  async function syncTeacherGroupSubjects(teacherId, currentAssignments, newAssignments) {
    const keys = (assignments) => {
      const set = new Set()
      for (const a of assignments) {
        for (const subjectId of a.subject_ids || []) {
          set.add(`${a.group_id}:${subjectId}`)
        }
      }
      return set
    }
    const current = keys(currentAssignments)
    const next = keys(newAssignments)

    for (const key of current) {
      if (next.has(key)) continue
      const [group_id, subject_id] = key.split(':')
      const { error } = await supabase
        .from('teacher_group_subjects')
        .delete()
        .eq('teacher_id', teacherId)
        .eq('group_id', group_id)
        .eq('subject_id', subject_id)
      if (error) throw new Error(error.message)
    }

    const toAdd = []
    for (const key of next) {
      if (current.has(key)) continue
      const [group_id, subject_id] = key.split(':')
      toAdd.push({ teacher_id: teacherId, group_id, subject_id })
    }
    if (toAdd.length > 0) {
      const { error } = await supabase.from('teacher_group_subjects').insert(toAdd)
      if (error) throw new Error(error.message)
    }
  }

  async function saveTeacher(form, editing) {
    const branchId = await fetchCurrentUserBranchId()
    const fixedSalary = form.fixed_salary === '' || form.fixed_salary == null ? null : Number(form.fixed_salary)
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
      remuneration_amount: form.remuneration_type === 'fixe' ? fixedSalary : null,
      fixed_salary: form.remuneration_type === 'fixe' ? fixedSalary : null,
      cycle_ids: form.cycles || [],
      cycle_rates: form.cycle_rates || {},
      branch_id: branchId,
    }

    const subjects = form.subjects || []
    const levels = form.levels || []

    let teacherId = form.id
    if (editing) {
      const { error } = await supabase.from('teachers').update(payload).eq('id', teacherId)
      if (error) throw new Error(error.message)

      const [subsRes, lvRes] = await Promise.all([
        supabase.from('teacher_subjects').select('subject_id').eq('teacher_id', teacherId),
        supabase.from('teacher_levels').select('level_id').eq('teacher_id', teacherId),
      ])
      await syncJunction(
        teacherId,
        'teacher_subjects',
        (subsRes.data || []).map((r) => r.subject_id),
        subjects
      )
      await syncJunction(
        teacherId,
        'teacher_levels',
        (lvRes.data || []).map((r) => r.level_id),
        levels
      )
    } else {
      const { data, error } = await supabase.from('teachers').insert(payload).select('id').single()
      if (error) throw new Error(error.message)
      teacherId = data.id
      if (subjects.length > 0) {
        await syncJunction(teacherId, 'teacher_subjects', [], subjects)
      }
      if (levels.length > 0) {
        await syncJunction(teacherId, 'teacher_levels', [], levels)
      }
    }

    const selectedGroups = []
    const groupIds = form.groups || []
    if (groupIds.length > 0) {
      const { data, error } = await supabase.from('groups').select('id, subject_id').in('id', groupIds)
      if (error) throw new Error(error.message)
      selectedGroups.push(...(data || []))
    }
    const newAssignments = selectedGroups.map((group) => {
      const subjectId = group.subject_id || subjects[0]
      return { group_id: group.id, subject_ids: subjectId ? [subjectId] : [] }
    })

    const tgRes = await supabase
      .from('teacher_group_subjects')
      .select('group_id, subject_id')
      .eq('teacher_id', teacherId)
    if (tgRes.error) throw new Error(tgRes.error.message)
    await syncTeacherGroupSubjects(
      teacherId,
      (tgRes.data || []).reduce((acc, row) => {
        let entry = acc.find((a) => a.group_id === row.group_id)
        if (!entry) {
          entry = { group_id: row.group_id, subject_ids: [] }
          acc.push(entry)
        }
        entry.subject_ids.push(row.subject_id)
        return acc
      }, []),
      newAssignments
    )

    const { data: directGroups } = await supabase.from('groups').select('id').eq('teacher_id', teacherId)
    const staleIds = (directGroups || []).map((g) => g.id).filter((id) => !groupIds.includes(id))
    if (staleIds.length > 0) {
      await supabase.from('groups').update({ teacher_id: null }).in('id', staleIds)
    }
    if (groupIds.length > 0) {
      const { error: groupLinkError } = await supabase
        .from('groups')
        .update({ teacher_id: teacherId })
        .in('id', groupIds)
      if (groupLinkError) throw new Error(groupLinkError.message)
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
