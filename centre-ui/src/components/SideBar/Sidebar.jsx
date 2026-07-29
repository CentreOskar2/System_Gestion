import { NavLink } from 'react-router-dom'
import Icon from '../Icon'
import { useAuth } from '../../context/AuthContext'

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

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand__mark">CA</div>
        <div>
          <strong>Centre Atlas</strong>
          <span>Gestion interne</span>
        </div>
      </div>

      <nav className="sidebar__nav" aria-label="Navigation principale">
        {visibleSections.map((section) => (
          <div className="sidebar__section" key={section.title}>
            <p>{section.title}</p>
            <ul>
              {section.items.map((item) => (
                <li key={item.label} className={item.active ? 'is-active' : ''}>
                  <NavLink to={item.path || '#'} className={({ isActive }) => `nav-link ${isActive ? 'is-active' : ''}`}>
                    <span className="nav-link__icon">
                      <Icon name={item.icon} />
                    </span>
                    <span>{item.label}</span>
                    {item.children ? <span className="nav-link__caret">⌄</span> : null}
                  </NavLink>
                  {item.children ? (
                    <ul className="nav-submenu">
                      {item.children.map((child) => (
                        <li key={child.label}>
                          <NavLink to={child.path || '#'} className="nav-sub-link">
                            {child.label}
                          </NavLink>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <button type="button" className="logout" onClick={signOut}>
        <span className="nav-link__icon">
          <Icon name="settings" />
        </span>
        Se déconnecter
      </button>
    </aside>
  )
}
