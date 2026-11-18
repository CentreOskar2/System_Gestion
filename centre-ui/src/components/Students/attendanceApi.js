import { supabase } from '../../supabaseClient'

// Pointage des élèves (student_events), par groupe ET par matière
// (migration 046). Avant cette migration, seul le groupe était enregistré :
// tant qu'elle n'est pas appliquée, on enregistre et on lit comme avant.

// Colonne subject_id absente : 42703 (Postgres) ou PGRST204 (PostgREST).
function isMissingSubjectColumn(error) {
  return Boolean(error) && (error.code === '42703' || error.code === 'PGRST204') && /subject_id/.test(error.message || '')
}

// Enregistre les événements cochés d'un élève, un jour, dans un groupe et une
// matière (subjectId null : groupe au forfait, toutes matières). Un événement
// déjà pointé pour cette même matière est remplacé (ex. nouveau détail) ;
// ceux des autres matières ne sont pas touchés.
export async function saveAttendanceEvents({ studentId, groupId, subjectId = null, date, events }) {
  const types = events.map((event) => event.type)
  const legacyRows = events.map((event) => ({
    student_id: studentId,
    group_id: groupId,
    event_date: date,
    event_type: event.type,
    detail: event.detail || null,
    created_at: new Date().toISOString(),
  }))
  const rows = legacyRows.map((row) => ({ ...row, subject_id: subjectId }))

  let remove = supabase
    .from('student_events')
    .delete()
    .eq('student_id', studentId)
    .eq('group_id', groupId)
    .eq('event_date', date)
    .in('event_type', types)
  remove = subjectId ? remove.eq('subject_id', subjectId) : remove.is('subject_id', null)
  const { error: deleteError } = await remove

  if (isMissingSubjectColumn(deleteError)) {
    const { error } = await supabase
      .from('student_events')
      .upsert(legacyRows, { onConflict: 'student_id,event_date,event_type,group_id' })
    if (error) throw new Error(error.message)
    return
  }
  if (deleteError) throw new Error(deleteError.message)

  const { error } = await supabase.from('student_events').insert(rows)
  if (error) throw new Error(error.message)
}

// Pointages d'un élève, avec leur matière et leur groupe. `month` : 'AAAA-MM'
// pour un seul mois, rien pour toute l'année.
export async function fetchStudentEvents(studentId, month = null) {
  const query = (fields) => {
    let request = supabase
      .from('student_events')
      .select(fields)
      .eq('student_id', studentId)
      .order('event_date', { ascending: true })
    if (month) request = request.like('event_date', `${month}-%`)
    return request
  }
  let { data, error } = await query('event_type, detail, event_date, group_id, subject_id, subjects(name), groups(name)')
  if (isMissingSubjectColumn(error) || (error && /subjects/.test(error.message || ''))) {
    ;({ data, error } = await query('event_type, detail, event_date, group_id, groups(name)'))
  }
  if (error) throw new Error(error.message)
  return (data || []).map((event) => ({
    ...event,
    subjectName: event.subjects?.name || '',
    groupName: event.groups?.name || '',
  }))
}

// « Maths — 3AC G1 », « 3AC G1 » (forfait ou pointage d'avant la matière).
export function eventPlaceLabel(event) {
  return [event.subjectName, event.groupName].filter(Boolean).join(' — ') || '—'
}
