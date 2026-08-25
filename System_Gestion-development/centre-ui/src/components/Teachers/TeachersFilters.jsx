import Icon from '../Icon'

export default function TeachersFilters({ query, onQueryChange }) {
  return (
    <label className="teacher-search">
      <Icon name="search" />
      <input
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder="Rechercher par nom..."
      />
    </label>
  )
}
