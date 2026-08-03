import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import Icon from '../Icon'

const accountingIcons = ['💲', '⚠️', '🗂️', '🔗', '📈']

export default function Sidebar({ sections }) {
  const location = useLocation()
  const isAccountingRoute = location.pathname.startsWith('/accounting') || location.pathname.startsWith('/comptabilite')
  const [accountingOpen, setAccountingOpen] = useState(isAccountingRoute)

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand__mark">CA</div>
        <div><strong>Centre Atlas</strong><span>Gestion interne</span></div>
      </div>

      <nav className="sidebar__nav" aria-label="Navigation principale">
        {sections.map((section) => (
          <div className="sidebar__section" key={section.title}>
            <p>{section.title}</p>
            <ul>
              {section.items.map((item) => (
                <li key={item.label} className={item.active ? 'is-active' : ''}>
                  {item.children ? (
                    <button type="button" className={`nav-link nav-link--accordion ${isAccountingRoute ? 'is-active' : ''}`} onClick={() => setAccountingOpen((open) => !open)} aria-expanded={accountingOpen}>
                      <span className="nav-link__icon"><Icon name={item.icon} /></span>
                      <span>{item.label}</span>
                      <span className={`nav-link__caret ${accountingOpen ? 'is-open' : ''}`}>⌄</span>
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
                              <span className="nav-sub-link__icon" aria-hidden="true">{child.icon || accountingIcons[index] || '•'}</span>{child.label}
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

      <button type="button" className="logout"><span className="nav-link__icon"><Icon name="settings" /></span>Se déconnecter</button>
    </aside>
  )
}
