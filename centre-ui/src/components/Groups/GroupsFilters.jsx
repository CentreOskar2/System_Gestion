import Icon from '../Icon'
import FilterSelect from '../shared/FilterSelect'

export default function GroupsFilters({
  searchQuery,
  onSearchChange,
  filters,
  onFilterChange,
  options,
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
      {renderSelect('subject', options.subjects, 'Matière')}
      {renderSelect('level', options.levels, 'Niveau')}
      {renderSelect('teacher', options.teachers, 'Professeur')}
      {renderSelect('branch', options.branches, 'Succursale')}
    </div>
  )
}
