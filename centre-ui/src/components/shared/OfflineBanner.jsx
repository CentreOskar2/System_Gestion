import { useEffect, useState } from 'react'
import './OfflineBanner.css'

/* L'interface est servie depuis le cache, mais les données viennent de
 * Supabase : sans réseau les écrans restent affichés alors que plus rien ne se
 * charge ni ne s'enregistre. Ce bandeau lève l'ambiguïté. */
export default function OfflineBanner() {
  const [online, setOnline] = useState(() => navigator.onLine)

  useEffect(() => {
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  if (online) return null

  return (
    <div className="offline-banner" role="status">
      <span className="offline-banner-dot" />
      <b>Pas de connexion internet</b>
      <span>Les données ne peuvent être ni chargées ni enregistrées tant que la connexion n'est pas rétablie.</span>
    </div>
  )
}
