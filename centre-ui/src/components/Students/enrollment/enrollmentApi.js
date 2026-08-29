import { supabase } from '../../../supabaseClient'
import { uploadImage } from '../../../utils/storage'

export async function fetchCatalog() {
  const [cycles, levels, studyBranches, subjects, teachers, teacherSubjects, teacherLevels, teacherGroupSubjects, groups, groupStudents, tariffs, branches, userBranches] =
    await Promise.all([
      supabase.from('cycles').select('*').order('name'),
      supabase.from('levels').select('*').order('name'),
      supabase.from('study_branches').select('*').order('name'),
      supabase.from('subjects').select('*').order('name'),
      supabase.from('teachers').select('*').order('first_name'),
      supabase.from('teacher_subjects').select('teacher_id, subject_id'),
      supabase.from('teacher_levels').select('teacher_id, level_id'),
      supabase.from('teacher_group_subjects').select('group_id, subject_id, teacher_id'),
      supabase.from('groups').select('*').order('name'),
      // FK nommée explicitement : une clé étrangère en double avait rendu cette
      // jointure ambiguë et fait échouer fetchCatalog (corrigé par la migration 003).
      // Nommer la contrainte protège d'une éventuelle réapparition du doublon.
      supabase.from('group_students').select('group_id, student_id, students!group_students_student_id_fkey(first_name, last_name)'),
      supabase.from('tariffs').select('level_id, subject_id, price'),
      supabase.from('branches').select('id, name').order('name'),
      supabase.from('user_branches').select('branch_id'),
    ])

  const firstError = [cycles, levels, studyBranches, subjects, teachers, teacherSubjects, teacherLevels, teacherGroupSubjects, groups, groupStudents, tariffs, branches, userBranches].find((r) => r.error)
  if (firstError) throw new Error(firstError.error.message)

  const cycleByName = Object.fromEntries((cycles.data || []).map((c) => [c.name, c]))
  const cycleById = Object.fromEntries((cycles.data || []).map((c) => [c.id, c]))
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

  const filiereEntry = (sb) => ({ id: sb.id, name: sb.name, level_id: sb.level_id })
  const filiereById = Object.fromEntries((studyBranches.data || []).map((sb) => [sb.id, filiereEntry(sb)]))
  const filiereByName = Object.fromEntries((studyBranches.data || []).map((sb) => [sb.name, filiereEntry(sb)]))

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

  const groupEntry = (g) => ({
    id: g.id,
    name: g.name,
    subject_id: g.subject_id,
    level_id: g.level_id,
    filiere_id: g.filiere_id,
    teacher_id: g.teacher_id,
    capacity: g.capacity,
    student_count: (studentsByGroup[g.id] || []).length,
    students: studentsByGroup[g.id] || [],
    status: g.status,
  })

  const groupsById = Object.fromEntries((groups.data || []).map((g) => [g.id, g]))

  const groupsByLevel = {}
  for (const g of groups.data || []) {
    const levelRow = levels.data?.find((l) => l.id === g.level_id)
    if (!levelRow) continue
    const levelName = levelRow.name
    if (!groupsByLevel[levelName]) groupsByLevel[levelName] = []
    groupsByLevel[levelName].push(groupEntry(g))
  }
  for (const key of Object.keys(groupsByLevel)) groupsByLevel[key].sort((a, b) => a.name.localeCompare(b.name))

  const teacherByGroupSubject = {}
  for (const row of teacherGroupSubjects.data || []) {
    teacherByGroupSubject[`${row.group_id}:${row.subject_id}`] = row.teacher_id
  }

  const tariffsByLevelSubject = {}
  for (const row of tariffs.data || []) {
    if (!tariffsByLevelSubject[row.level_id]) tariffsByLevelSubject[row.level_id] = {}
    tariffsByLevelSubject[row.level_id][row.subject_id] = Number(row.price)
  }

  return {
    cycles: cycles.data || [],
    levels: levels.data || [],
    cycleByName,
    cycleById,
    levelByName,
    levelsByCycle,
    branchesByLevel,
    filiereById,
    filiereByName,
    subjects: subjects.data || [],
    subjectsByName,
    teachers: (teachers.data || []).map((t) => ({ id: t.id, name: `${t.first_name} ${t.last_name}` })),
    teachersById,
    teachersByName,
    teachersBySubject,
    teachersByLevel,
    groups: groups.data || [],
    groupsById,
    groupsBySubject,
    groupsByLevel,
    teacherByGroupSubject,
    tariffsByLevelSubject,
    branches: branches.data || [],
    defaultBranchId: userBranches.data?.[0]?.branch_id || branches.data?.[0]?.id || null,
  }
}

function cycleNameOf(level, cycles) {
  return cycles.find((c) => c.id === level.cycle_id)?.name || ''
}

function subjectsById(id, subjects) {
  return subjects.find((s) => s.id === id)
}

// Cycles au forfait (préscolaire, primaire) : l'élève suit tout le niveau et
// paie un prix unique. Il n'y a donc ni matière à choisir ni tarif par matière.
export function isPackageLevel(catalog, levelName) {
  const level = catalog?.levelByName?.[levelName]
  if (!level) return false
  return Boolean(catalog.cycleById?.[level.cycle_id]?.has_fixed_price)
}

export function packagePrice(catalog, levelName) {
  const level = catalog?.levelByName?.[levelName]
  return level?.fixed_price != null ? Number(level.fixed_price) : 0
}

// Le forfait du niveau, sauf remise saisie à l'inscription pour cet élève.
export function packageAmount(form, catalog) {
  if (form?.packagePriceType === 'manual') {
    const manual = Number(form.packageManualPrice)
    return Number.isFinite(manual) && manual >= 0 ? manual : 0
  }
  return packagePrice(catalog, form?.level)
}

export function getPrice(catalog, levelName, subjectName) {
  const level = catalog.levelByName[levelName]
  const subject = catalog.subjectsByName[subjectName]
  if (level && subject) {
    const tariff = catalog.tariffsByLevelSubject[level.id]?.[subject.id]
    if (tariff != null) return tariff
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

async function ensureFiliere(levelId, name) {
  const { data, error } = await supabase
    .from('study_branches')
    .select('id')
    .eq('level_id', levelId)
    .eq('name', name)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (data) return data.id
  const { data: inserted, error: insertError } = await supabase
    .from('study_branches')
    .insert({ level_id: levelId, name })
    .select('id')
    .single()
  if (insertError) throw new Error(insertError.message)
  return inserted.id
}

function subjectDetailsFor(form, catalog, subjectName) {
  const details = form.subjectDetails?.[subjectName] || {}
  const teacher = details.teacher ? catalog.teachersByName[details.teacher] : null
  const group = details.group
    ? Object.values(catalog.groupsById || {}).find((g) => g.name === details.group)
    : null
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

export function teacherForGroupSubject(catalog, groupId, subjectName) {
  if (!groupId || !subjectName) return ''
  const subject = catalog.subjectsByName?.[subjectName]
  if (subject) {
    const teacherId = catalog.teacherByGroupSubject?.[`${groupId}:${subject.id}`]
    const teacher = teacherId && catalog.teachersById?.[teacherId]
    if (teacher) return `${teacher.first_name} ${teacher.last_name}`.trim()
  }
  const group = catalog.groupsById?.[groupId]
  const groupTeacher = group?.teacher_id && catalog.teachersById?.[group.teacher_id]
  return groupTeacher ? `${groupTeacher.first_name} ${groupTeacher.last_name}`.trim() : ''
}

async function syncGroupSubjectRows(studentId, rows) {
  const { data: existing } = await supabase
    .from('student_group_subjects')
    .select('group_id, subject_id')
    .eq('student_id', studentId)
  const oldKeys = new Set((existing || []).map((r) => `${r.group_id}:${r.subject_id}`))
  const newKeys = new Set(rows.map((r) => `${r.group_id}:${r.subject_id}`))
  for (const key of oldKeys) {
    if (newKeys.has(key)) continue
    const [group_id, subject_id] = key.split(':')
    const { error } = await supabase
      .from('student_group_subjects')
      .delete()
      .eq('student_id', studentId)
      .eq('group_id', group_id)
      .eq('subject_id', subject_id)
    if (error) throw new Error(error.message)
  }
  const toAdd = rows.filter((r) => !oldKeys.has(`${r.group_id}:${r.subject_id}`))
  if (toAdd.length > 0) {
    const { error } = await supabase.from('student_group_subjects').insert(toAdd)
    if (error) throw new Error(error.message)
  }
}

export async function syncSubscriptions(studentId, form, catalog) {
  const { data: existing, error: fetchError } = await supabase
    .from('student_subscriptions')
    .select('id, group_id')
    .eq('student_id', studentId)
  if (fetchError) throw new Error(fetchError.message)

  const newSubs = form.chosen.map((name) => ({ student_id: studentId, ...subjectDetailsFor(form, catalog, name) }))
  const newGroupIds = newSubs.map((sub) => sub.group_id).filter(Boolean)

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

  if (newSubs.length > 0) {
    const { error } = await supabase.from('student_subscriptions').insert(newSubs)
    if (error) throw new Error(error.message)
  }

  await syncGroupSubjectRows(
    studentId,
    newSubs
      .filter((sub) => sub.group_id && sub.subject_id)
      .map((sub) => ({ student_id: studentId, group_id: sub.group_id, subject_id: sub.subject_id }))
  )
}

export async function syncGroupSelections(studentId, form, catalog) {
  const selections = form.groupSelections || []

  const groupSubjectRows = []
  for (const sel of selections) {
    for (const name of sel.subjectNames) {
      const subject = catalog.subjectsByName?.[name]
      if (!subject) continue
      groupSubjectRows.push({ student_id: studentId, group_id: sel.groupId, subject_id: subject.id })
    }
  }

  const newGroupIds = [...new Set(selections.map((sel) => sel.groupId))]
  const { data: gsExisting } = await supabase
    .from('group_students')
    .select('group_id')
    .eq('student_id', studentId)
  const oldGroupIds = new Set((gsExisting || []).map((r) => r.group_id))
  for (const groupId of oldGroupIds) {
    if (!newGroupIds.includes(groupId)) {
      const { error } = await supabase
        .from('group_students')
        .delete()
        .eq('student_id', studentId)
        .eq('group_id', groupId)
      if (error) throw new Error(error.message)
    }
  }
  for (const groupId of newGroupIds) {
    if (!oldGroupIds.has(groupId)) {
      const { error } = await supabase
        .from('group_students')
        .insert({ student_id: studentId, group_id: groupId })
      if (error) throw new Error(error.message)
    }
  }

  await syncGroupSubjectRows(studentId, groupSubjectRows)

  const { error: delError } = await supabase
    .from('student_subscriptions')
    .delete()
    .eq('student_id', studentId)
  if (delError) throw new Error(delError.message)

  const newSubs = form.chosen.map((name) => ({ student_id: studentId, ...subjectDetailsFor(form, catalog, name) }))
  if (newSubs.length > 0) {
    const { error } = await supabase.from('student_subscriptions').insert(newSubs)
    if (error) throw new Error(error.message)
  }
}

async function resolveCycleId(form, catalog) {
  const level = catalog.levelByName[form.level]
  if (!level) return null
  if (level.cycle_id) {
    const cycle = catalog.cycleById?.[level.cycle_id]
    return cycle?.id || level.cycle_id
  }
  const { data, error } = await supabase
    .from('levels')
    .select('cycle_id')
    .eq('id', level.id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data?.cycle_id || null
}

export function computeDuMois(form, catalog) {
  // Au forfait le prix couvre le niveau entier : il ne se cumule pas par matière.
  if (isPackageLevel(catalog, form.level)) return packageAmount(form, catalog)
  return (form.chosen || []).reduce((sum, name) => {
    const price = subjectDetailsFor(form, catalog, name).monthly_price
    return sum + (Number.isFinite(price) ? price : 0)
  }, 0)
}

function studentPayload(form, catalog, filiereId, cycleId, status = 'active') {
  const level = catalog.levelByName[form.level]
  return {
    branch_id: form.branch_id || catalog.defaultBranchId,
    first_name: form.firstName,
    last_name: form.lastName,
    cycle_id: cycleId,
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
    du_mois: computeDuMois(form, catalog),
    status,
  }
}

export async function createEnrollment(form, catalog) {
  let filiereId = null
  const level = catalog.levelByName[form.level]
  if (form.track && level?.id) filiereId = await ensureFiliere(level.id, form.track)
  const cycleId = await resolveCycleId(form, catalog)

  const { data, error } = await supabase
    .from('students')
    .insert(studentPayload(form, catalog, filiereId, cycleId))
    .select('id')
    .single()
  if (error) throw new Error(error.message)

  await syncGroupSelections(data.id, form, catalog)

  let photoUrl = null
  if (form.photoFile) {
    photoUrl = await uploadImage({ entity: 'students', id: data.id, file: form.photoFile })
    if (photoUrl) {
      const { error: photoError } = await supabase
        .from('students')
        .update({ photo_url: photoUrl })
        .eq('id', data.id)
      if (photoError) throw new Error(photoError.message)
    }
  }

  return { id: data.id, photoUrl }
}

export async function updateEnrollment(studentId, form, catalog, status = 'active') {
  let filiereId = null
  const level = catalog.levelByName[form.level]
  if (form.track && level?.id) filiereId = await ensureFiliere(level.id, form.track)
  const cycleId = await resolveCycleId(form, catalog)

  const { error } = await supabase
    .from('students')
    .update(studentPayload(form, catalog, filiereId, cycleId, status))
    .eq('id', studentId)
  if (error) throw new Error(error.message)

  await syncGroupSelections(studentId, form, catalog)

  if (form.photoFile) {
    const photoUrl = await uploadImage({ entity: 'students', id: studentId, file: form.photoFile })
    if (photoUrl) {
      const { error: photoError } = await supabase
        .from('students')
        .update({ photo_url: photoUrl })
        .eq('id', studentId)
      if (photoError) throw new Error(photoError.message)
    }
  }

  return { id: studentId }
}

export async function setStudentStatus(studentId, status) {
  const { error } = await supabase.from('students').update({ status }).eq('id', studentId)
  if (error) throw new Error(error.message)
}

async function setAllStudentsStatus(status, branchId = null) {
  let query = supabase.from('students').update({ status }).neq('status', status)
  if (branchId && branchId !== 'all') query = query.eq('branch_id', branchId)
  const { error } = await query
  if (error) throw new Error(error.message)
}

export async function deactivateAllStudents(branchId = null) {
  await setAllStudentsStatus('inactive', branchId)
}

export async function reactivateAllStudents(branchId = null) {
  await setAllStudentsStatus('active', branchId)
}

export async function fetchStudents(branchId = null) {
  let query = supabase
    .from('students')
    .select('*, branches(name), levels(name, cycle_id, fixed_price, cycles(name, has_fixed_price)), cycles(name), study_branches(name)')
    .order('created_at', { ascending: false })
  if (branchId && branchId !== 'all') query = query.eq('branch_id', branchId)

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const { data: subs, error: subsError } = await supabase
    .from('student_subscriptions')
    .select('student_id, subject_id, teacher_id, group_id, pricing_type, monthly_price, subjects(name), teachers(first_name,last_name), groups(name, filiere_id)')
  if (subsError) throw new Error(subsError.message)

  const { data: filieres, error: filieresError } = await supabase
    .from('study_branches')
    .select('id, name')
  if (filieresError) throw new Error(filieresError.message)
  const filiereNameById = Object.fromEntries((filieres || []).map((f) => [f.id, f.name]))

  const subsByStudent = {}
  for (const sub of subs || []) {
    if (!subsByStudent[sub.student_id]) subsByStudent[sub.student_id] = []
    subsByStudent[sub.student_id].push(sub)
  }

  return (data || []).map((s) => {
    const list = subsByStudent[s.id] || []
    const chosen = list.map((x) => x.subjects?.name).filter(Boolean)
    const subjectDetails = {}
    const groupSelections = []
    let groupFiliere = ''
    for (const x of list) {
      const subjectName = x.subjects?.name
      if (subjectName) {
        subjectDetails[subjectName] = {
          teacher: x.teachers ? `${x.teachers.first_name} ${x.teachers.last_name}` : '',
          group: x.groups?.name || '',
          priceType: x.pricing_type,
          manualPrice: x.pricing_type === 'manual' ? Number(x.monthly_price) : undefined,
        }
      }
      if (!x.group_id) continue
      if (!groupFiliere) groupFiliere = filiereNameById[x.groups?.filiere_id] || ''
      let entry = groupSelections.find((g) => g.groupId === x.group_id)
      if (!entry) {
        entry = { groupId: x.group_id, groupName: x.groups?.name || '', subjectIds: [], subjectNames: [] }
        groupSelections.push(entry)
      }
      if (x.subject_id && !entry.subjectIds.includes(x.subject_id)) entry.subjectIds.push(x.subject_id)
      if (subjectName && !entry.subjectNames.includes(subjectName)) entry.subjectNames.push(subjectName)
    }
    return {
      id: s.id,
      name: `${s.first_name} ${s.last_name}`.trim(),
      code: s.registration_number,
      photoUrl: s.photo_url || '',
      cycle: s.cycles?.name || s.levels?.cycles?.name || '',
      level: s.levels?.name || '',
      track: s.study_branches?.name || '',
      branch: s.branches?.name || '',
      subjects: list.length,
      // Au forfait le dû mensuel ne se déduit pas des matières : il est porté
      // par l'élève, et une valeur différente du prix du niveau est une remise.
      isPackage: Boolean(s.levels?.cycles?.has_fixed_price),
      packagePrice: s.levels?.fixed_price != null ? Number(s.levels.fixed_price) : 0,
      du_mois: Number(s.du_mois) || 0,
      payment: 'N/A',
      active: s.status === 'active',
      status: s.status,
      phone: s.phone1 || '',
      phone2: s.phone2 || '',
      registrationDate: s.registration_date || '',
      address: s.address || '',
      school: s.school_origin || '',
      schoolClass: s.class_in_school || '',
      alerts: s.medical_notes || '',
      chosen,
      subjectDetails,
      groupSelections,
      groupFiliere,
      cycle_id: s.cycle_id,
      level_id: s.level_id,
      filiere_id: s.filiere_id,
      branch_id: s.branch_id,
    }
  })
}
