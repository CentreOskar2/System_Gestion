import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../Icon'
import { MenuSelect, Popover } from './Menu'
import { useAuth } from '../../context/AuthContext'
import { useBranch, ALL_BRANCHES } from '../../context/BranchContext'
import { initials } from '../Students/utils/studentHelpers'

/**
 * Bandeau supérieur commun à toutes les pages.
 * Le filtre succursale est global (BranchContext) : sélection persistée en localStorage.
 */
export default function Header({ notificationCount = 0 }) {
  const navigate = useNavigate()
  const { profile, signOut } = useAuth()
  const { selectedBranch, setSelectedBranch, branches } = useBranch()
  const [search, setSearch] = useState('')

  const branchOptions = useMemo(
    () => [
      { value: ALL_BRANCHES, label: 'Toutes les succursales' },
      ...branches.map((branch) => ({ value: branch.id, label: branch.name })),
    ],
    [branches]
  )

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
        onChange={setSelectedBranch}
      />

      <Popover
        className="notifications"
        label="Notifications"
        trigger={
          <>
            <Icon name="bell" />
            {notificationCount > 0 && (
              <span className="notifications__badge" title={`${notificationCount} paiement(s) en retard`}>
                {notificationCount > 99 ? '99+' : notificationCount}
              </span>
            )}
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
