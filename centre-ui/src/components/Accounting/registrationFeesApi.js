import { supabase } from '../../supabaseClient'

export async function fetchRegistrationFees(schoolYear) {
  if (!schoolYear) return {}
  const { data, error } = await supabase
    .from('registration_fees')
    .select('id, student_id, school_year, amount, status, paid_at, validated_by')
    .eq('school_year', schoolYear)

  // Before the registration_fees migration has been applied, behave as if no fee
  // has been recorded yet — every student simply shows as "Impayé".
  if (error) {
    console.error(error)
    return {}
  }
  return Object.fromEntries((data || []).map((row) => [row.student_id, row]))
}

export async function fetchRegistrationFee(studentId, schoolYear) {
  if (!studentId || !schoolYear) return null
  const { data, error } = await supabase
    .from('registration_fees')
    .select('id, student_id, school_year, amount, status, paid_at, validated_by')
    .eq('student_id', studentId)
    .eq('school_year', schoolYear)
    .maybeSingle()
  if (error) {
    console.error(error)
    return null
  }
  return data
}

export async function recordRegistrationFee({ studentId, schoolYear, amount, paid, userId = null }) {
  // Les frais d'inscription se paient UNE FOIS par élève et par année scolaire.
  // Un élève inscrit d'abord en formation seule, puis rattaché à un cycle, ne
  // doit pas les régler une seconde fois : si la ligne de l'année est déjà
  // payée, on la rend telle quelle sans jamais la repasser en impayé.
  const existing = await fetchRegistrationFee(studentId, schoolYear)
  if (existing?.status === 'paid') return existing

  const row = {
    student_id: studentId,
    school_year: schoolYear,
    amount: Number(amount) || 0,
    status: paid ? 'paid' : 'unpaid',
    paid_at: paid ? new Date().toISOString() : null,
    validated_by: paid ? userId : null,
  }
  const { data, error } = await supabase
    .from('registration_fees')
    .upsert(row, { onConflict: 'student_id,school_year' })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function payRegistrationFee({ studentId, schoolYear, amount, userId = null }) {
  return recordRegistrationFee({ studentId, schoolYear, amount, paid: true, userId })
}
