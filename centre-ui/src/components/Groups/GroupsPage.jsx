import { useMemo, useState } from 'react'
import Header from '../shared/Header'
import GroupsToolbar from './GroupsToolbar'
import GroupsFilters from './GroupsFilters'
import GroupsTable from './GroupsTable'
import GroupModal from './modals/GroupModal'
import { initialGroups } from './data/mockGroups'
import './Groups.css'

export default function GroupsPage() {
  const [groups, setGroups] = useState(initialGroups)
  const [selectedGroup, setSelectedGroup] = useState(undefined) // undefined: modal closed, null: new group, object: edit group
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({
    subject: '',
    level: '',
    teacher: '',
    branch: '',
  })

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

  const handleSaveGroup = (group) => {
    setGroups((items) =>
      items.some((item) => item.id === group.id)
        ? items.map((item) => (item.id === group.id ? group : item))
        : [...items, group]
    )
    setSelectedGroup(undefined)
  }

  const handleFilterChange = (key, value) => {
    setFilters({ ...filters, [key]: value })
  }

  const handleToggleStatus = (groupId) => {
    setGroups((items) =>
      items.map((item) =>
        item.id === groupId ? { ...item, active: !item.active } : item
      )
    )
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
        />
        <GroupsTable
          groups={shownGroups}
          onEdit={setSelectedGroup}
          onToggleStatus={handleToggleStatus}
        />
      </main>
      {selectedGroup !== undefined && (
        <GroupModal
          group={selectedGroup}
          close={() => setSelectedGroup(undefined)}
          save={handleSaveGroup}
        />
      )}
    </div>
  )
}
