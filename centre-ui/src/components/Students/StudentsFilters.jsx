import Icon from '../Icon'
import FilterSelect from '../shared/FilterSelect'

export default function StudentsFilters({
  cycles,
  activeCycle,
  onCycleChange,
  levels,
  activeLevel,
  onLevelChange,
  showSubjectFilter,
  subjects,
  activeSubject,
  onSubjectChange,
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
      {levels.length > 0 && (
        <div className="student-filter-row" aria-label="Filtrer par niveau">
          <span>Niveau</span>
          <div className="student-filter-chips">
            <button className={activeLevel === 'Tous' ? 'active' : ''} onClick={() => onLevelChange('Tous')}>Tous</button>
            {levels.map((level) => <button key={level} className={activeLevel === level ? 'active' : ''} onClick={() => onLevelChange(level)}>{level}</button>)}
          </div>
        </div>
      )}
      {showSubjectFilter && (
        <div className="student-filter-row" aria-label="Filtrer par matière">
          <span>Matière</span>
          <div className="student-filter-chips">
            <button className={activeSubject === 'Tous' ? 'active' : ''} onClick={() => onSubjectChange('Tous')}>Toutes les matières</button>
            {subjects.map((subject) => <button key={subject} className={activeSubject === subject ? 'active' : ''} onClick={() => onSubjectChange(subject)}>{subject}</button>)}
          </div>
        </div>
      )}
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
        <div className="filter-select">
          <Icon name="users" />
          <FilterSelect ariaLabel="Filtrer par groupe" value="" options={[{ value: '', label: 'Tous les groupes' }]} onChange={() => {}} />
        </div>
      </div>
      <p className="students-count">{studentsCount} élèves affichés</p>
    </>
  )
}
