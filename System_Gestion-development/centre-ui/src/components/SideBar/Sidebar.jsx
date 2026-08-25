import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import Icon from '../Icon'
import { useAuth } from '../../context/AuthContext'

const accountingIcons = ['calendar', 'advance', 'id', 'calculator', 'layers']

export default function Sidebar({ sections }) {
  const { permissions, signOut } = useAuth()

  function hasPermission(item) {
    if (!item.requiredPerm) return true
    if (Array.isArray(item.requiredPerm)) {
      return item.requiredPerm.some((p) => permissions.includes(p))
    }
    return permissions.includes(item.requiredPerm)
  }

  const visibleSections = sections
    .map((section) => ({
      ...section,
      items: section.items
        .map((item) => {
          if (!item.children) return item
          const visibleChildren = item.children.filter(hasPermission)
          return { ...item, children: visibleChildren }
        })
        .filter((item) => {
          if (item.children) return item.children.length > 0
          return hasPermission(item)
        }),
    }))
    .filter((section) => section.items.length > 0)
  const location = useLocation()
  const isAccountingRoute = location.pathname.startsWith('/accounting') || location.pathname.startsWith('/comptabilite')
  const [accountingOpen, setAccountingOpen] = useState(isAccountingRoute)

  return (
    <aside className="sidebar">
      <div className="brand">
        <img className="brand__logo" src="/oskar-logo.png" alt="Centre Oskar" />
        <div><strong>Centre Oskar</strong><span>Gestion interne</span></div>
      </div>

      <nav className="sidebar__nav" aria-label="Navigation principale">
        {visibleSections.map((section) => (
          <div className={`sidebar__section${section.separated ? ' sidebar__section--separated' : ''}`} key={section.title}>
            <p>{section.title}</p>
            <ul>
              {section.items.map((item) => (
                <li key={item.label} className={item.active ? 'is-active' : ''}>
                  {item.children ? (
                    <button type="button" className={`nav-link nav-link--accordion ${isAccountingRoute ? 'is-active' : ''}`} onClick={() => setAccountingOpen((open) => !open)} aria-expanded={accountingOpen}>
                      <span className="nav-link__icon"><Icon name={item.icon} /></span>
                      <span>{item.label}</span>
                      <span className={`nav-link__caret ${accountingOpen ? 'is-open' : ''}`}><Icon name="chevron-down" /></span>
                    </button>
                  ) : (
                    <NavLink to={item.path || '#'} className={({ isActive }) => `nav-link ${isActive ? 'is-active' : ''}`}>
                      <span className="nav-link__icon"><Icon name={item.icon} /></span><span>{item.label}</span>
                    </NavLink>
                  )}
                  {item.children && (
                    <div className={`nav-submenu-wrap ${accountingOpen ? 'is-open' : ''}`}>
                      <ul className="nav-submenu">
                        {item.children.map((child, index) => (
                          <li key={child.label}>
                            <NavLink to={child.path || '#'} className="nav-sub-link">
                              <span className="nav-sub-link__icon" aria-hidden="true"><Icon name={child.icon || accountingIcons[index]} /></span>{child.label}
                            </NavLink>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <button type="button" className="logout" onClick={signOut}>
        <span className="nav-link__icon">
          <Icon name="logout" />
        </span>
        Se déconnecter
      </button>
    </aside>
  )
}
