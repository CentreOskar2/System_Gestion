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

export async function recordRegistrationFee({ studentId, schoolYear, amount, paid, userId = null }) {
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
