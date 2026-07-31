import Icon from '../Icon'
import { subjects, levels, teachers, branches } from './data/mockGroups'

export default function GroupsFilters({
  searchQuery,
  onSearchChange,
  filters,
  onFilterChange,
}) {
  const renderSelect = (key, list, label) => (
    <label className="group-filter">
      {label} :
      <select
        value={filters[key]}
        onChange={(e) => onFilterChange(key, e.target.value)}
      >
        <option value="">tous</option>
        {list.map((item) => (
          <option key={item}>{item}</option>
        ))}
      </select>
    </label>
  )

  return (
    <div className="groups-filters">
      <label className="group-search">
        <Icon name="search" />
        <input
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Rechercher un groupe..."
        />
      </label>
      {renderSelect('subject', subjects, 'Matière')}
      {renderSelect('level', levels, 'Niveau')}
      {renderSelect('teacher', teachers, 'Professeur')}
      {renderSelect('branch', branches, 'Succursale')}
    </div>
  )
}
