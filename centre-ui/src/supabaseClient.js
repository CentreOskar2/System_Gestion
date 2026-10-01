import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl) {
  console.error("⚠️ لم يتم العثور على VITE_SUPABASE_URL! تأكد من إيقاف السيرفر وإعادة تشغيله بعد حفظ ملف .env")
}

// Supabase juge qu'un jeton a expiré en comparant sa date d'expiration
// (fixée par le serveur) à l'horloge de l'ordinateur. Si cette horloge
// retarde de plus de 90 secondes, le client garde un jeton déjà refusé par le
// serveur : la requête échoue avec « JWT expired », parfois au milieu d'une
// inscription. On rafraîchit alors la session et on rejoue la requête une fois.
//
// PostgREST répond 401 ; le stockage de fichiers répond 400 ou 403.
const AUTH_FAILURE_STATUSES = new Set([400, 401, 403])

function isExpiredJwtResponse(body) {
  return /jwt expired|exp" claim|exp claim|PGRST301|PGRST303/i.test(body)
}

// Plusieurs requêtes peuvent échouer en même temps : un seul rafraîchissement
// pour toutes.
let refreshing = null
function refreshAccessToken() {
  if (!refreshing) {
    refreshing = supabase.auth
      .refreshSession()
      .then(({ data, error }) => (error ? null : data.session?.access_token || null))
      .finally(() => {
        refreshing = null
      })
  }
  return refreshing
}

async function fetchWithExpiredJwtRetry(input, init = {}) {
  const response = await fetch(input, init)
  const url = String(input?.url ?? input)
  // Les appels d'authentification eux-mêmes ne sont jamais rejoués : ils ne
  // portent pas le jeton de session et cela bouclerait sur refreshSession().
  if (!AUTH_FAILURE_STATUSES.has(response.status) || url.includes('/auth/v1/')) return response

  const body = await response.clone().text()
  if (!isExpiredJwtResponse(body)) return response

  const accessToken = await refreshAccessToken()
  // Session vraiment perdue (jeton de rafraîchissement refusé) : Supabase émet
  // SIGNED_OUT et l'application renvoie vers la connexion. On rend la réponse
  // d'origine.
  if (!accessToken) return response

  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${accessToken}`)
  return fetch(input, { ...init, headers })
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { fetch: fetchWithExpiredJwtRetry },
})
