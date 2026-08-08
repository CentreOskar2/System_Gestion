import Icon from '../Icon'

// Note: The original topbar had a "students-topbar" class for potential specific overrides.
// This might need to be passed as a prop if other pages need different styles.
export default function Header() {
  return (
    <header className="topbar students-topbar">
      <label className="searchbar">
        <span className="searchbar__icon">
          <Icon name="search" />
        </span>
        <input placeholder="Rechercher un élève, professeur..." />
      </label>
      <button className="branch-select">
        Toutes les succursales <span>⌄</span>
      </button>
      <button className="notifications">
        <Icon name="bell" />
        <span className="notifications__badge">40</span>
      </button>
      <div className="profile">
        <div className="profile__avatar">DA</div>
        <div>
          <strong>Directeur Oskar</strong>
          <span>Administrateur</span>
        </div>
      </div>
    </header>
  )
}
