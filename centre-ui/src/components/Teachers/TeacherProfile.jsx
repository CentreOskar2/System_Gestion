import { useEffect, useState } from 'react'
import Header from '../shared/Header'
import Icon from '../Icon'
import { initials } from '../Students/utils/studentHelpers'
import { supabase } from '../../supabaseClient'

const formatAmount = (value) => `${Number(value || 0).toLocaleString('fr-FR')} DH`

const formatMonth = (date) => {
  if (!date) return '—'
  return new Intl.DateTimeFormat('fr-MA', { month: 'short', year: 'numeric' }).format(new Date(date))
}

const salaryStatus = {
  validated: { label: 'Validé', cls: 'valid' },
  paid: { label: 'Payé', cls: 'valid' },
  pending: { label: 'En attente', cls: 'pending' },
}

export default function TeacherProfile({ teacher, onBack }) {
  const [groups, setGroups] = useState(null)
  const [salaries, setSalaries] = useState(null)

  const fullName = `${teacher.firstName} ${teacher.lastName}`
  const fixedSalary = teacher.paymentType === 'fixe'
  const cycleRates = (teacher.cycles || [])
    .map((cycle) => ({ id: cycle.id, name: cycle.name, rate: Number(teacher.cycle_rates?.[cycle.id] ?? '') }))
    .filter((entry) => entry.rate > 0)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const teacherId = teacher.id
      const tgRes = await supabase
        .from('teacher_group_subjects')
        .select('group_id, subject_id')
        .eq('teacher_id', teacherId)
      if (cancelled) return

      const dirRes = await supabase
        .from('groups')
        .select('id')
        .eq('teacher_id', teacherId)
      if (cancelled) return

      const groupIds = [...new Set([
        ...(tgRes.data || []).map((r) => r.group_id),
        ...(dirRes.data || []).map((g) => g.id),
        ...(teacher.groups || teacher.assigned_groups || []),
      ].filter(Boolean))]

      const [subjectsRes, levelsRes, gsRes, salariesRes, groupsRes] = await Promise.all([
        supabase.from('subjects').select('id, name'),
        supabase.from('levels').select('id, name'),
        groupIds.length > 0
          ? supabase.from('group_students').select('group_id, student_id').in('group_id', groupIds)
          : Promise.resolve({ data: [] }),
        supabase
          .from('teacher_salaries')
          .select('id, month, amount, status')
          .eq('teacher_id', teacherId)
          .order('month', { ascending: false }),
        groupIds.length > 0
          ? supabase.from('groups').select('id, name, subject_id, level_id, capacity, status')
          : Promise.resolve({ data: [] }),
      ])
      if (cancelled) return

      const subjectMap = Object.fromEntries((subjectsRes.data || []).map((s) => [s.id, s.name]))
      const levelMap = Object.fromEntries((levelsRes.data || []).map((l) => [l.id, l.name]))
      const countByGroup = {}
      for (const row of gsRes.data || []) {
        countByGroup[row.group_id] = (countByGroup[row.group_id] || 0) + 1
      }

      const groupById = Object.fromEntries((groupsRes.data || []).map((g) => [g.id, g]))
      const subjectByGroup = {}
      for (const row of tgRes.data || []) {
        subjectByGroup[row.group_id] = row.subject_id
      }

      const grouped = {}
      for (const groupId of groupIds) {
        const group = groupById[groupId]
        if (!group || grouped[group.id]) continue
        const junctionSubject = subjectByGroup[group.id]
        grouped[group.id] = {
          id: group.id,
          name: group.name,
          subject: subjectMap[group.subject_id] || subjectMap[junctionSubject] || '—',
          level: levelMap[group.level_id] || '—',
          capacity: group.capacity,
          status: group.status,
          studentCount: countByGroup[group.id] || 0,
          subjects: [subjectMap[junctionSubject]].filter(Boolean),
        }
      }

      setGroups(Object.values(grouped))
      setSalaries((salariesRes.data || []).map((s) => s))
    }
    load()
    return () => { cancelled = true }
  }, [teacher.id, teacher.groups, teacher.assigned_groups])

  return (
    <div className="teacher-profile-page">
      <Header />
      <main className="teacher-profile-content">
        <button className="teacher-profile-back" onClick={onBack}>← Retour aux professeurs</button>
        <div className="teacher-profile-layout">
          <aside className="teacher-profile-summary">
            {teacher.photoUrl ? (
              <img className="teacher-profile-avatar-img" src={teacher.photoUrl} alt={fullName} />
            ) : (
              <div className="teacher-profile-avatar">{initials(fullName)}</div>
            )}
            <h1>{fullName}</h1>
            <span className={`teacher-status ${teacher.active ? 'active' : ''}`}>{teacher.active ? 'Actif' : 'Inactif'}</span>
            <div className="teacher-contact-list">
              <p><Icon name="id" /> {teacher.cin}</p>
              <p><Icon name="phone" /> {teacher.phone}</p>
              <p><Icon name="pin" /> {teacher.address || '—'}</p>
              <p><Icon name="calendar" /> Embauché le {teacher.hiredAt || '—'}</p>
            </div>
          </aside>
          <section className="teacher-profile-details">
            <article className="teacher-profile-card teacher-remuneration">
              <div>
                <h2>Rémunération</h2>
                {fixedSalary ? (
                  <>
                    <p>Salaire mensuel</p>
                    <strong>{formatAmount(teacher.fixed_salary)}</strong>
                  </>
                ) : cycleRates.length > 0 ? (
                  <>
                    <p>Taux par cycle</p>
                    <div className="teacher-cycle-rates">
                      {cycleRates.map((entry) => (
                        <span key={entry.id}>
                          <i className="subject-tag">{entry.name}</i>
                          <strong>{entry.rate} %</strong>
                        </span>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <p>Taux (pourcentage)</p>
                    <strong>—</strong>
                  </>
                )}
              </div>
              <span className={`pay-tag ${fixedSalary ? 'fixe' : 'pourcentage'}`}>
                {fixedSalary ? 'Fixe' : 'Pourcentage'}
              </span>
            </article>

            <article className="teacher-profile-card">
              <h2>Cycles, niveaux &amp; matières</h2>
              <div className="teacher-qualifications">
                <div>
                  <strong>Cycles</strong>
                  {teacher.cycles?.length ? (
                    <div className="teacher-tag-list">
                      {teacher.cycles.map((cycle) => (
                        <i className="subject-tag" key={cycle.id}>{cycle.name}</i>
                      ))}
                    </div>
                  ) : (
                    <p className="teacher-profile-empty">Aucun cycle assigné.</p>
                  )}
                </div>
                <div>
                  <strong>Niveaux</strong>
                  {teacher.levels?.length ? (
                    <div className="teacher-tag-list">
                      {teacher.levels.map((level) => (
                        <i className="subject-tag" key={level}>{level}</i>
                      ))}
                    </div>
                  ) : (
                    <p className="teacher-profile-empty">Aucun niveau assigné.</p>
                  )}
                </div>
                <div>
                  <strong>Matières</strong>
                  {teacher.subjects?.length ? (
                    <div className="teacher-tag-list">
                      {teacher.subjects.map((subject) => (
                        <i className="subject-tag" key={subject}>{subject}</i>
                      ))}
                    </div>
                  ) : (
                    <p className="teacher-profile-empty">Aucune matière assignée.</p>
                  )}
                </div>
              </div>
            </article>

            <article className="teacher-profile-card">
              <h2>Groupes assignés</h2>
              {groups === null ? (
                <p className="teacher-profile-empty">Chargement des groupes...</p>
              ) : groups.length === 0 ? (
                <p className="teacher-profile-empty">Aucun groupe assigné à ce professeur.</p>
              ) : (
                <div className="teacher-groups-grid">
                  {groups.map((group) => (
                    <div className="teacher-group-card" key={group.id}>
                      <strong>{group.name}</strong>
                      <span>{group.level} · {group.subject}</span>
                      {group.subjects.length > 0 && (
                        <div className="teacher-tag-list">
                          {group.subjects.map((subject) => (
                            <i className="subject-tag" key={subject}>{subject}</i>
                          ))}
                        </div>
                      )}
                      <small>{group.studentCount} élève{group.studentCount > 1 ? 's' : ''}</small>
                    </div>
                  ))}
                </div>
              )}
            </article>

            <article className="teacher-profile-card teacher-salary-history">
              <h2>Historique des salaires</h2>
              {salaries === null ? (
                <p className="teacher-profile-empty">Chargement de l'historique...</p>
              ) : salaries.length === 0 ? (
                <p className="teacher-profile-empty">Aucun versement de salaire enregistré.</p>
              ) : (
                <table>
                  <thead>
                    <tr><th>Mois</th><th>Montant</th><th>Statut</th></tr>
                  </thead>
                  <tbody>
                    {salaries.map((item) => {
                      const status = salaryStatus[item.status] || salaryStatus.pending
                      return (
                        <tr key={item.id}>
                          <td>{formatMonth(item.month)}</td>
                          <td>{formatAmount(item.amount)}</td>
                          <td><span className={`salary-status ${status.cls}`}>{status.label}</span></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </article>
          </section>
        </div>
      </main>
    </div>
  )
}
