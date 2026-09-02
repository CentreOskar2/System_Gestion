import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../Icon'
import { MenuSelect, Popover } from './Menu'
import { useAuth } from '../../context/AuthContext'
import { useBranch, ALL_BRANCHES } from '../../context/BranchContext'
import { initials } from '../Students/utils/studentHelpers'
import { searchEverything } from './globalSearchApi'

/** Délai avant d'interroger la base : évite une requête à chaque frappe. */
const DEBOUNCE_MS = 250
/** En dessous de deux caractères la recherche ramènerait la moitié du centre. */
const MIN_QUERY_LENGTH = 2

const SECTIONS = [
  { key: 'students', label: 'Élèves', icon: 'users', path: '/students' },
  { key: 'teachers', label: 'Professeurs', icon: 'cap', path: '/teachers' },
  { key: 'groups', label: 'Groupes', icon: 'layers', path: '/groups' },
]

const EMPTY_RESULTS = { students: [], teachers: [], groups: [] }

/** Identifiant stable d'une ligne de résultat, tous types confondus. */
const resultKey = (item) => `${item.type}-${item.id}`

/**
 * Bandeau supérieur commun à toutes les pages.
 * Le filtre succursale est global (BranchContext) : sélection persistée en localStorage.
 * La recherche couvre élèves, professeurs et groupes ; elle est limitée aux
 * permissions de l'utilisateur et à la succursale sélectionnée.
 */
export default function Header({ notificationCount = 0 }) {
  const navigate = useNavigate()
  const { profile, signOut, can } = useAuth()
  const { selectedBranch, setSelectedBranch, branches } = useBranch()
  const [search, setSearch] = useState('')
  // Dernière réponse reçue, étiquetée du terme qui l'a produite : tout se
  // déduit de cette comparaison, il n'y a donc aucun état « en cours » à
  // remettre à zéro à chaque frappe.
  const [answer, setAnswer] = useState({ term: '', data: EMPTY_RESULTS, error: false })
  const [open, setOpen] = useState(false)
  // Ligne surlignée repérée par sa clé et non par son rang : elle cesse d'elle-même
  // d'être surlignée quand les résultats changent sous le clavier.
  const [activeKey, setActiveKey] = useState(null)
  const searchRef = useRef(null)

  const scopes = useMemo(
    () => ({ students: can('students'), teachers: can('teachers'), groups: can('groups') }),
    [can]
  )
  const canSearch = scopes.students || scopes.teachers || scopes.groups

  const branchOptions = useMemo(
    () => [
      { value: ALL_BRANCHES, label: 'Toutes les succursales' },
      ...branches.map((branch) => ({ value: branch.id, label: branch.name })),
    ],
    [branches]
  )

  const term = search.trim()
  const activeSearch = canSearch && term.length >= MIN_QUERY_LENGTH
  // Une réponse ne vaut que pour le terme qui l'a produite : tant qu'elle porte
  // sur un terme périmé, l'affichage est « en cours » et non un résultat vide.
  const fresh = activeSearch && answer.term === term
  const results = fresh ? answer.data : EMPTY_RESULTS
  const searchError = fresh && answer.error
  const searching = activeSearch && !fresh

  // Interrogation différée d'une frappe ; une réponse arrivée en retard sur une
  // frappe précédente est écartée par le drapeau `cancelled`.
  useEffect(() => {
    if (!activeSearch) return undefined
    let cancelled = false
    const timer = setTimeout(() => {
      searchEverything(term, { branchId: selectedBranch, scopes })
        .then((data) => {
          if (!cancelled) setAnswer({ term, data, error: false })
        })
        .catch((err) => {
          console.error(err)
          if (!cancelled) setAnswer({ term, data: EMPTY_RESULTS, error: true })
        })
    }, DEBOUNCE_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [term, selectedBranch, scopes, activeSearch])

  // Liste à plat des résultats : c'est elle que parcourent les flèches du clavier.
  const flatResults = useMemo(
    () => SECTIONS.flatMap((section) => results[section.key] || []),
    [results]
  )

  // Rang de la ligne surlignée, ou -1 si sa clé a disparu des résultats.
  const activeIndex = flatResults.findIndex((item) => resultKey(item) === activeKey)

  // Rang du premier élément de chaque section dans `flatResults`.
  const sectionOffsets = useMemo(() => {
    const offsets = {}
    let offset = 0
    for (const section of SECTIONS) {
      offsets[section.key] = offset
      offset += (results[section.key] || []).length
    }
    return offsets
  }, [results])

  useEffect(() => {
    if (!open) return undefined
    const onPointerDown = (event) => {
      if (!searchRef.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  const closeSearch = () => {
    setOpen(false)
    setActiveKey(null)
  }

  const goToResult = (item) => {
    closeSearch()
    setSearch('')
    if (item.type === 'student') {
      navigate('/students', { state: { query: item.name, focusStudentId: item.id } })
    } else if (item.type === 'teacher') {
      navigate('/teachers', { state: { query: item.name, focusTeacherId: item.id } })
    } else {
      navigate('/groups', { state: { query: item.name } })
    }
  }

  /** Entrée : la ligne surlignée, sinon la liste filtrée la plus pertinente. */
  const submitSearch = (event) => {
    event.preventDefault()
    if (!term || !canSearch) return
    if (activeIndex >= 0 && flatResults[activeIndex]) {
      goToResult(flatResults[activeIndex])
      return
    }
    if (flatResults.length === 1) {
      goToResult(flatResults[0])
      return
    }
    const firstFilled = SECTIONS.find((section) => (results[section.key] || []).length > 0)
    const fallback = SECTIONS.find((section) => scopes[section.key])
    const target = firstFilled || fallback
    if (!target) return
    closeSearch()
    navigate(target.path, { state: { query: term } })
  }

  const onSearchKeyDown = (event) => {
    if (event.key === 'Escape') {
      closeSearch()
      return
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    if (!flatResults.length) return
    event.preventDefault()
    setOpen(true)
    const step = event.key === 'ArrowDown' ? 1 : -1
    const next = (activeIndex + step + flatResults.length + 1) % (flatResults.length + 1)
    // La position « flatResults.length » sert de retour à l'absence de sélection.
    setActiveKey(next === flatResults.length ? null : resultKey(flatResults[next]))
  }

  const showPanel = open && canSearch && term.length >= MIN_QUERY_LENGTH
  const noResults = !searching && !searchError && flatResults.length === 0

  const fullName = `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim()
  const avatarLabel = initials(fullName) || 'DA'
  const roleLabel = profile?.role === 'super_admin' ? 'Administrateur' : 'Gestion'

  return (
    <header className="topbar">
      <form className="searchbar" role="search" onSubmit={submitSearch} ref={searchRef}>
        <span className="searchbar__icon">
          <Icon name="search" />
        </span>
        <input
          type="search"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onSearchKeyDown}
          role="combobox"
          aria-expanded={showPanel}
          aria-controls="global-search-results"
          aria-autocomplete="list"
          aria-activedescendant={activeIndex >= 0 ? `global-search-option-${activeIndex}` : undefined}
          aria-label="Rechercher un élève, un professeur ou un groupe"
          placeholder="Rechercher un élève, professeur..."
          autoComplete="off"
        />
        {search && (
          <button
            type="button"
            className="searchbar__clear"
            aria-label="Effacer la recherche"
            onClick={() => {
              setSearch('')
              closeSearch()
            }}
          >
            <Icon name="close" />
          </button>
        )}

        {showPanel && (
          <div
            className="search-results"
            id="global-search-results"
            role="listbox"
            aria-label="Résultats de recherche"
          >
            {searching && <p className="search-results__status">Recherche en cours...</p>}
            {searchError && <p className="search-results__status">Recherche indisponible pour le moment.</p>}
            {noResults && <p className="search-results__status">Aucun résultat pour "{term}".</p>}

            {SECTIONS.map((section) => {
              const items = results[section.key] || []
              if (!items.length) return null
              return (
                <div key={section.key} className="search-results__group">
                  <p className="menu__title">{section.label}</p>
                  {items.map((item, position) => {
                    // Rang dans `flatResults`, seul repère commun avec le clavier.
                    const index = sectionOffsets[section.key] + position
                    const key = resultKey(item)
                    return (
                      <button
                        key={key}
                        type="button"
                        id={`global-search-option-${index}`}
                        role="option"
                        aria-selected={index === activeIndex}
                        className={`search-result${index === activeIndex ? ' is-active' : ''}`}
                        onMouseEnter={() => setActiveKey(key)}
                        onClick={() => goToResult(item)}
                      >
                        <span className="search-result__avatar" aria-hidden="true">
                          {item.photoUrl ? <img src={item.photoUrl} alt="" /> : <Icon name={section.icon} />}
                        </span>
                        <span className="search-result__text">
                          <strong>{item.name}</strong>
                          <span>{item.subtitle}</span>
                        </span>
                        {item.inactive && <span className="search-result__tag">Inactif</span>}
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </div>
        )}
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
