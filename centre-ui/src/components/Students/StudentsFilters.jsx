import Icon from '../Icon'

export default function StudentsFilters({
  cycles,
  activeCycle,
  onCycleChange,
  studentsCount,
  searchQuery,
  onSearchChange,
  // groupFilter,
  // onGroupFilterChange,
  // groups
}) {
  return (
    <>
      <div className="cycle-tabs">
        {cycles.map((item) => (
          <button
            key={item.name}
            className={activeCycle === item.name ? 'active' : ''}
            onClick={() => onCycleChange(item.name)}
          >
            <span>{item.name.toUpperCase()}</span>
            <b>{item.count}</b>
          </button>
        ))}
      </div>
      <div className="students-filters">
        <label className="search-bar">
          <Icon name="search" />
          <input
            type="search"
            aria-label="Rechercher un élève"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Rechercher par nom, matricule, tél..."
          />
        </label>
        {/* This group filter was in the original plan, so I'm adding it as a placeholder */}
        <label className="filter-select">
          <Icon name="users" />
          <select aria-label="Filtrer par groupe" /* value={groupFilter} onChange={onGroupFilterChange} */>
            <option>Tous les groupes</option>
          </select>
        </label>
      </div>
      <p className="students-count">{studentsCount} élèves affichés</p>
    </>
  )
}
