import { useEffect, useRef, useState } from 'react'
import Icon from '../Icon'

/** Renvoie la racine à surveiller : referme au clic extérieur et à la touche Échap. */
function useOutsideClose(open, setOpen) {
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const onPointerDown = (event) => {
      if (!ref.current?.contains(event.target)) setOpen(false)
    }
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, setOpen])

  return ref
}

/** Bouton + panneau déroulant libre. `children` reçoit une fonction de fermeture. */
export function Popover({ className, label, trigger, children }) {
  const [open, setOpen] = useState(false)
  const ref = useOutsideClose(open, setOpen)

  return (
    <div className="menu" ref={ref}>
      <button
        type="button"
        className={className}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {trigger}
      </button>
      {open && <div className="menu__panel">{children(() => setOpen(false))}</div>}
    </div>
  )
}

/** Liste de choix simple (mois, année, succursale…). */
export function MenuSelect({ className, icon, value, options, onChange, label }) {
  const [open, setOpen] = useState(false)
  const ref = useOutsideClose(open, setOpen)

  return (
    <div className="menu" ref={ref}>
      <button
        type="button"
        className={className}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((current) => !current)}
      >
        {icon && <Icon name={icon} />}
        <span>{value}</span>
        <span className={`menu__caret ${open ? 'is-open' : ''}`} aria-hidden="true">
          <Icon name="chevron-down" />
        </span>
      </button>

      {open && (
        <ul className="menu__list" role="listbox" aria-label={label}>
          {options.map((option) => (
            <li key={option}>
              <button
                type="button"
                role="option"
                aria-selected={option === value}
                className={option === value ? 'is-selected' : ''}
                onClick={() => {
                  onChange(option)
                  setOpen(false)
                }}
              >
                {option}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
