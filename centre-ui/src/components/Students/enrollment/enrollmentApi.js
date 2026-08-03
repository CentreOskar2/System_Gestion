import { supabase } from '../../../supabaseClient'

export async function fetchCatalog() {
  const [cycles, levels, studyBranches, subjects, teachers, teacherSubjects, teacherLevels, groups, groupStudents, tariffs, branches] =
    await Promise.all([
      supabase.from('cycles').select('*').order('name'),
      supabase.from('levels').select('*').order('name'),
      supabase.from('study_branches').select('*').order('name'),
      supabase.from('subjects').select('*').order('name'),
      supabase.from('teachers').select('*').order('first_name'),
      supabase.from('teacher_subjects').select('teacher_id, subject_id'),
      supabase.from('teacher_levels').select('teacher_id, level_id'),
      supabase.from('groups').select('*').order('name'),
      supabase.from('group_students').select('group_id, student_id, students(first_name, last_name)'),
      supabase.from('tariffs').select('level_id, subject_id, price'),
      supabase.from('branches').select('id, name').order('name'),
    ])

  const firstError = [cycles, levels, studyBranches, subjects, teachers, teacherSubjects, teacherLevels, groups, groupStudents, tariffs, branches].find((r) => r.error)
  if (firstError) throw new Error(firstError.error.message)

  const cycleByName = Object.fromEntries((cycles.data || []).map((c) => [c.name, c]))
  const levelByName = Object.fromEntries((levels.data || []).map((l) => [l.name, l]))
  const subjectsByName = Object.fromEntries((subjects.data || []).map((s) => [s.name, s]))
  const teachersById = Object.fromEntries((teachers.data || []).map((t) => [t.id, t]))

  const levelsByCycle = {}
  for (const level of levels.data || []) {
    const cycle = cycleByName[cycleNameOf(level, cycles.data)]
    const key = cycle?.name || ''
    if (!key) continue
    if (!levelsByCycle[key]) levelsByCycle[key] = []
    levelsByCycle[key].push(level.name)
  }
  for (const key of Object.keys(levelsByCycle)) levelsByCycle[key].sort()

  const branchesByLevel = {}
  for (const sb of studyBranches.data || []) {
    const level = levels.data?.find((l) => l.id === sb.level_id)
    if (!level) continue
    if (!branchesByLevel[level.name]) branchesByLevel[level.name] = []
    branchesByLevel[level.name].push(sb.name)
  }
  for (const key of Object.keys(branchesByLevel)) branchesByLevel[key].sort()

  const teachersByName = {}
  for (const t of teachers.data || []) {
    teachersByName[`${t.first_name} ${t.last_name}`] = t
  }

  const teachersBySubject = {}
  for (const row of teacherSubjects.data || []) {
    if (!teachersBySubject[row.subject_id]) teachersBySubject[row.subject_id] = []
    teachersBySubject[row.subject_id].push(row.teacher_id)
  }

  const teachersByLevel = {}
  for (const row of teacherLevels.data || []) {
    if (!teachersByLevel[row.level_id]) teachersByLevel[row.level_id] = []
    teachersByLevel[row.level_id].push(row.teacher_id)
  }

  const studentsByGroup = {}
  for (const row of groupStudents.data || []) {
    const student = row.students
    if (!student) continue
    const name = `${student.first_name || ''} ${student.last_name || ''}`.trim()
    if (!studentsByGroup[row.group_id]) studentsByGroup[row.group_id] = []
    if (name) studentsByGroup[row.group_id].push(name)
  }

  const groupsBySubject = {}
  for (const g of groups.data || []) {
    const subject = subjectsById(g.subject_id, subjects.data)
    if (!subject) continue
    if (!groupsBySubject[subject.name]) groupsBySubject[subject.name] = []
    groupsBySubject[subject.name].push({
      id: g.id,
      name: g.name,
      subject_id: g.subject_id,
      level_id: g.level_id,
      teacher_id: g.teacher_id,
      capacity: g.capacity,
      student_count: (studentsByGroup[g.id] || []).length,
      students: studentsByGroup[g.id] || [],
      status: g.status,
    })
  }
  for (const key of Object.keys(groupsBySubject)) groupsBySubject[key].sort((a, b) => a.name.localeCompare(b.name))

  const tariffsByLevelSubject = {}
  for (const row of tariffs.data || []) {
    if (!tariffsByLevelSubject[row.level_id]) tariffsByLevelSubject[row.level_id] = {}
    tariffsByLevelSubject[row.level_id][row.subject_id] = Number(row.price)
  }

  return {
    cycles: cycles.data || [],
    levels: levels.data || [],
    cycleByName,
    levelByName,
    levelsByCycle,
    branchesByLevel,
    subjects: subjects.data || [],
    subjectsByName,
    teachers: (teachers.data || []).map((t) => ({ id: t.id, name: `${t.first_name} ${t.last_name}` })),
    teachersById,
    teachersByName,
    teachersBySubject,
    teachersByLevel,
    groups: groups.data || [],
    groupsBySubject,
    tariffsByLevelSubject,
    branches: branches.data || [],
    defaultBranchId: branches.data?.[0]?.id || null,
  }
}

function cycleNameOf(level, cycles) {
  return cycles.find((c) => c.id === level.cycle_id)?.name || ''
}

function subjectsById(id, subjects) {
  return subjects.find((s) => s.id === id)
}

export function getPrice(catalog, levelName, subjectName) {
  const level = catalog.levelByName[levelName]
  const subject = catalog.subjectsByName[subjectName]
  if (level && subject) {
    const tariff = catalog.tariffsByLevelSubject[level.id]?.[subject.id]
    if (tariff != null) return tariff
    const cycle = catalog.cycleByName[cycleNameOf(level, catalog.cycles)]
    if (cycle?.has_fixed_price && cycle.fixed_price != null) return Number(cycle.fixed_price)
  }
  return 0
}

export async function nextRegistrationNumber() {
  const year = new Date().getFullYear()
  const prefix = `REG-${year}-`
  const { data, error } = await supabase.from('students').select('registration_number')
  if (error) throw new Error(error.message)
  let max = 999
  for (const row of data || []) {
    const suffix = row.registration_number?.startsWith(prefix)
      ? parseInt(row.registration_number.slice(prefix.length), 10)
      : NaN
    if (!Number.isNaN(suffix) && suffix > max) max = suffix
  }
  return `${prefix}${max + 1}`
}

async function ensureFiliere(name) {
  const { data, error } = await supabase.from('filieres').select('id').eq('name', name).maybeSingle()
  if (error) throw new Error(error.message)
  if (data) return data.id
  const { data: inserted, error: insertError } = await supabase
    .from('filieres')
    .insert({ name })
    .select('id')
    .single()
  if (insertError) throw new Error(insertError.message)
  return inserted.id
}

function subjectDetailsFor(form, catalog, subjectName) {
  const details = form.subjectDetails?.[subjectName] || {}
  const teacher = details.teacher ? catalog.teachersByName[details.teacher] : null
  const group = details.group ? catalog.groupsBySubject[subjectName]?.find((g) => g.name === details.group) : null
  const subject = catalog.subjectsByName[subjectName]
  const standardPrice = getPrice(catalog, form.level, subjectName)
  const monthlyPrice = details.priceType === 'manual' ? Number(details.manualPrice || 0) : standardPrice
  return {
    subject_id: subject?.id || null,
    teacher_id: teacher?.id || null,
    group_id: group?.id || null,
    pricing_type: details.priceType === 'manual' ? 'manual' : 'standard',
    monthly_price: Number.isFinite(monthlyPrice) ? monthlyPrice : 0,
  }
}

async function syncSubscriptions(studentId, form, catalog) {
  const { data: existing, error: fetchError } = await supabase
    .from('student_subscriptions')
    .select('id, group_id')
    .eq('student_id', studentId)
  if (fetchError) throw new Error(fetchError.message)

  const newGroupIds = form.chosen
    .map((name) => subjectDetailsFor(form, catalog, name).group_id)
    .filter(Boolean)

  const oldGroupIds = (existing || []).map((row) => row.group_id).filter(Boolean)
  const toRemove = oldGroupIds.filter((id) => !newGroupIds.includes(id))
  const toAdd = newGroupIds.filter((id) => !oldGroupIds.includes(id))

  if (toRemove.length > 0) {
    const { error } = await supabase
      .from('group_students')
      .delete()
      .eq('student_id', studentId)
      .in('group_id', toRemove)
    if (error) throw new Error(error.message)
  }
  if (toAdd.length > 0) {
    const { error } = await supabase
      .from('group_students')
      .insert(toAdd.map((group_id) => ({ student_id: studentId, group_id })))
    if (error) throw new Error(error.message)
  }

  if ((existing || []).length > 0) {
    const { error } = await supabase.from('student_subscriptions').delete().eq('student_id', studentId)
    if (error) throw new Error(error.message)
  }

  if (form.chosen.length > 0) {
    const { error } = await supabase.from('student_subscriptions').insert(
      form.chosen.map((name) => ({ student_id: studentId, ...subjectDetailsFor(form, catalog, name) }))
    )
    if (error) throw new Error(error.message)
  }
}

function studentPayload(form, catalog, filiereId, status = 'active') {
  const level = catalog.levelByName[form.level]
  const cycle = level ? catalog.cycleByName[level.cycle_id] : null
  return {
    branch_id: form.branch_id || catalog.defaultBranchId,
    first_name: form.firstName,
    last_name: form.lastName,
    cycle_id: cycle?.id || null,
    level_id: level?.id || null,
    filiere_id: filiereId,
    registration_number: form.code,
    phone1: form.phone || null,
    phone2: form.phone2 || null,
    registration_date: form.registrationDate || null,
    address: form.address || null,
    school_origin: form.school || null,
    class_in_school: form.schoolClass || null,
    medical_notes: form.alerts || null,
    status,
  }
}

export async function createEnrollment(form, catalog) {
  let filiereId = null
  if (form.track) filiereId = await ensureFiliere(form.track)

  const { data, error } = await supabase
    .from('students')
    .insert(studentPayload(form, catalog, filiereId))
    .select('id')
    .single()
  if (error) throw new Error(error.message)

  await syncSubscriptions(data.id, form, catalog)
  return { id: data.id }
}

export async function updateEnrollment(studentId, form, catalog, status = 'active') {
  let filiereId = null
  if (form.track) filiereId = await ensureFiliere(form.track)

  const { error } = await supabase
    .from('students')
    .update(studentPayload(form, catalog, filiereId, status))
    .eq('id', studentId)
  if (error) throw new Error(error.message)

  await syncSubscriptions(studentId, form, catalog)
  return { id: studentId }
}

export async function setStudentStatus(studentId, status) {
  const { error } = await supabase.from('students').update({ status }).eq('id', studentId)
  if (error) throw new Error(error.message)
}

export async function deactivateAllStudents() {
  const { error } = await supabase.from('students').update({ status: 'inactive' }).neq('status', 'inactive')
  if (error) throw new Error(error.message)
}

export async function fetchStudents() {
  const { data, error } = await supabase
    .from('students')
    .select('*, branches(name), levels(name, cycle_id, cycles(name)), cycles(name), filieres(name)')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)

  const { data: subs, error: subsError } = await supabase
    .from('student_subscriptions')
    .select('student_id, subject_id, teacher_id, group_id, pricing_type, monthly_price, subjects(name), teachers(first_name,last_name), groups(name)')
  if (subsError) throw new Error(subsError.message)

  const subsByStudent = {}
  for (const sub of subs || []) {
    if (!subsByStudent[sub.student_id]) subsByStudent[sub.student_id] = []
    subsByStudent[sub.student_id].push(sub)
  }

  return (data || []).map((s) => {
    const list = subsByStudent[s.id] || []
    const chosen = list.map((x) => x.subjects?.name).filter(Boolean)
    const subjectDetails = {}
    for (const x of list) {
      const subjectName = x.subjects?.name
      if (!subjectName) continue
      subjectDetails[subjectName] = {
        teacher: x.teachers ? `${x.teachers.first_name} ${x.teachers.last_name}` : '',
        group: x.groups?.name || '',
        priceType: x.pricing_type,
        manualPrice: x.pricing_type === 'manual' ? Number(x.monthly_price) : undefined,
      }
    }
    return {
      id: s.id,
      name: `${s.first_name} ${s.last_name}`.trim(),
      code: s.registration_number,
      cycle: s.cycles?.name || s.levels?.cycles?.name || '',
      level: s.levels?.name || '',
      track: s.filieres?.name || '',
      branch: s.branches?.name || '',
      subjects: list.length,
      payment: 'N/A',
      active: s.status === 'active',
      phone: s.phone1 || '',
      phone2: s.phone2 || '',
      registrationDate: s.registration_date || '',
      address: s.address || '',
      school: s.school_origin || '',
      schoolClass: s.class_in_school || '',
      alerts: s.medical_notes || '',
      chosen,
      subjectDetails,
      cycle_id: s.cycle_id,
      level_id: s.level_id,
      filiere_id: s.filiere_id,
      branch_id: s.branch_id,
    }
  })
}
