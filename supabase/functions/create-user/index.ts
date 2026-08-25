import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const allowedOrigins = new Set([
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://centre-ui.vercel.app',
])

const permissionColumns = [
  'dashboard',
  'students',
  'groups',
  'teachers',
  'tuition',
  'late_payments',
  'teacher_salaries',
  'expenses',
  'net_profit',
  'settings',
  'administration',
]

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

  const { data: caller, error: callerError } = await admin
    .from('users')
    .select('role, status')
    .eq('id', authData.user.id)
    .maybeSingle()

  if (callerError || !caller || caller.role !== 'super_admin' || caller.status !== 'active') {
    return response({ error: 'Only active super administrators can create users' }, 403, headers)
  }

  let payload: Record<string, unknown>
  try {
    payload = await request.json()
  } catch {
    return response({ error: 'Invalid JSON body' }, 400, headers)
  }

  const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : ''
  const password = typeof payload.password === 'string' ? payload.password : ''
  const firstName = typeof payload.first_name === 'string' ? payload.first_name.trim() : ''
  const lastName = typeof payload.last_name === 'string' ? payload.last_name.trim() : ''
  const role = payload.role === 'super_admin' ? 'super_admin' : payload.role === 'secretary' ? 'secretary' : ''
  const branchIds = Array.isArray(payload.branch_ids) && payload.branch_ids.every((id) => typeof id === 'string')
    ? [...new Set(payload.branch_ids)]
    : []
  const permissions = Array.isArray(payload.permissions) && payload.permissions.every((permission) => typeof permission === 'string')
    ? [...new Set(payload.permissions)]
    : []

  if (!email || !password || password.length < 6 || !firstName || !lastName || !role) {
    return response({ error: 'Email, password (6 characters minimum), first name, last name and role are required' }, 400, headers)
  }
  if (permissions.some((permission) => !permissionColumns.includes(permission))) {
    return response({ error: 'Invalid permission requested' }, 400, headers)
  }
  if (role === 'secretary' && branchIds.length === 0) {
    return response({ error: 'A secretary must be assigned to at least one branch' }, 400, headers)
  }

  const { data: createdAuth, error: createAuthError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (createAuthError || !createdAuth.user) {
    return response({ error: createAuthError?.message ?? 'Unable to create authentication user' }, 400, headers)
  }

  const userId = createdAuth.user.id
  try {
    const { error: profileError } = await admin.from('users').insert({
      id: userId,
      email,
      first_name: firstName,
      last_name: lastName,
      role,
      status: 'active',
    })
    if (profileError) throw profileError

    if (role === 'secretary') {
      const { error: branchesError } = await admin.from('user_branches').insert(
        branchIds.map((branch_id) => ({ user_id: userId, branch_id })),
      )
      if (branchesError) throw branchesError
    }

    const permissionsRow: Record<string, unknown> = { user_id: userId }
    for (const permission of permissionColumns) {
      permissionsRow[permission] = role === 'super_admin' || permissions.includes(permission)
    }
    const { error: permissionsError } = await admin.from('user_permissions').upsert(permissionsRow, { onConflict: 'user_id' })
    if (permissionsError) throw permissionsError

    return response({ id: userId, email }, 201, headers)
  } catch (error) {
    console.error('Unable to save user profile', error)
    await admin.auth.admin.deleteUser(userId)
    return response({ error: 'Unable to save the user profile' }, 500, headers)
  }
})
