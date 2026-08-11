import { useEffect, useMemo, useState } from 'react'
import Header from '../shared/Header'
import GroupsToolbar from './GroupsToolbar'
import GroupsFilters from './GroupsFilters'
import GroupsTable from './GroupsTable'
import GroupModal from './modals/GroupModal'
import GroupDetailsModal from './modals/GroupDetailsModal'
import { supabase } from '../../supabaseClient'
import { useBranch } from '../../context/BranchContext'
import { fetchCurrentUserBranchId } from '../../utils/currentUserBranch'
import './Groups.css'

function Toast({ notice }) {
  if (!notice) return null
  return (
    <div className={`group-toast is-${notice.type}`} role="status">
      <span>{notice.type === 'success' ? '✓' : '✕'}</span>
      {notice.text}
    </div>
  )
}

export default function GroupsPage() {
  const { selectedBranch } = useBranch()
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedGroup, setSelectedGroup] = useState(undefined) // undefined: modal closed, null: new group, object: edit group
  const [viewingGroup, setViewingGroup] = useState(undefined)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({ level: '', filiere: '' })
  const [options, setOptions] = useState({ levels: [], filieres: [] })
  const [notice, setNotice] = useState(null)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [groupsRes, levelsRes, filieresRes, gsRes] = await Promise.all([
      supabase.from('groups').select('*').order('created_at', { ascending: false }),
      supabase.from('levels').select('id, name').order('name'),
      supabase.from('study_branches').select('id, name, level_id').order('name'),
      supabase.from('group_students').select('group_id, student_id'),
    ])
    if (groupsRes.data) {
      const levelMap = Object.fromEntries((levelsRes.data || []).map((l) => [l.id, l.name]))
      const filiereMap = Object.fromEntries((filieresRes.data || []).map((f) => [f.id, f.name]))
      const studentsByGroup = {}
      for (const row of gsRes.data || []) {
        studentsByGroup[row.group_id] = [...(studentsByGroup[row.group_id] || []), row.student_id]
      }
      setGroups(
        groupsRes.data.map((g) => ({
          id: g.id,
          name: g.name,
          level_id: g.level_id,
          filiere_id: g.filiere_id,
          subject_id: g.subject_id,
          teacher_id: g.teacher_id,
          branch_id: g.branch_id,
          level: levelMap[g.level_id] || '',
          filiere: filiereMap[g.filiere_id] || '',
          student_ids: studentsByGroup[g.id] || [],
          studentIds: studentsByGroup[g.id] || [],
          capacity: g.capacity,
          active: g.status === 'active',
          status: g.status,
        }))
      )
    }
    setOptions({
      levels: (levelsRes.data || []).map((l) => l.name),
      filieres: (filieresRes.data || []).map((f) => f.name),
    })
    setLoading(false)
  }

  const shownGroups = useMemo(
    () =>
      groups.filter(
        (group) =>
          group.name.toLowerCase().includes(search.toLowerCase()) &&
          Object.entries(filters).every(
            ([key, value]) => !value || group[key] === value
          )
      ),
    [groups, search, filters]
  )

  async function saveGroup(form, editing) {
    const branchId =
      form.branch_id ||
      (selectedBranch && selectedBranch !== 'all' ? selectedBranch : null) ||
      (await fetchCurrentUserBranchId())
    const payload = {
      name: form.name,
      level_id: form.level_id || null,
      filiere_id: form.filiere_id || null,
      subject_id: form.subject_id || null,
      teacher_id: form.teacher_id || null,
      capacity: form.capacity != null && form.capacity !== '' ? Number(form.capacity) : null,
      branch_id: branchId,
    }
    if (editing) {
      const { error } = await supabase.from('groups').update(payload).eq('id', form.id)
      if (error) throw new Error(error.message)
    } else {
      const { error } = await supabase.from('groups').insert(payload)
      if (error) throw new Error(error.message)
    }
    await fetchAll()
    setSelectedGroup(undefined)
    setNotice({
      type: 'success',
      text: editing ? 'Groupe modifié avec succès' : 'Groupe créé avec succès',
    })
  }

  const handleFilterChange = (key, value) => {
    setFilters({ ...filters, [key]: value })
  }

  const handleToggleStatus = async (groupId) => {
    const group = groups.find((item) => item.id === groupId)
    if (!group) return
    const newStatus = group.active ? 'inactive' : 'active'
    const { error } = await supabase.from('groups').update({ status: newStatus }).eq('id', groupId)
    if (!error) {
      setGroups((items) =>
        items.map((item) =>
          item.id === groupId
            ? { ...item, active: newStatus === 'active', status: newStatus }
            : item
        )
      )
    }
  }

  return (
    <div className="groups-page">
      <Header />
      <main className="groups-content">
        <GroupsToolbar
          count={shownGroups.length}
          onAddGroup={() => setSelectedGroup(null)}
        />
        <GroupsFilters
          searchQuery={search}
          onSearchChange={setSearch}
          filters={filters}
          onFilterChange={handleFilterChange}
          options={options}
        />
        {loading ? (
          <div className="groups-loading">Chargement des groupes...</div>
        ) : (
          <GroupsTable
            groups={shownGroups}
            onView={setViewingGroup}
            onEdit={setSelectedGroup}
            onToggleStatus={handleToggleStatus}
          />
        )}
      </main>
      {viewingGroup && (
        <GroupDetailsModal
          group={viewingGroup}
          close={() => setViewingGroup(undefined)}
        />
      )}
      {selectedGroup !== undefined && (
        <GroupModal
          group={selectedGroup}
          close={() => setSelectedGroup(undefined)}
          save={saveGroup}
        />
      )}
      <Toast notice={notice} />
    </div>
  )
}
