import { supabase } from '../../supabaseClient'

// Les formations vivent à côté de la structure académique : elles ne passent ni
// par cycles/levels, ni par subjects/tariffs. Le prix est porté par le NIVEAU de
// formation, pas par la formation elle-même.

// Prix mensuel retenu pour une ligne du formulaire d'inscription. Le prix
// standard est figé dans la ligne au moment de la sélection : pas besoin du
// catalogue ici, et une révision ultérieure du tarif ne réécrit pas les
// inscriptions déjà enregistrées.
export function formationRowPrice(row) {
  if (row?.priceType === 'manual') {
    const manual = Number(row.manualPrice)
    return Number.isFinite(manual) && manual >= 0 ? manual : 0
  }
  return Number(row?.standardPrice || 0)
}

export function formationsTotal(rows) {
  return (rows || []).reduce((sum, row) => sum + formationRowPrice(row), 0)
}

export function formationLevelLabel(level) {
  if (!level) return ''
  const formationName = level.formation?.name || level.formationName || ''
  return formationName ? `${formationName} · ${level.name}` : level.name
}

export async function fetchFormationCatalog() {
  const [formationsRes, levelsRes, groupsRes, teachersRes] = await Promise.all([
    supabase.from('formations').select('id, name, description, status').order('name'),
    supabase
      .from('formation_levels')
      .select('id, formation_id, name, price, position')
      .order('position')
      .order('name'),
    supabase.from('groups').select('id, name, formation_level_id, teacher_id, capacity, status'),
    supabase.from('teachers').select('id, first_name, last_name').order('first_name'),
  ])

  const firstError = [formationsRes, levelsRes, groupsRes, teachersRes].find((r) => r.error)
  if (firstError) throw new Error(firstError.error.message)

  const formations = formationsRes.data || []
  const formationsById = Object.fromEntries(formations.map((f) => [f.id, f]))

  const levels = (levelsRes.data || []).map((level) => ({
    ...level,
    price: Number(level.price || 0),
    formationName: formationsById[level.formation_id]?.name || '',
  }))
  const levelsById = Object.fromEntries(levels.map((level) => [level.id, level]))

  const levelsByFormation = {}
  for (const level of levels) {
    if (!levelsByFormation[level.formation_id]) levelsByFormation[level.formation_id] = []
    levelsByFormation[level.formation_id].push(level)
  }

  // Seuls les groupes rattachés à un niveau de formation nous intéressent : les
  // groupes scolaires restent la propriété de la page Groupes.
  const groupsByLevel = {}
  for (const group of groupsRes.data || []) {
    if (!group.formation_level_id) continue
    if (!groupsByLevel[group.formation_level_id]) groupsByLevel[group.formation_level_id] = []
    groupsByLevel[group.formation_level_id].push(group)
  }
  for (const key of Object.keys(groupsByLevel)) {
    groupsByLevel[key].sort((a, b) => a.name.localeCompare(b.name, 'fr'))
  }

  const teachers = (teachersRes.data || []).map((t) => ({
    id: t.id,
    name: `${t.first_name || ''} ${t.last_name || ''}`.trim(),
  }))

  return {
    formations,
    formationsById,
    levels,
    levelsById,
    levelsByFormation,
    groupsByLevel,
    teachers,
    teachersById: Object.fromEntries(teachers.map((t) => [t.id, t])),
  }
}

// ---------------------------------------------------------------------------
// Catalogue : formations et niveaux
// ---------------------------------------------------------------------------

export async function saveFormation({ id, name, description = null, status = 'active' }) {
  const payload = { name: String(name || '').trim(), description, status }
  if (!payload.name) throw new Error('Le nom de la formation est obligatoire.')
  const query = id
    ? supabase.from('formations').update(payload).eq('id', id)
    : supabase.from('formations').insert(payload)
  const { error } = await query
  if (error) throw new Error(error.message)
}

export async function deleteFormation(id) {
  const { error } = await supabase.from('formations').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function saveFormationLevel({ id, formationId, name, price, position = 0 }) {
  const amount = Number(price)
  const payload = {
    formation_id: formationId,
    name: String(name || '').trim(),
    price: Number.isFinite(amount) && amount >= 0 ? amount : 0,
    position: Number(position) || 0,
  }
  if (!payload.name) throw new Error('Le nom du niveau est obligatoire.')
  const query = id
    ? supabase.from('formation_levels').update(payload).eq('id', id)
    : supabase.from('formation_levels').insert(payload)
  const { error } = await query
  if (error) throw new Error(error.message)
}

export async function deleteFormationLevel(id) {
  const { error } = await supabase.from('formation_levels').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// ---------------------------------------------------------------------------
// Inscriptions d'un élève
// ---------------------------------------------------------------------------

export async function fetchStudentFormations(studentId) {
  if (!studentId) return []
  const { data, error } = await supabase
    .from('student_formations')
    .select('id, formation_level_id, group_id, teacher_id, pricing_type, monthly_price, enrolled_at, status')
    .eq('student_id', studentId)
  if (error) throw new Error(error.message)
  return data || []
}

// Le formulaire d'inscription manipule une liste de lignes ; on la réconcilie
// avec la base plutôt que de tout supprimer et réinsérer, sinon les paiements
// déjà encaissés (rattachés à student_formations.id) partiraient en cascade.
export async function syncStudentFormations(studentId, rows, { enrolledAt } = {}) {
  const existing = await fetchStudentFormations(studentId)
  const existingByLevel = new Map(existing.map((row) => [row.formation_level_id, row]))
  const keptLevelIds = new Set()

  for (const row of rows || []) {
    if (!row.formationLevelId) continue
    keptLevelIds.add(row.formationLevelId)
    const price = Number(row.monthlyPrice)
    const payload = {
      student_id: studentId,
      formation_level_id: row.formationLevelId,
      group_id: row.groupId || null,
      teacher_id: row.teacherId || null,
      pricing_type: row.priceType === 'manual' ? 'manual' : 'standard',
      monthly_price: Number.isFinite(price) && price >= 0 ? price : 0,
      status: 'active',
    }
    const current = existingByLevel.get(row.formationLevelId)
    if (current) {
      const { error } = await supabase.from('student_formations').update(payload).eq('id', current.id)
      if (error) throw new Error(error.message)
    } else {
      // enrolled_at ancre l'échéance mensuelle : inscrit le 12, il paie le 12.
      if (enrolledAt) payload.enrolled_at = enrolledAt
      const { error } = await supabase.from('student_formations').insert(payload)
      if (error) throw new Error(error.message)
    }
  }

  for (const row of existing) {
    if (keptLevelIds.has(row.formation_level_id)) continue
    const { error } = await supabase.from('student_formations').delete().eq('id', row.id)
    if (error) throw new Error(error.message)
  }

  // Le groupe de formation suit la même table que les groupes scolaires : on
  // aligne group_students pour que le pointage et les effectifs soient justes.
  await syncFormationGroupMemberships(studentId, rows || [], existing)
}

async function syncFormationGroupMemberships(studentId, rows, previous) {
  const wanted = new Set((rows || []).map((row) => row.groupId).filter(Boolean))
  const before = new Set((previous || []).map((row) => row.group_id).filter(Boolean))

  for (const groupId of before) {
    if (wanted.has(groupId)) continue
    const { error } = await supabase
      .from('group_students')
      .delete()
      .eq('student_id', studentId)
      .eq('group_id', groupId)
    if (error) throw new Error(error.message)
  }

  if (wanted.size === 0) return

  // group_students n'a pas d'index unique (group_id, student_id) : un upsert
  // serait refusé par PostgreSQL. On relit donc l'appartenance réelle avant
  // d'insérer, comme le fait déjà syncGroupSelections côté scolarité.
  const { data: current, error: readError } = await supabase
    .from('group_students')
    .select('group_id')
    .eq('student_id', studentId)
  if (readError) throw new Error(readError.message)
  const alreadyIn = new Set((current || []).map((row) => row.group_id))

  const toAdd = [...wanted].filter((groupId) => !alreadyIn.has(groupId))
  if (toAdd.length === 0) return
  const { error } = await supabase
    .from('group_students')
    .insert(toAdd.map((group_id) => ({ student_id: studentId, group_id })))
  if (error) throw new Error(error.message)
}

// ---------------------------------------------------------------------------
// Calendrier de paiement des formations
// ---------------------------------------------------------------------------

export async function fetchFormationFeesData(branchId = null) {
  const [enrollmentsRes, paymentsRes, catalog] = await Promise.all([
    supabase
      .from('student_formations')
      .select(
        'id, student_id, formation_level_id, group_id, teacher_id, pricing_type, monthly_price, enrolled_at, status, ' +
          // level_id sert à distinguer l'élève « formation seule » de celui qui
        // suit aussi un cursus : les frais d'inscription se règlent sur le
        // calendrier de scolarité pour le second, ici pour le premier.
        'students!inner(id, first_name, last_name, registration_number, registration_date, created_at, phone1, status, branch_id, level_id, photo_url)'
      ),
    supabase
      .from('formation_payments')
      .select('id, student_formation_id, month, amount, status, paid_at, paid_by')
      .order('month'),
    fetchFormationCatalog(),
  ])

  const firstError = [enrollmentsRes, paymentsRes].find((r) => r.error)
  if (firstError) throw new Error(firstError.error.message)

  const rows = (enrollmentsRes.data || [])
    .filter((row) => {
      if (!row.students) return false
      if (branchId && branchId !== 'all') return row.students.branch_id === branchId
      return true
    })
    .map((row) => {
      const level = catalog.levelsById[row.formation_level_id]
      const group = (catalog.groupsByLevel[row.formation_level_id] || []).find((g) => g.id === row.group_id)
      const student = row.students
      return {
        id: row.id,
        studentId: row.student_id,
        studentName: `${student.first_name || ''} ${student.last_name || ''}`.trim(),
        code: student.registration_number || '',
        phone: student.phone1 || '',
        photoUrl: student.photo_url || '',
        studentActive: student.status === 'active',
        branchId: student.branch_id,
        // Sans niveau scolaire, l'élève ne figure pas au calendrier de
        // scolarité : c'est ici qu'il doit régler ses frais d'inscription.
        formationOnly: !student.level_id,
        formationName: level?.formationName || '',
        levelName: level?.name || '',
        formationLevelId: row.formation_level_id,
        groupName: group?.name || '',
        teacherId: row.teacher_id || group?.teacher_id || null,
        monthlyPrice: Number(row.monthly_price || 0),
        pricingType: row.pricing_type || 'standard',
        // L'échéance suit la date d'inscription À LA FORMATION, qui n'a aucune
        // raison de coïncider avec l'inscription scolaire.
        enrolledAt: row.enrolled_at || (student.created_at || '').slice(0, 10),
        active: row.status === 'active' && student.status === 'active',
      }
    })
    .sort((a, b) => a.studentName.localeCompare(b.studentName, 'fr'))

  const paymentsByEnrollment = {}
  for (const payment of paymentsRes.data || []) {
    const key = payment.student_formation_id
    if (!paymentsByEnrollment[key]) paymentsByEnrollment[key] = []
    paymentsByEnrollment[key].push({
      id: payment.id,
      month: String(payment.month || '').slice(0, 7) + '-01',
      amount: Number(payment.amount || 0),
      status: payment.status || 'paid',
      paid_at: payment.paid_at,
      paid_by: payment.paid_by,
    })
  }

  return { rows, paymentsByEnrollment, payments: paymentsRes.data || [], catalog }
}

// Recettes de formation normalisées au format des mensualités de scolarité
// ({ student_id, amount, status, month }), pour que le Bénéfice net, le Dashboard
// et les rapports puissent les additionner sans rien savoir des formations.
//
// Le rattachement suit `month` (le mois couvert) et non paid_at, exactement comme
// student_payments : une avance de trois mois se répartit sur les trois mois.
//
// Tolérant à l'absence de la table : tant que la migration 031 n'est pas passée,
// on renvoie une liste vide plutôt que de casser les écrans financiers.
export async function fetchFormationRevenue() {
  const { data, error } = await supabase
    .from('formation_payments')
    .select('amount, status, month, paid_at, student_formations!inner(student_id)')
    .eq('status', 'paid')
  if (error) {
    console.error(error)
    return []
  }
  return (data || [])
    .filter((row) => row.student_formations?.student_id)
    .map((row) => ({
      student_id: row.student_formations.student_id,
      amount: Number(row.amount || 0),
      status: 'paid',
      month: `${String(row.month || '').slice(0, 7)}-01`,
      paid_at: row.paid_at,
      source: 'formation',
    }))
}

export async function recordFormationPayment({ enrollmentId, month, amount, userId = null }) {
  const { data, error } = await supabase
    .from('formation_payments')
    .upsert(
      {
        student_formation_id: enrollmentId,
        month,
        amount: Number(amount) || 0,
        status: 'paid',
        paid_at: new Date().toISOString(),
        paid_by: userId,
      },
      { onConflict: 'student_formation_id,month' }
    )
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function cancelFormationPayment(paymentId) {
  const { error } = await supabase.from('formation_payments').delete().eq('id', paymentId)
  if (error) throw new Error(error.message)
}
