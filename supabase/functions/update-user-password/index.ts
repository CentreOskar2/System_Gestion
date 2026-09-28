import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const allowedOrigins = new Set([
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://centre-ui.vercel.app',
])

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

  // Seul un super admin actif peut changer le mot de passe d'un compte — même
  // règle d'autorisation que create-user.
  const { data: caller, error: callerError } = await admin
    .from('users')
    .select('role, status')
    .eq('id', authData.user.id)
    .maybeSingle()

  if (callerError || !caller || caller.role !== 'super_admin' || caller.status !== 'active') {
    return response({ error: 'Only active super administrators can change a password' }, 403, headers)
  }

  let payload: Record<string, unknown>
  try {
    payload = await request.json()
  } catch {
    return response({ error: 'Invalid JSON body' }, 400, headers)
  }

  const userId = typeof payload.user_id === 'string' ? payload.user_id : ''
  const password = typeof payload.password === 'string' ? payload.password : ''

  if (!userId || !password || password.length < 6) {
    return response({ error: 'user_id and password (6 characters minimum) are required' }, 400, headers)
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(userId, { password })
  if (updateError) {
    return response({ error: updateError.message }, 400, headers)
  }

  return response({ ok: true }, 200, headers)
})
