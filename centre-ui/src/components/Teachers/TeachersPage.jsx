import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import Header from '../shared/Header'
import TeacherForm from './TeacherForm'
import TeachersToolbar from './TeachersToolbar'
import TeachersFilters from './TeachersFilters'
import TeachersTable from './TeachersTable'
import TeacherProfile from './TeacherProfile'
import { supabase } from '../../supabaseClient'
import { uploadImage } from '../../utils/storage'
import { invalidateFeesCache } from '../Accounting/feesApi'
import './Teachers.css'

function Toast({ notice }) {
  if (!notice) return null
  return (
    <div className={`teacher-toast is-${notice.type}`} role="status">
      <span>{notice.type === 'success' ? '✓' : '✕'}</span>
      {notice.text}
    </div>
  )
}

// Un professeur n'appartient a aucune succursale : il peut enseigner dans
// plusieurs cycles et dans plusieurs succursales a la fois. La liste est donc
// toujours celle du centre entier, quelle que soit la succursale affichee.
async function fetchTeachersData() {
  const teachersQuery = supabase.from('teachers').select('*').order('created_at', { ascending: false })
  const [teachersRes, subjectsRes, levelsRes, branchesRes, cyclesRes, tlsRes, tbRes, tlRes, tgRes, tgnRes, groupsRes] = await Promise.all([
    teachersQuery,
    supabase.from('subjects').select('id, name'),
    supabase.from('levels').select('id, name, cycle_id'),
    supabase.from('branches').select('id, name'),
    supabase.from('cycles').select('id, name'),
    // Matière ET niveau ensemble : teacher_subjects seule ne dit jamais à
    // quel niveau une matière est enseignée (voir migration 037).
    supabase.from('teacher_level_subjects').select('teacher_id, level_id, subject_id'),
    supabase.from('teacher_branches').select('teacher_id, branch_id'),
    supabase.from('teacher_levels').select('teacher_id, level_id'),
    supabase.from('teacher_group_subjects').select('teacher_id, group_id, subject_id'),
    supabase.from('teacher_groups').select('teacher_id, group_id'),
    supabase.from('groups').select('id, name').order('name'),
  ])
  if (!teachersRes.data) return []
  const subjectMap = Object.fromEntries((subjectsRes.data || []).map((s) => [s.id, s.name]))
  const levelMap = Object.fromEntries((levelsRes.data || []).map((l) => [l.id, l.name]))
  const branchMap = Object.fromEntries((branchesRes.data || []).map((b) => [b.id, b.name]))
  const cycleMap = Object.fromEntries((cyclesRes.data || []).map((c) => [c.id, c.name]))
  const groupMap = Object.fromEntries((groupsRes.data || []).map((g) => [g.id, g.name]))
  // Par niveau (form.levelSubjects) et sa version à plat (affichage "aperçu"
  // dans le tableau et la fiche, inchangés — ils listaient déjà juste des noms).
  const levelSubjectsByTeacher = {}
  const subjectsByTeacher = {}
  for (const row of tlsRes.data || []) {
    if (!levelSubjectsByTeacher[row.teacher_id]) levelSubjectsByTeacher[row.teacher_id] = {}
    if (!levelSubjectsByTeacher[row.teacher_id][row.level_id]) levelSubjectsByTeacher[row.teacher_id][row.level_id] = []
    levelSubjectsByTeacher[row.teacher_id][row.level_id].push(row.subject_id)
    const flat = subjectsByTeacher[row.teacher_id] || []
    if (!flat.includes(row.subject_id)) subjectsByTeacher[row.teacher_id] = [...flat, row.subject_id]
  }
  const branchesByTeacher = {}
  for (const row of tbRes.data || []) {
    branchesByTeacher[row.teacher_id] = [...(branchesByTeacher[row.teacher_id] || []), row.branch_id]
  }
  const levelsByTeacher = {}
  for (const row of tlRes.data || []) {
    levelsByTeacher[row.teacher_id] = [...(levelsByTeacher[row.teacher_id] || []), row.level_id]
  }
  const assignmentsByTeacher = {}
  for (const row of tgRes.data || []) {
    if (!assignmentsByTeacher[row.teacher_id]) assignmentsByTeacher[row.teacher_id] = {}
    if (!assignmentsByTeacher[row.teacher_id][row.group_id]) {
      assignmentsByTeacher[row.teacher_id][row.group_id] = { group_id: row.group_id, subject_ids: [] }
    }
    assignmentsByTeacher[row.teacher_id][row.group_id].subject_ids.push(row.subject_id)
  }
  // Cycles au forfait : affectation au groupe entier, donc sans matière.
  for (const row of tgnRes.data || []) {
    if (!assignmentsByTeacher[row.teacher_id]) assignmentsByTeacher[row.teacher_id] = {}
    if (!assignmentsByTeacher[row.teacher_id][row.group_id]) {
      assignmentsByTeacher[row.teacher_id][row.group_id] = { group_id: row.group_id, subject_ids: [] }
    }
  }
  return teachersRes.data.map((t) => {
    const subjectIds = subjectsByTeacher[t.id] || []
    const branchIds = branchesByTeacher[t.id] || []
    const levelIds = levelsByTeacher[t.id] || []
    const groupAssignments = Object.values(assignmentsByTeacher[t.id] || {})
    const cycleIds = t.cycle_ids || []
    const cycleRates = t.cycle_rates || {}
    return {
      id: t.id,
      firstName: t.first_name,
      lastName: t.last_name,
      cin: t.cin || '',
      phone: t.phone || '',
      address: t.address || '',
      hiredAt: t.hire_date || '',
      photoUrl: t.photo_url || '',
      status: t.status,
      active: t.status === 'active',
      paymentType: t.remuneration_type,
      salary: t.remuneration_type === 'fixe' ? String(t.remuneration_amount ?? '') : '',
      remuneration_amount: t.remuneration_amount,
      fixed_salary: t.fixed_salary ?? (t.remuneration_type === 'fixe' ? t.remuneration_amount : ''),
      cycle_ids: cycleIds,
      cycle_rates: cycleRates,
      rates: cycleRates,
      subject_ids: subjectIds,
      level_subjects: levelSubjectsByTeacher[t.id] || {},
      branch_ids: branchIds,
      level_ids: levelIds,
      group_assignments: groupAssignments,
      groups: groupAssignments.map((a) => a.group_id),
      assigned_groups: groupAssignments.map((a) => a.group_id),
      group_names: groupAssignments.map((a) => groupMap[a.group_id]).filter(Boolean),
      branch_id: t.branch_id,
      subjects: subjectIds.map((id) => subjectMap[id]).filter(Boolean),
      branches: branchIds.map((id) => branchMap[id]).filter(Boolean),
      levels: levelIds.map((id) => levelMap[id]).filter(Boolean),
      cycles: cycleIds.map((id) => ({ id, name: cycleMap[id] })).filter((c) => c.name),
    }
  })
}

export default function TeachersPage() {
  const location = useLocation()
  const [teachers, setTeachers] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState(location.state?.query || '')
  const [formTeacher, setFormTeacher] = useState(undefined) // undefined: list, null: new, object: edit
  const [selectedTeacher, setSelectedTeacher] = useState(null)
  const [notice, setNotice] = useState(null)
  // Professeur à ouvrir dès la liste chargée (arrivée depuis la recherche du bandeau).
  const [pendingFocusId, setPendingFocusId] = useState(location.state?.focusTeacherId || null)
  const [consumedNavKey, setConsumedNavKey] = useState(null)

  // Terme et professeur transmis par la recherche du bandeau, appliqués pendant
  // le rendu (motif React d'ajustement d'état) plutôt que dans un effet : la
  // liste s'affiche déjà filtrée. `location.key` change à chaque navigation,
  // la même recherche peut donc être relancée.
  const navSearch = location.state?.query
  const navFocusId = location.state?.focusTeacherId
  if (consumedNavKey !== location.key && (typeof navSearch === 'string' || navFocusId)) {
    setConsumedNavKey(location.key)
    if (typeof navSearch === 'string') setQuery(navSearch)
    setPendingFocusId(navFocusId || null)
  }

  useEffect(() => {
    let cancelled = false
    fetchTeachersData()
      .then((mapped) => { if (!cancelled) setTeachers(mapped) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const refreshTeachers = async () => {
    setLoading(true)
    setTeachers(await fetchTeachersData())
    setLoading(false)
  }

  const filteredTeachers = useMemo(
    () =>
      teachers.filter((teacher) =>
        // Téléphone et CIN inclus : la recherche du bandeau les accepte aussi,
        // la liste doit donc pouvoir se filtrer sur le même terme.
        `${teacher.firstName} ${teacher.lastName} ${teacher.phone} ${teacher.cin}`
          .toLowerCase()
          .includes(query.toLowerCase())
      ),
    [teachers, query]
  )

  // Fiche affichée : celle ouverte depuis le tableau, sinon celle demandée par
  // la recherche du bandeau une fois la liste chargée.
  const focusedTeacher =
    !selectedTeacher && pendingFocusId && !loading
      ? teachers.find((teacher) => teacher.id === pendingFocusId) || null
      : null
  const openTeacher = selectedTeacher || focusedTeacher

  const closeProfile = () => {
    setSelectedTeacher(null)
    setPendingFocusId(null)
  }

  const junctionColumn = {
    teacher_levels: 'level_id',
  }

  // teacher_level_subjects a deux colonnes variables (niveau ET matière) :
  // le diff se fait sur la paire, pas sur une seule colonne comme syncJunction.
  async function syncTeacherLevelSubjects(teacherId, currentPairs, levelSubjects) {
    const key = (levelId, subjectId) => `${levelId}:${subjectId}`
    const current = new Set(currentPairs.map((p) => key(p.level_id, p.subject_id)))
    const next = new Set()
    for (const [levelId, subjectIds] of Object.entries(levelSubjects || {})) {
      for (const subjectId of subjectIds) next.add(key(levelId, subjectId))
    }

    for (const pairKey of current) {
      if (next.has(pairKey)) continue
      const [level_id, subject_id] = pairKey.split(':')
      const { error } = await supabase
        .from('teacher_level_subjects')
        .delete()
        .eq('teacher_id', teacherId)
        .eq('level_id', level_id)
        .eq('subject_id', subject_id)
      if (error) throw new Error(error.message)
    }

    const toAdd = []
    for (const pairKey of next) {
      if (current.has(pairKey)) continue
      const [level_id, subject_id] = pairKey.split(':')
      toAdd.push({ teacher_id: teacherId, level_id, subject_id })
    }
    if (toAdd.length > 0) {
      const { error } = await supabase.from('teacher_level_subjects').insert(toAdd)
      if (error) throw new Error(error.message)
    }
  }

  async function syncJunction(teacherId, table, currentIds, newIds) {
    const column = junctionColumn[table]
    const toRemove = currentIds.filter((id) => !newIds.includes(id))
    const toAdd = newIds.filter((id) => !currentIds.includes(id))
    if (toRemove.length > 0) {
      const { error } = await supabase.from(table).delete().eq('teacher_id', teacherId).in(column, toRemove)
      if (error) throw new Error(error.message)
    }
    if (toAdd.length > 0) {
      const { error } = await supabase.from(table).insert(
        toAdd.map((id) => ({ teacher_id: teacherId, [column]: id }))
      )
      if (error) throw new Error(error.message)
    }
  }

  // Affectations sans matière (cycles au forfait) : le lien s'arrête au groupe.
  async function syncTeacherGroups(teacherId, newGroupIds) {
    const { data, error } = await supabase
      .from('teacher_groups')
      .select('group_id')
      .eq('teacher_id', teacherId)
    if (error) throw new Error(error.message)
    const currentIds = (data || []).map((row) => row.group_id)
    const toRemove = currentIds.filter((id) => !newGroupIds.includes(id))
    const toAdd = newGroupIds.filter((id) => !currentIds.includes(id))
    if (toRemove.length > 0) {
      const { error: removeError } = await supabase
        .from('teacher_groups')
        .delete()
        .eq('teacher_id', teacherId)
        .in('group_id', toRemove)
      if (removeError) throw new Error(removeError.message)
    }
    if (toAdd.length > 0) {
      const { error: addError } = await supabase
        .from('teacher_groups')
        .insert(toAdd.map((group_id) => ({ teacher_id: teacherId, group_id })))
      if (addError) throw new Error(addError.message)
    }
  }

  async function syncTeacherGroupSubjects(teacherId, currentAssignments, newAssignments) {
    const keys = (assignments) => {
      const set = new Set()
      for (const a of assignments) {
        for (const subjectId of a.subject_ids || []) {
          set.add(`${a.group_id}:${subjectId}`)
        }
      }
      return set
    }
    const current = keys(currentAssignments)
    const next = keys(newAssignments)

    for (const key of current) {
      if (next.has(key)) continue
      const [group_id, subject_id] = key.split(':')
      const { error } = await supabase
        .from('teacher_group_subjects')
        .delete()
        .eq('teacher_id', teacherId)
        .eq('group_id', group_id)
        .eq('subject_id', subject_id)
      if (error) throw new Error(error.message)
    }

    const toAdd = []
    for (const key of next) {
      if (current.has(key)) continue
      const [group_id, subject_id] = key.split(':')
      toAdd.push({ teacher_id: teacherId, group_id, subject_id })
    }
    if (toAdd.length > 0) {
      const { error } = await supabase.from('teacher_group_subjects').insert(toAdd)
      if (error) throw new Error(error.message)
    }
  }

  async function saveTeacher(form, editing) {
    const fixedSalary = form.fixed_salary === '' || form.fixed_salary == null ? null : Number(form.fixed_salary)
    const payload = {
      first_name: form.first_name,
      last_name: form.last_name,
      cin: form.cin,
      phone: form.phone,
      address: form.address,
      hire_date: form.hire_date,
      photo_url: form.photo_url,
      status: form.active ? 'active' : 'inactive',
      remuneration_type: form.remuneration_type,
      remuneration_amount: form.remuneration_type === 'fixe' ? fixedSalary : null,
      fixed_salary: form.remuneration_type === 'fixe' ? fixedSalary : null,
      cycle_ids: form.cycles || [],
      cycle_rates: form.cycle_rates || {},
    }

    // Matières par niveau : { [level_id]: [subject_id, ...] }. La version à
    // plat ne sert plus qu'à alimenter un groupe sans matière propre
    // ci-dessous (elle mélangerait sinon les niveaux, comme avant ce correctif).
    const levelSubjects = form.levelSubjects || {}
    const levels = form.levels || []

    let teacherId = form.id
    if (editing) {
      const { error } = await supabase.from('teachers').update(payload).eq('id', teacherId)
      if (error) throw new Error(error.message)

      const [lsRes, lvRes] = await Promise.all([
        supabase.from('teacher_level_subjects').select('level_id, subject_id').eq('teacher_id', teacherId),
        supabase.from('teacher_levels').select('level_id').eq('teacher_id', teacherId),
      ])
      await syncTeacherLevelSubjects(teacherId, lsRes.data || [], levelSubjects)
      await syncJunction(
        teacherId,
        'teacher_levels',
        (lvRes.data || []).map((r) => r.level_id),
        levels
      )
    } else {
      const { data, error } = await supabase.from('teachers').insert(payload).select('id').single()
      if (error) throw new Error(error.message)
      teacherId = data.id
      await syncTeacherLevelSubjects(teacherId, [], levelSubjects)
      if (levels.length > 0) {
        await syncJunction(teacherId, 'teacher_levels', [], levels)
      }
    }

    const selectedGroups = []
    const groupIds = form.groups || []
    if (groupIds.length > 0) {
      const { data, error } = await supabase
        .from('groups')
        .select('id, subject_id, level_id, formation_level_id, levels(cycles(has_fixed_price))')
        .in('id', groupIds)
      if (error) throw new Error(error.message)
      selectedGroups.push(...(data || []))
    }
    // Sur un cycle au forfait le professeur enseigne tout le niveau : son
    // affectation se note dans teacher_groups, sans matière. Un groupe de
    // formation suit la même règle — il n'a aucune matière à rattacher.
    const isWholeGroup = (group) =>
      Boolean(group.levels?.cycles?.has_fixed_price) || Boolean(group.formation_level_id)
    const packageGroupIds = selectedGroups.filter(isWholeGroup).map((group) => group.id)
    const newAssignments = selectedGroups
      .filter((group) => !isWholeGroup(group))
      .map((group) => {
        // Un groupe dédié à une matière ne concerne que celle-là. Sinon le
        // professeur y enseigne les matières qu'on lui a cochées POUR LE
        // NIVEAU de ce groupe précisément : « 2 BAC ECO » accueille
        // COMPTA, ECONOMIE et ORGA avec le même professeur s'il enseigne
        // les trois en 2ème année — jamais celles qu'il n'enseigne qu'en
        // 1ère année.
        //
        // Avant ce correctif, une liste de matières à plat (sans niveau)
        // pouvait rattacher au groupe une matière que le professeur
        // n'enseigne qu'à un AUTRE niveau.
        const subjectIds = group.subject_id ? [group.subject_id] : (levelSubjects[group.level_id] || [])
        return { group_id: group.id, subject_ids: (subjectIds || []).filter(Boolean) }
      })

    await syncTeacherGroups(teacherId, packageGroupIds)

    const tgRes = await supabase
      .from('teacher_group_subjects')
      .select('group_id, subject_id')
      .eq('teacher_id', teacherId)
    if (tgRes.error) throw new Error(tgRes.error.message)
    await syncTeacherGroupSubjects(
      teacherId,
      (tgRes.data || []).reduce((acc, row) => {
        let entry = acc.find((a) => a.group_id === row.group_id)
        if (!entry) {
          entry = { group_id: row.group_id, subject_ids: [] }
          acc.push(entry)
        }
        entry.subject_ids.push(row.subject_id)
        return acc
      }, []),
      newAssignments
    )

    const { data: directGroups } = await supabase.from('groups').select('id').eq('teacher_id', teacherId)
    const staleIds = (directGroups || []).map((g) => g.id).filter((id) => !groupIds.includes(id))
    if (staleIds.length > 0) {
      await supabase.from('groups').update({ teacher_id: null }).in('id', staleIds)
    }
    if (groupIds.length > 0) {
      const { error: groupLinkError } = await supabase
        .from('groups')
        .update({ teacher_id: teacherId })
        .in('id', groupIds)
      if (groupLinkError) throw new Error(groupLinkError.message)
    }

    if (form.photoFile) {
      const photoUrl = await uploadImage({ entity: 'teachers', id: teacherId, file: form.photoFile })
      if (photoUrl) {
        const { error: photoError } = await supabase.from('teachers').update({ photo_url: photoUrl }).eq('id', teacherId)
        if (photoError) throw new Error(photoError.message)
      }
    }

    await refreshTeachers()
    // Un professeur porte son tarif : le modifier change les salaires, donc le
    // bénéfice net et le tableau de bord. Ce signal réveille les écrans abonnés
    // dans les autres onglets du même navigateur, qui sinon garderaient leur
    // copie jusqu'au prochain retour de focus.
    invalidateFeesCache()
    setFormTeacher(undefined)
    setNotice({
      type: 'success',
      text: editing ? 'Professeur modifié avec succès' : 'Professeur ajouté avec succès',
    })
  }

  const handleToggleStatus = async (teacherId) => {
    const teacher = teachers.find((item) => item.id === teacherId)
    if (!teacher) return
    const newStatus = teacher.active ? 'inactive' : 'active'
    const { error } = await supabase.from('teachers').update({ status: newStatus }).eq('id', teacherId)
    if (!error) {
      setTeachers((items) =>
        items.map((item) =>
          item.id === teacherId ? { ...item, active: newStatus === 'active', status: newStatus } : item
        )
      )
      // Désactiver un professeur le retire du calcul des salaires : même signal
      // que pour une modification.
      invalidateFeesCache()
    }
  }

  if (formTeacher !== undefined) {
    return (
      <TeacherForm
        teacher={formTeacher || null}
        onClose={() => setFormTeacher(undefined)}
        onSave={saveTeacher}
      />
    )
  }

  if (openTeacher) {
    return <TeacherProfile teacher={openTeacher} onBack={closeProfile} />
  }

  return (
    <div className="teachers-page">
      <Header />
      <main className="teachers-content">
        <TeachersToolbar
          count={teachers.length}
          onAdd={() => setFormTeacher(null)}
        />
        <TeachersFilters query={query} onQueryChange={setQuery} />
        {loading ? (
          <div className="teachers-loading">Chargement des professeurs...</div>
        ) : (
          <TeachersTable
            teachers={filteredTeachers}
            onEdit={setFormTeacher}
            onToggleStatus={handleToggleStatus}
            onView={setSelectedTeacher}
          />
        )}
      </main>
      <Toast notice={notice} />
    </div>
  )
}
