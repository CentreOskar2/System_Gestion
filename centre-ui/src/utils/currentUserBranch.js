import { supabase } from '../supabaseClient'

export async function fetchCurrentUserBranchId() {
  const { data, error } = await supabase.from('user_branches').select('branch_id').limit(1)
  if (error) throw new Error(error.message)
  return data?.[0]?.branch_id || null
}
