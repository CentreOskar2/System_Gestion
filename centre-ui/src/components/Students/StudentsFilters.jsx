import Icon from '../Icon'
import FilterSelect from '../shared/FilterSelect'

export default function StudentsFilters({
  cycles,
  activeCycle,
  onCycleChange,
  levels,
  activeLevel,
  onLevelChange,
  subjects,
  activeSubject,
  onSubjectChange,
  studentsCount,
  searchQuery,
  onSearchChange,
}) {
  const levelOptions = [
    { value: 'Tous', label: 'Tous les niveaux' },
    ...levels.map((level) => ({ value: level, label: level })),
  ]
  const subjectOptions = [
    { value: 'Tous', label: 'Toutes les matières' },
    ...subjects.map((subject) => ({ value: subject, label: subject })),
  ]

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
      <div className="students-filters" aria-label="Filtrer les élèves">
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
        <div className="filter-select">
          <Icon name="layers" />
          <FilterSelect
            ariaLabel="Filtrer par niveau"
            value={activeLevel}
            options={levelOptions}
            onChange={onLevelChange}
          />
        </div>
        <div className="filter-select">
          <Icon name="cap" />
          <FilterSelect
            ariaLabel="Filtrer par matière"
            value={activeSubject}
            options={subjectOptions}
            onChange={onSubjectChange}
          />
        </div>
        <div className="filter-select">
          <Icon name="users" />
          <FilterSelect ariaLabel="Filtrer par groupe" value="" options={[{ value: '', label: 'Tous les groupes' }]} onChange={() => {}} />
        </div>
      </div>
      <p className="students-count">{studentsCount} élèves affichés</p>
    </>
  )
}
