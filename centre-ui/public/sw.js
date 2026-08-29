/* Service worker de Centre Oskar.
 *
 * Objectif : l'application s'ouvre instantanément, même sans réseau. Les
 * données (élèves, paiements, salaires) ne sont JAMAIS mises en cache : elles
 * viennent toujours de Supabase en direct, pour qu'on n'encaisse jamais un
 * paiement sur des chiffres périmés.
 */

const CACHE = 'oskar-v1'

// Coquille minimale : de quoi afficher l'application hors ligne.
const SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-512.png',
  '/oskar-logo.png',
]

// Jamais servi depuis le cache : ces fichiers portent la version déployée.
const ALWAYS_FRESH = ['/version.json', '/sw.js']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      // addAll échouerait en bloc si une seule ressource manquait.
      .then((cache) => Promise.allSettled(SHELL.map((url) => cache.add(url))))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  )
})

// Permet à la page de forcer l'activation d'une nouvelle version.
self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting()
})

async function networkFirst(request) {
  const cache = await caches.open(CACHE)
  try {
    const response = await fetch(request)
    if (response.ok) cache.put(request, response.clone())
    return response
  } catch (err) {
    const cached = (await cache.match(request)) || (await cache.match('/index.html')) || (await cache.match('/'))
    if (cached) return cached
    throw err
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE)
  const cached = await cache.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok) cache.put(request, response.clone())
  return response
}

self.addEventListener('fetch', (event) => {
  const { request } = event

  // Requêtes Supabase, envois de formulaires, etc. : jamais interceptés.
  if (request.method !== 'GET') return

  let url
  try {
    url = new URL(request.url)
  } catch {
    return
  }
  if (url.origin !== self.location.origin) return
  if (ALWAYS_FRESH.includes(url.pathname)) return

  // Navigation : on privilégie le réseau pour recevoir la dernière version
  // déployée, et on retombe sur la coquille en cache si le réseau manque.
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request))
    return
  }

  // Fichiers versionnés par Vite (/assets/index-a1b2c3.js) : leur nom change à
  // chaque build, le cache ne peut donc jamais servir une version périmée.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request))
    return
  }

  // Images, polices et manifeste : servis depuis le cache puis rafraîchis en
  // arrière-plan, car leur nom, lui, ne change pas d'un déploiement à l'autre.
  if (/\.(?:png|jpe?g|svg|gif|webp|ico|woff2?|ttf|otf|webmanifest|css)$/.test(url.pathname)) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const cached = await cache.match(request)
        const network = fetch(request)
          .then((response) => {
            if (response.ok) cache.put(request, response.clone())
            return response
          })
          .catch(() => cached)
        return cached || network
      })
    )
  }
})
