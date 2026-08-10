import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../Icon'
import { MenuSelect, Popover } from './Menu'
import { useAuth } from '../../context/AuthContext'
import { initials } from '../Students/utils/studentHelpers'

const DEFAULT_BRANCHES = [
  'Toutes les succursales',
  'Succursale Nord',
  'Succursale Sud',
  'Succursale Centre',
]

/**
 * Bandeau supérieur commun à toutes les pages.
 * Le filtre succursale est autonome par défaut ; une page peut le piloter
 * en passant `branch` + `onBranchChange` (cf. le dashboard).
 */
export default function Header({ branch, onBranchChange, branchOptions = DEFAULT_BRANCHES }) {
  const navigate = useNavigate()
  const { profile, signOut } = useAuth()
  const [search, setSearch] = useState('')
  const [ownBranch, setOwnBranch] = useState(branchOptions[0])
  const selectedBranch = branch ?? ownBranch

  const changeBranch = (next) => {
    setOwnBranch(next)
    onBranchChange?.(next)
  }

  const submitSearch = (event) => {
    event.preventDefault()
    if (search.trim()) navigate('/students', { state: { query: search.trim() } })
  }

  const fullName = `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim()
  const avatarLabel = initials(fullName) || 'DA'
  const roleLabel = profile?.role === 'super_admin' ? 'Administrateur' : 'Gestion'

  return (
    <header className="topbar">
      <form className="searchbar" role="search" onSubmit={submitSearch}>
        <span className="searchbar__icon">
          <Icon name="search" />
        </span>
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          aria-label="Rechercher un élève ou un professeur"
          placeholder="Rechercher un élève, professeur..."
        />
      </form>

      <MenuSelect
        className="branch-select"
        label="Filtrer par succursale"
        value={selectedBranch}
        options={branchOptions}
        onChange={changeBranch}
      />

      <Popover
        className="notifications"
        label="Notifications"
        trigger={
          <>
            <Icon name="bell" />
          </>
        }
      >
        {(close) => (
          <>
            <p className="menu__title">Notifications</p>
            <button type="button" onClick={() => { close(); navigate('/accounting/delinquencies') }}>
              <strong>Paiements impayés</strong>
              <span>Voir les retards &amp; impayés</span>
            </button>
            <button type="button" onClick={() => { close(); navigate('/accounting/salaries') }}>
              <strong>Salaires professeurs à valider</strong>
              <span>Ouvrir la paie du mois</span>
            </button>
            <button type="button" onClick={() => { close(); navigate('/accounting/profit') }}>
              <strong>Bénéfice net</strong>
              <span>Analyser la rentabilité</span>
            </button>
          </>
        )}
      </Popover>

      <Popover
        className="profile"
        label="Menu du compte"
        trigger={
          <>
            <div className="profile__avatar">{avatarLabel}</div>
            <div>
              <strong>{fullName || 'Directeur Oskar'}</strong>
              <span>{roleLabel}</span>
            </div>
          </>
        }
      >
        {(close) => (
          <>
            <button type="button" onClick={() => { close(); navigate('/settings') }}>
              <strong>Paramètres</strong>
            </button>
            <button
              type="button"
              onClick={() => {
                close()
                signOut()
              }}
            >
              <strong>Se déconnecter</strong>
            </button>
          </>
        )}
      </Popover>
    </header>
  )
}
