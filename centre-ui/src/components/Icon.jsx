export default function Icon({ name }) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '1.7',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  }

  switch (name) {
    case 'grid':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="4" y="4" width="6" height="6" rx="1.5" {...common} />
          <rect x="14" y="4" width="6" height="6" rx="1.5" {...common} />
          <rect x="4" y="14" width="6" height="6" rx="1.5" {...common} />
          <rect x="14" y="14" width="6" height="6" rx="1.5" {...common} />
        </svg>
      )
    case 'users':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M16 19c0-2.2-2-4-4-4s-4 1.8-4 4" {...common} />
          <circle cx="12" cy="8" r="3.2" {...common} />
          <path d="M19 19c0-1.7-1.1-3.1-2.7-3.7" {...common} />
          <path d="M17.2 6.4a2.5 2.5 0 1 1 0 5" {...common} />
        </svg>
      )
    case 'layers':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m12 4 8 4-8 4-8-4 8-4Z" {...common} />
          <path d="m4 12 8 4 8-4" {...common} />
          <path d="m4 16 8 4 8-4" {...common} />
        </svg>
      )
    case 'cap':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m3 10 9-4 9 4-9 4-9-4Z" {...common} />
          <path d="M6.5 11.7V16c0 1.2 2.5 2.3 5.5 2.3s5.5-1.1 5.5-2.3v-4.3" {...common} />
          <path d="M21 10v5" {...common} />
        </svg>
      )
    case 'calculator':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="5" y="3.8" width="14" height="16.4" rx="2.2" {...common} />
          <path d="M8 7h8" {...common} />
          <path d="M8 11h2M12 11h2M16 11h0M8 15h2M12 15h2M16 15h0" {...common} />
        </svg>
      )
    case 'settings':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 8.6A3.4 3.4 0 1 1 8.6 12 3.4 3.4 0 0 1 12 8.6Z" {...common} />
          <path d="M19.2 13.1v-2.2l-2-.7a5.8 5.8 0 0 0-.6-1.4l.9-1.9-1.6-1.6-1.9.9a5.8 5.8 0 0 0-1.4-.6L12.9 3h-2.2l-.7 2a5.8 5.8 0 0 0-1.4.6l-1.9-.9-1.6 1.6.9 1.9a5.8 5.8 0 0 0-.6 1.4l-2 .7v2.2l2 .7a5.8 5.8 0 0 0 .6 1.4l-.9 1.9 1.6 1.6 1.9-.9a5.8 5.8 0 0 0 1.4.6l.7 2h2.2l.7-2a5.8 5.8 0 0 0 1.4-.6l1.9.9 1.6-1.6-.9-1.9a5.8 5.8 0 0 0 .6-1.4l2-.7Z" {...common} />
        </svg>
      )
    case 'building':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 20V5.8A1.8 1.8 0 0 1 6.8 4h10.4A1.8 1.8 0 0 1 19 5.8V20" {...common} />
          <path d="M8 8h2M8 12h2M8 16h2M14 8h2M14 12h2M14 16h2" {...common} />
        </svg>
      )
    case 'search':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="5.8" {...common} />
          <path d="m16 16 4 4" {...common} />
        </svg>
      )
    case 'bell':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 4a4 4 0 0 0-4 4v2.4c0 1.3-.4 2.5-1.2 3.5L5 16h14l-1.8-2.1c-.8-1-.2-2.2-.2-3.5V8a4 4 0 0 0-4-4Z" {...common} />
          <path d="M10 19a2 2 0 0 0 4 0" {...common} />
        </svg>
      )
    case 'calendar':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="4.5" y="5" width="15" height="14.5" rx="2" {...common} />
          <path d="M8 3.5v3M16 3.5v3M4.5 9h15" {...common} />
        </svg>
      )
    case 'eye':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M2.8 12s3.6-6.2 9.2-6.2S21.2 12 21.2 12 17.6 18.2 12 18.2 2.8 12 2.8 12Z" {...common} />
          <circle cx="12" cy="12" r="2.8" {...common} />
        </svg>
      )
    case 'pencil':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m4 16.8-.7 3.9 3.9-.7L18.5 8.7 15.3 5.5 4 16.8Z" {...common} />
          <path d="m13.8 7 3.2 3.2" {...common} />
        </svg>
      )
    case 'power':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3v8" {...common} />
          <path d="M6.3 5.8a8 8 0 1 0 11.4 0" {...common} />
        </svg>
      )
    case 'close':
      return <span aria-hidden="true">×</span>
    default:
      return null
  }
}
