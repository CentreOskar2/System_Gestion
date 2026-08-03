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
  const percentage = teacher.paymentType === 'pourcentage' ? Number(teacher.remuneration_amount || 0) : null

  useEffect(() => {
    let cancelled = false
    async function load() {
      const groupsRes = await supabase
        .from('groups')
        .select('id, name, subject_id, level_id, capacity, status')
        .eq('teacher_id', teacher.id)
      if (cancelled) return

      const groupIds = (groupsRes.data || []).map((g) => g.id)
      const [subjectsRes, levelsRes, gsRes, salariesRes] = await Promise.all([
        supabase.from('subjects').select('id, name'),
        supabase.from('levels').select('id, name'),
        groupIds.length > 0
          ? supabase.from('group_students').select('group_id, student_id').in('group_id', groupIds)
          : Promise.resolve({ data: [] }),
        supabase
          .from('teacher_salaries')
          .select('id, month, amount, status')
          .eq('teacher_id', teacher.id)
          .order('month', { ascending: false }),
      ])
      if (cancelled) return

      const subjectMap = Object.fromEntries((subjectsRes.data || []).map((s) => [s.id, s.name]))
      const levelMap = Object.fromEntries((levelsRes.data || []).map((l) => [l.id, l.name]))
      const countByGroup = {}
      for (const row of gsRes.data || []) {
        countByGroup[row.group_id] = (countByGroup[row.group_id] || 0) + 1
      }

      setGroups(
        (groupsRes.data || []).map((g) => ({
          id: g.id,
          name: g.name,
          subject: subjectMap[g.subject_id] || '—',
          level: levelMap[g.level_id] || '—',
          capacity: g.capacity,
          status: g.status,
          studentCount: countByGroup[g.id] || 0,
        }))
      )
      setSalaries((salariesRes.data || []).map((s) => s))
    }
    load()
    return () => { cancelled = true }
  }, [teacher.id])

  return (
    <div className="teacher-profile-page">
      <Header />
      <main className="teacher-profile-content">
        <button className="teacher-profile-back" onClick={onBack}>← Retour aux professeurs</button>
        <div className="teacher-profile-layout">
          <aside className="teacher-profile-summary">
            <div className="teacher-profile-avatar">{initials(fullName)}</div>
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
                <p>{fixedSalary ? 'Salaire mensuel' : 'Taux (pourcentage)'}</p>
                <strong>{fixedSalary ? formatAmount(teacher.remuneration_amount) : `${percentage} %`}</strong>
              </div>
              <span className={`pay-tag ${fixedSalary ? 'fixe' : 'pourcentage'}`}>
                {fixedSalary ? 'Fixe' : 'Pourcentage'}
              </span>
            </article>

            <article className="teacher-profile-card">
              <h2>Matières &amp; niveaux enseignés</h2>
              <div className="teacher-qualifications">
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
                      <strong>{group.subject}</strong>
                      <span>{group.level} · {group.name}</span>
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
