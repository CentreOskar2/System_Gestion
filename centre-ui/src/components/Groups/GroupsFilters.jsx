import Icon from '../Icon'
import FilterSelect from '../shared/FilterSelect'
import { subjects, levels, teachers, branches } from './data/mockGroups'

export default function GroupsFilters({
  searchQuery,
  onSearchChange,
  filters,
  onFilterChange,
}) {
  const renderSelect = (key, list, label) => (
    <div className="group-filter">
      <FilterSelect
        ariaLabel={`Filtrer par ${label}`}
        value={filters[key]}
        options={[{ value: '', label: `${label} : tous` }, ...list.map((item) => ({ value: item, label: item }))]}
        onChange={(value) => onFilterChange(key, value)}
      />
    </div>
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
