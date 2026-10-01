import { supabase } from '../../supabaseClient'
import { fetchAllRows } from '../../utils/fetchAllRows'

/* Avances sur salaire des professeurs (table teacher_advances, migration 038).
 *
 * Une avance est rattachée à un mois de salaire (`month`, le 1er du mois) :
 * elle est déduite du net à verser de CE mois-là, dans la page Salaires et le
 * journal du professeur.
 */

// Tant que la migration 038 n'a pas été passée, la table n'existe pas :
// Postgres répond 42P01, PostgREST PGRST205 (« table introuvable »).
export function isMissingAdvancesTable(error) {
  return Boolean(error) && (error.code === '42P01' || error.code === 'PGRST205' || /teacher_advances/.test(error.message || ''))
}

export async function fetchTeacherAdvances() {
  const { data, error } = await fetchAllRows(() =>
    supabase
      .from('teacher_advances')
      .select('id, teacher_id, amount, advance_date, month, note, created_at')
      .order('advance_date', { ascending: false })
      .order('id')
  )
  if (error) {
    if (isMissingAdvancesTable(error)) return { advances: [], missingTable: true }
    throw new Error(error.message)
  }
  return {
    advances: (data || []).map((row) => ({ ...row, amount: Number(row.amount) || 0 })),
    missingTable: false,
  }
}

export async function saveTeacherAdvance({ id, teacherId, amount, advanceDate, month, note, userId }) {
  const payload = {
    teacher_id: teacherId,
    amount: Number(amount),
    advance_date: advanceDate,
    month,
    note: note?.trim() || null,
  }
  const query = id
    ? supabase.from('teacher_advances').update(payload).eq('id', id)
    : supabase.from('teacher_advances').insert({ ...payload, created_by: userId || null })
  const { error } = await query
  if (error) throw new Error(error.message)
}

export async function deleteTeacherAdvance(id) {
  const { error } = await supabase.from('teacher_advances').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// Avances regroupées par professeur puis par mois de salaire ('AAAA-MM').
export function indexAdvances(advances) {
  const index = {}
  for (const advance of advances || []) {
    const monthKey = String(advance.month || '').slice(0, 7)
    if (!index[advance.teacher_id]) index[advance.teacher_id] = {}
    if (!index[advance.teacher_id][monthKey]) index[advance.teacher_id][monthKey] = []
    index[advance.teacher_id][monthKey].push(advance)
  }
  return index
}
