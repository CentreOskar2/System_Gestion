import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const allowedOrigins = new Set([
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://centre-ui.vercel.app',
])

// Durée du blocage Auth d'un compte désactivé : 100 ans, c'est-à-dire
// « jusqu'à réactivation ». La réactivation le lève avec 'none'.
const BAN_UNTIL_REACTIVATED = '876000h'

function corsHeaders(request: Request) {
  const origin = request.headers.get('origin') ?? ''
  return {
    'Access-Control-Allow-Origin': allowedOrigins.has(origin) ? origin : 'https://centre-ui.vercel.app',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}

function response(body: Record<string, unknown>, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  })
}

// Active ou désactive un compte de la plateforme.
//
// Changer seulement users.status ne suffisait pas : le compte gardait sa
// session Supabase, qui se renouvelle seule toutes les heures. Un utilisateur
// désactivé mais resté sur un onglet ouvert continuait donc de travailler.
// Ici le compte est aussi bloqué côté Auth : sa session ne peut plus être
// renouvelée, et il ne peut plus se reconnecter tant qu'il n'est pas réactivé.
Deno.serve(async (request) => {
  const headers = corsHeaders(request)

  if (request.method === 'OPTIONS') return new Response('ok', { headers })
  if (request.method !== 'POST') return response({ error: 'Method not allowed' }, 405, headers)

  const authorization = request.headers.get('authorization')
  if (!authorization?.startsWith('Bearer ')) {
    return response({ error: 'Authentication required' }, 401, headers)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing Supabase Edge Function environment variables')
    return response({ error: 'Server configuration error' }, 500, headers)
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const token = authorization.slice('Bearer '.length)
  const { data: authData, error: authError } = await admin.auth.getUser(token)
  if (authError || !authData.user) return response({ error: 'Invalid session' }, 401, headers)

  // Même règle d'autorisation que create-user et update-user-password.
  const { data: caller, error: callerError } = await admin
    .from('users')
    .select('role, status')
    .eq('id', authData.user.id)
    .maybeSingle()

  if (callerError || !caller || caller.role !== 'super_admin' || caller.status !== 'active') {
    return response({ error: 'Only active super administrators can change an account status' }, 403, headers)
  }

  let payload: Record<string, unknown>
  try {
    payload = await request.json()
  } catch {
    return response({ error: 'Invalid JSON body' }, 400, headers)
  }

  const userId = typeof payload.user_id === 'string' ? payload.user_id : ''
  const status = payload.status
  if (!userId || (status !== 'active' && status !== 'inactive')) {
    return response({ error: "user_id and status ('active' or 'inactive') are required" }, 400, headers)
  }

  // Un super admin qui se désactiverait lui-même perdrait tout accès, sans
  // personne pour le réactiver.
  if (userId === authData.user.id && status === 'inactive') {
    return response({ error: 'You cannot deactivate your own account' }, 400, headers)
  }

  // Blocage Auth d'abord : si cette étape échoue, le statut affiché ne doit
  // pas prétendre que le compte est coupé.
  const { error: banError } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: status === 'inactive' ? BAN_UNTIL_REACTIVATED : 'none',
  })
  if (banError) {
    return response({ error: banError.message }, 400, headers)
  }

  const { error: statusError } = await admin.from('users').update({ status }).eq('id', userId)
  if (statusError) {
    return response({ error: statusError.message }, 400, headers)
  }

  return response({ ok: true, status }, 200, headers)
})
