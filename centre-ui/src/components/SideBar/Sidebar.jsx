import { NavLink } from 'react-router-dom'
import Icon from '../Icon'

export default function Sidebar({ sections }) {
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
        {sections.map((section) => (
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

      <button type="button" className="logout">
        <span className="nav-link__icon">
          <Icon name="settings" />
        </span>
        Se déconnecter
      </button>
    </aside>
  )
}
