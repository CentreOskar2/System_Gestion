export default function Icon({ name }) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '1.7',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  }

  switch (name) {
    case 'whatsapp':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="11.5" r="8" {...common} />
          <path d="M8 18.5 4.5 20l1.3-3.6" {...common} />
          <path
            d="M8.6 8.3c.2-.4.4-.4.6-.4.15 0 .3 0 .45.35.18.45.6 1.5.66 1.6.06.12.1.25.02.4-.08.15-.12.22-.24.35-.12.13-.25.24-.36.33-.12.1-.24.2-.1.45.14.25.6 1 1.3 1.6.9.78 1.6 1.02 1.85 1.15.25.12.4.1.55-.06.14-.16.6-.68.76-.9.16-.24.32-.2.53-.12.22.08 1.35.63 1.58.75.24.12.4.18.45.28.06.1.06.55-.13 1.1-.2.53-1.1 1.02-1.55 1.08-.4.06-.86.08-1.4-.1a11.6 11.6 0 0 1-1.24-.46c-2.05-.9-3.4-2.98-3.5-3.12-.1-.14-.86-1.13-.86-2.15 0-1.02.55-1.5.75-1.72Z"
            fill="currentColor"
            stroke="none"
          />
        </svg>
      )
    case 'check':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m4.5 12.5 5 5 10-11" {...common} />
        </svg>
      )
    case 'coins':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="9.5" cy="9.5" r="6" {...common} />
          <path d="M13.8 6.3a6 6 0 1 1 0 11.4" {...common} />
        </svg>
      )
    case 'robot':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 4v2.5" {...common} />
          <circle cx="12" cy="3.2" r="1" fill="currentColor" stroke="none" />
          <rect x="4.5" y="6.5" width="15" height="12" rx="3" {...common} />
          <path d="M9 12v1.5M15 12v1.5" {...common} />
          <path d="M2.5 11v4M21.5 11v4" {...common} />
        </svg>
      )
    case 'hand':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M8 12.5V5a1.5 1.5 0 0 1 3 0v6" {...common} />
          <path d="M11 10.5V4a1.5 1.5 0 0 1 3 0v6.5" {...common} />
          <path d="M14 10.5V5.5a1.5 1.5 0 0 1 3 0V13" {...common} />
          <path d="M8 12.5 6.4 11a1.5 1.5 0 0 0-2.3 1.9L7 17.5A5 5 0 0 0 11 20h1.5a5.5 5.5 0 0 0 5.5-5.5V13" {...common} />
        </svg>
      )
    case 'percent':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M18 6 6 18" {...common} />
          <circle cx="7.5" cy="7.5" r="2.5" {...common} />
          <circle cx="16.5" cy="16.5" r="2.5" {...common} />
        </svg>
      )
    case 'clock':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="8.5" {...common} />
          <path d="M12 7.5V12l3.2 2" {...common} />
        </svg>
      )
    case 'chevron-down':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m6 9 6 6 6-6" {...common} />
        </svg>
      )
    case 'printer':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7 8.5V4h10v4.5" {...common} />
          <rect x="3.5" y="8.5" width="17" height="8" rx="1.8" {...common} />
          <path d="M7 14h10v5.5H7Z" {...common} />
        </svg>
      )
    case 'download':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3.5v11" {...common} />
          <path d="m7 10 5 4.5 5-4.5" {...common} />
          <path d="M4.5 17.5v1.8a1.7 1.7 0 0 0 1.7 1.7h11.6a1.7 1.7 0 0 0 1.7-1.7v-1.8" {...common} />
        </svg>
      )
    case 'upload':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 15.5v-11" {...common} />
          <path d="m7 8.5 5-4.5 5 4.5" {...common} />
          <path d="M4.5 17.5v1.8a1.7 1.7 0 0 0 1.7 1.7h11.6a1.7 1.7 0 0 0 1.7-1.7v-1.8" {...common} />
        </svg>
      )
    case 'save':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5.8 4h10.7L19 6.5v12.7a1 1 0 0 1-1 1H5.8a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" {...common} />
          <path d="M8 4v4.8h6V4" {...common} />
          <path d="M8 14h8v5.2H8Z" {...common} />
        </svg>
      )
    case 'ban':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="8.3" {...common} />
          <path d="m6.4 6.4 11.2 11.2" {...common} />
        </svg>
      )
    case 'user-plus':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M14.5 19c0-2.2-2-4-5-4s-5 1.8-5 4" {...common} />
          <circle cx="9.5" cy="8" r="3.2" {...common} />
          <path d="M18.5 7.5v6M15.5 10.5h6" {...common} />
        </svg>
      )
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
    case 'phone':
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3.8 9 3l1.7 4.7-2.1 1.6a15 15 0 0 0 6.1 6.1l1.6-2.1L21 15l-.8 3c-.3 1.1-1.4 1.8-2.5 1.5C10.8 17.5 6.5 13.2 4.5 6.3 4.2 5.2 4.9 4.1 6 3.8Z" {...common} /></svg>
    case 'pin':
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 10.2c0 5-7 10.3-7 10.3S5 15.2 5 10.2a7 7 0 1 1 14 0Z" {...common} /><circle cx="12" cy="10.2" r="2.3" {...common} /></svg>
    case 'id':
      return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="14" rx="2" {...common} /><circle cx="9" cy="11" r="2" {...common} /><path d="M6.5 16c.5-1.5 1.3-2.3 2.5-2.3s2 .8 2.5 2.3M14 10h3.5M14 14h3.5" {...common} /></svg>
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
     case 'edit':
       return (
         <svg viewBox="0 0 24 24" aria-hidden="true">
           <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3Z" {...common} />
         </svg>
       )
     case 'delete':
       return (
         <svg viewBox="0 0 24 24" aria-hidden="true">
           <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" {...common} />
         </svg>
       )
     case 'power':
       return (
         <svg viewBox="0 0 24 24" aria-hidden="true">
           <path d="M12 3v8" {...common} />
           <path d="M6.3 5.8a8 8 0 1 0 11.4 0" {...common} />
         </svg>
       )
     case 'trending-up':
       return (
         <svg viewBox="0 0 24 24" aria-hidden="true">
           <path d="M4 16 10 10l4 4 6-7" {...common} />
           <path d="M15 7h5v5" {...common} />
         </svg>
       )
     case 'alert':
       return (
         <svg viewBox="0 0 24 24" aria-hidden="true">
           <circle cx="12" cy="12" r="8.5" {...common} />
           <path d="M12 8v5" {...common} />
           <path d="M12 15.5h0" {...common} />
         </svg>
       )
     case 'wallet':
       return (
         <svg viewBox="0 0 24 24" aria-hidden="true">
           <rect x="3.5" y="6.5" width="17" height="12.5" rx="2.2" {...common} />
           <path d="M15 12.2h3.2" {...common} />
         </svg>
       )
     case 'logout':
       return (
         <svg viewBox="0 0 24 24" aria-hidden="true">
           <path d="M9 4H6.5A1.5 1.5 0 0 0 5 5.5v13A1.5 1.5 0 0 0 6.5 20H9" {...common} />
           <path d="M15 16l4-4-4-4" {...common} />
           <path d="M19 12H9" {...common} />
         </svg>
       )
     case 'advance':
       return (
         <svg viewBox="0 0 24 24" aria-hidden="true">
           <rect x="3" y="4" width="18" height="18" rx="2" {...common} />
           <path d="M8 2v4M16 2v4" {...common} />
           <path d="M3 10h18" {...common} />
           <path d="M8 14h8" {...common} />
           <path d="M8 18h4" {...common} />
         </svg>
       )
      case 'close':
         return <span aria-hidden="true">×</span>
      case 'clipboard':
        return (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="5" y="5" width="14" height="16" rx="2" {...common} />
            <path d="M9 5a3 3 0 0 1 6 0" {...common} />
            <path d="M9 12h6M9 16h4" {...common} />
          </svg>
        )
     case 'coin':
        return (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="8.5" {...common} />
            <path d="M9.5 15.5c.6.7 1.5 1 2.5 1s1.9-.4 2.5-1.1c.6-.7.6-1.6.2-2.3-.8-1.3-5.1-.7-5.4-2.2-.1-.5.2-1 .9-1.3M12 7v10" {...common} />
          </svg>
        )
     case 'arrow-up':
        return (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 19V5M6 11l6-6 6 6" {...common} />
          </svg>
        )
     case 'arrow-down':
        return (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 5v14M6 13l6 6 6-6" {...common} />
          </svg>
        )
     case 'sparkles':
        return (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 3.5 13.7 9 19 10.8 13.7 12.5 12 18l-1.7-5.5L5 10.8 10.3 9 12 3.5Z" {...common} />
            <path d="M19 3v3M17.5 4.5h3M5 16v3M3.5 17.5h3" {...common} />
          </svg>
        )
     case 'flame':
        return (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 21c4 0 6.5-2.7 6.5-6.2 0-4.2-4.5-6.8-5.8-10-.5 2.6-2 4.6-3.7 5.7C7 9.6 5.5 9 4.6 7.5c-.5 1.7-.1 4.2 1.5 6.1C4.9 15.4 8 21 12 21Z" {...common} />
          </svg>
        )
      default:
        return null
   }
}
