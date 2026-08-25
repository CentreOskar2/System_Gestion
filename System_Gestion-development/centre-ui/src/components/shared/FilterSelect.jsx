import { useEffect, useRef, useState } from 'react'
import Icon from '../Icon'
import './FilterSelect.css'

export default function FilterSelect({ value, options, onChange, ariaLabel }) {
  const [open, setOpen] = useState(false)
  const root = useRef(null)
  const selected = options.find((option) => option.value === value) || options[0]

  useEffect(() => {
    const close = (event) => {
      if (!root.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  return (
    <div className={`filter-menu ${open ? 'is-open' : ''}`} ref={root}>
      <button type="button" className="filter-menu-trigger" aria-label={ariaLabel} aria-expanded={open} onClick={() => setOpen((current) => !current)}>
        <span>{selected.label}</span><i aria-hidden="true"><Icon name="chevron-down" /></i>
      </button>
      {open && <div className="filter-menu-options" role="listbox" aria-label={ariaLabel}>
        {options.map((option) => <button key={option.value} type="button" role="option" aria-selected={value === option.value} className={value === option.value ? 'selected' : ''} onClick={() => { onChange(option.value); setOpen(false) }}>
          <span>{option.label}</span>{value === option.value && <b aria-hidden="true">✓</b>}
        </button>)}
      </div>}
    </div>
  )
}
