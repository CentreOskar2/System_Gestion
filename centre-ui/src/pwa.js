/* Installation en application de bureau (PWA).
 *
 * Deux rôles : enregistrer le service worker qui met l'interface en cache, et
 * recharger l'application dès qu'une nouvelle version est déployée.
 */

// Injecté au build par vite.config.js ; en développement la valeur est 'dev'.
const CURRENT_VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev'

const CHECK_INTERVAL_MS = 5 * 60 * 1000
const RELOADED_KEY = 'oskar_reloaded_for_version'

let registration = null

// Recharger pendant une saisie ferait perdre une inscription en cours : on
// attend simplement la prochaine vérification.
function isUserTyping() {
  const el = document.activeElement
  if (!el) return false
  if (el.isContentEditable) return true
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)
}

// Sans ce garde-fou, une version.json servie depuis un cache CDN périmé
// relancerait le rechargement en boucle.
function alreadyReloadedFor(version) {
  try {
    return sessionStorage.getItem(RELOADED_KEY) === version
  } catch {
    return false
  }
}

function rememberReload(version) {
  try {
    sessionStorage.setItem(RELOADED_KEY, version)
  } catch {
    /* stockage indisponible (navigation privée) : au pire un rechargement de plus */
  }
}

async function fetchDeployedVersion() {
  try {
    const response = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' })
    if (!response.ok) return null
    const data = await response.json()
    return typeof data?.version === 'string' ? data.version : null
  } catch {
    // Hors ligne : rien à mettre à jour, on réessaiera plus tard.
    return null
  }
}

async function checkForUpdate() {
  if (document.visibilityState !== 'visible') return
  const deployed = await fetchDeployedVersion()
  if (!deployed || deployed === CURRENT_VERSION || alreadyReloadedFor(deployed)) return
  if (isUserTyping()) return

  rememberReload(deployed)
  try {
    await registration?.update()
  } catch {
    /* le rechargement récupérera de toute façon la nouvelle coquille */
  }
  window.location.reload()
}

export function setupPwa() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return

  window.addEventListener('load', async () => {
    try {
      registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
    } catch (err) {
      console.error('Service worker non enregistré', err)
      return
    }

    checkForUpdate()
    setInterval(checkForUpdate, CHECK_INTERVAL_MS)
    document.addEventListener('visibilitychange', checkForUpdate)
  })
}
