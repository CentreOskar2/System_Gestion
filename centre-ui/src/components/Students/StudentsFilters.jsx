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
  groups,
  activeGroup,
  onGroupChange,
  // Onglet Formations : la formation et son niveau remplacent le niveau
  // scolaire et la matière. Ailleurs, une case Formation s'ajoute aux filtres,
  // avec un choix `anyFormationValue` pour « au moins une formation ».
  formationMode = false,
  anyFormationValue = '__any__',
  formations = [],
  activeFormation = '',
  onFormationChange,
  formationLevels = [],
  activeFormationLevel = '',
  onFormationLevelChange,
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
  const formationOptions = [
    ...(formationMode
      ? [{ value: '', label: 'Toutes les formations' }]
      : [
          { value: '', label: 'Avec ou sans formation' },
          { value: anyFormationValue, label: 'Toutes les formations' },
        ]),
    ...formations.map((formation) => ({ value: formation.id, label: formation.name })),
  ]
  const formationFilter = (
    <div className="filter-select">
      <Icon name="clipboard" />
      <FilterSelect
        ariaLabel="Filtrer par formation"
        value={activeFormation}
        options={formationOptions}
        onChange={onFormationChange}
      />
    </div>
  )
  const formationLevelOptions = [
    { value: '', label: 'Tous les niveaux' },
    ...formationLevels.map((level) => ({ value: level.id, label: level.name })),
  ]
  const groupOptions = [
    { value: '', label: 'Tous les groupes' },
    ...groups.map((group) => ({ value: group.id, label: group.name })),
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
            <span>{(item.label || item.name).toUpperCase()}</span>
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
        {formationMode ? (
          <>
            {formationFilter}
            <div className="filter-select">
              <Icon name="layers" />
              <FilterSelect
                ariaLabel="Filtrer par niveau de formation"
                value={activeFormationLevel}
                options={formationLevelOptions}
                onChange={onFormationLevelChange}
              />
            </div>
          </>
        ) : (
          <>
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
            {formations.length > 0 && formationFilter}
          </>
        )}
        <div className="filter-select">
          <Icon name="users" />
          <FilterSelect ariaLabel="Filtrer par groupe" value={activeGroup} options={groupOptions} onChange={onGroupChange} />
        </div>
      </div>
      <p className="students-count">{studentsCount} élèves affichés</p>
    </>
  )
}
