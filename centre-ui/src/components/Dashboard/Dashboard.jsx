import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../Icon'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../supabaseClient'
import { fetchFeesData } from '../Accounting/feesApi'
import { buildDebtors, buildReminderMessage, whatsappLink } from '../Accounting/delinquenciesApi'
import { academicMonths, currentMonthKey, monthLabelOf } from '../Accounting/monthUtils'
import { initials } from '../Students/utils/studentHelpers'
import './Dashboard.css'

const SUBJECT_PRICE = 500

const MONTHS_SHORT = ['Sept', 'Oct', 'Nov', 'Déc', 'Janv', 'Févr', 'Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Août']

const EVENT_META = {
  absence: { label: 'Absence', ar: 'غياب', color: '#ef4444', tone: 'red', icon: 'clock' },
  retard: { label: 'Retard', ar: 'تأخر', color: '#f59e0b', tone: 'amber', icon: 'clock' },
  betise: { label: 'Bêtise', ar: 'سلوك', color: '#a855f7', tone: 'violet', icon: 'flame' },
  cahier: { label: 'Cahier non fait', ar: 'الكراس غير محضر', color: '#8b5cf6', tone: 'violet', icon: 'clipboard' },
  exercice: { label: 'Exercice non fait', ar: 'تمرين غير منجز', color: '#06b6d4', tone: 'cyan', icon: 'clipboard' },
}

const DISCIPLINE_SERIES = [
  { key: 'absence', label: 'Absences', color: '#ef4444' },
  { key: 'retard', label: 'Retards', color: '#f59e0b' },
  { key: 'discipline', label: 'Discipline', color: '#a855f7' },
  { key: 'exercice', label: 'Exercices', color: '#06b6d4' },
]

const CYCLE_COLORS = ['#3b63f0', '#22c55e', '#f59e0b', '#a855f7', '#06b6d4', '#ef4444', '#64748b']

const todayISO = () => {
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

const formatDate = (value) => {
  const [year, month, day] = String(value || '').split('-')
  return year && month && day ? `${day}/${month}/${year}` : String(value || '')
}

const fmtDH = (value) => `${Math.round(Number(value) || 0).toLocaleString('fr-FR')} DH`

const shortMonthLabel = (key) => {
  const match = /^(\d{4})-(\d{2})/.exec(String(key || ''))
  if (!match) return String(key || '')
  return `${MONTHS_SHORT[Number(match[2]) - 1]} ${String(match[1]).slice(2)}`
}

const timeAgo = (value) => {
  if (!value) return ''
  const diff = Date.now() - new Date(value).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "à l'instant"
  if (mins < 60) return `il y a ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `il y a ${hours} h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `il y a ${days} j`
  return new Date(value).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

function computeSalary(paymentType, fixedSalary, remunerationAmount, cycleRates, groups) {
  if (paymentType === 'fixe') {
    return Number(fixedSalary) || Number(remunerationAmount) || 0
  }
  let total = 0
  for (const group of groups) {
    const rate = cycleRates?.[group.cycleId] || 0
    total += group.studentsCount * SUBJECT_PRICE * (rate / 100)
  }
  return Math.round(total)
}

function buildSalaryTeachers(rows, studentMap) {
  const cycleMap = Object.fromEntries((rows.cycles.data || []).map((c) => [c.id, c.name]))
  const levelMap = Object.fromEntries((rows.levels.data || []).map((l) => [l.id, l.name]))
  const levelById = Object.fromEntries((rows.levels.data || []).map((l) => [l.id, l]))
  const branchMap = Object.fromEntries((rows.branches.data || []).map((b) => [b.id, b.name]))
  const subjectMap = Object.fromEntries((rows.subjects.data || []).map((s) => [s.id, s.name]))
  const groupById = Object.fromEntries((rows.groups.data || []).map((g) => [g.id, g]))

  const groupIdsByTeacher = {}
  for (const row of rows.tgs.data || []) {
    if (!groupIdsByTeacher[row.teacher_id]) groupIdsByTeacher[row.teacher_id] = []
    if (!groupIdsByTeacher[row.teacher_id].includes(row.group_id)) {
      groupIdsByTeacher[row.teacher_id].push(row.group_id)
    }
  }
  const studentsByGroup = {}
  for (const row of rows.gs.data || []) {
    if (!studentsByGroup[row.group_id]) studentsByGroup[row.group_id] = []
    if (studentMap[row.student_id]) studentsByGroup[row.group_id].push(studentMap[row.student_id])
  }

  return (rows.teachers.data || []).map((t) => {
    const groups = (groupIdsByTeacher[t.id] || [])
      .map((groupId) => {
        const group = groupById[groupId]
        if (!group) return null
        const cycleId = levelById[group.level_id]?.cycle_id
        const rate = t.remuneration_type === 'pourcentage' ? Number(t.cycle_rates?.[cycleId] ?? 0) : 0
        const students = studentsByGroup[groupId] || []
        return {
          id: group.id,
          name: group.name,
          subject: subjectMap[group.subject_id] || '—',
          level: levelMap[group.level_id] || '—',
          branch: branchMap[group.branch_id] || '—',
          cycleId,
          rate,
          students,
          studentsCount: students.length,
        }
      })
      .filter(Boolean)
    return {
      id: t.id,
      name: `${t.first_name} ${t.last_name}`.trim(),
      paymentType: t.remuneration_type,
      type: t.remuneration_type === 'fixe' ? 'Fixe' : 'Pourcentage',
      cycles: (t.cycle_ids || []).map((id) => cycleMap[id]).filter(Boolean),
      amount: computeSalary(
        t.remuneration_type,
        t.fixed_salary,
        t.remuneration_amount,
        t.cycle_rates || {},
        groups
      ),
      groups,
    }
  })
}

function GroupedBarChart({ months, incomeByMonth, salariesByMonth }) {
  const max = Math.max(
    1,
    ...months.map((key) => Math.max(incomeByMonth[key] || 0, salariesByMonth[key] || 0))
  )
  return (
    <div className="dchart dchart--grouped">
      <div className="dchart__plot">
        {months.map((key) => {
          const income = incomeByMonth[key] || 0
          const salaries = salariesByMonth[key] || 0
          return (
            <div className="dchart__col" key={key}>
              <div className="dchart__bars">
                <div
                  className="dbar dbar--income"
                  style={{ height: `${Math.round((income / max) * 100)}%` }}
                  data-val={income ? fmtDH(income).replace(' DH', '') : ''}
                  title={`${shortMonthLabel(key)} — Encaissé ${fmtDH(income)}`}
                />
                <div
                  className="dbar dbar--salary"
                  style={{ height: `${Math.round((salaries / max) * 100)}%` }}
                  data-val={salaries ? fmtDH(salaries).replace(' DH', '') : ''}
                  title={`${shortMonthLabel(key)} — Salaires ${fmtDH(salaries)}`}
                />
              </div>
              <span className="dchart__tick">{shortMonthLabel(key)}</span>
            </div>
          )
        })}
      </div>
      <div className="dchart__legend">
        <span><i className="dlegend dlegend--income" />Encaissements</span>
        <span><i className="dlegend dlegend--salary" />Salaires professeurs</span>
      </div>
    </div>
  )
}

function StackedBarChart({ months, countsByMonth }) {
  const max = Math.max(
    1,
    ...months.map((key) =>
      DISCIPLINE_SERIES.reduce((sum, s) => sum + (countsByMonth[key]?.[s.key] || 0), 0)
    )
  )
  return (
    <div className="dchart dchart--stacked">
      <div className="dchart__plot">
        {months.map((key) => {
          let offset = 0
          const totals = countsByMonth[key] || {}
          const total = DISCIPLINE_SERIES.reduce((sum, s) => sum + (totals[s.key] || 0), 0)
          return (
            <div className="dchart__col" key={key}>
              <div className="dchart__stack">
                {DISCIPLINE_SERIES.map((s) => {
                  const value = totals[s.key] || 0
                  if (!value) return null
                  const el = (
                    <div
                      key={s.key}
                      className="dstack__seg"
                      style={{
                        height: `${Math.round((value / max) * 100)}%`,
                        background: s.color,
                        bottom: `${offset}%`,
                      }}
                      title={`${shortMonthLabel(key)} — ${s.label} : ${value}`}
                    />
                  )
                  offset += (value / max) * 100
                  return el
                })}
                {total === 0 && <div className="dstack__empty" title="Aucun événement" />}
              </div>
              <span className="dchart__tick">{shortMonthLabel(key)}</span>
            </div>
          )
        })}
      </div>
      <div className="dchart__legend">
        {DISCIPLINE_SERIES.map((s) => (
          <span key={s.key}><i style={{ background: s.color }} />{s.label}</span>
        ))}
      </div>
    </div>
  )
}

function DonutChart({ items }) {
  const total = items.reduce((sum, item) => sum + item.value, 0)
  const R = 15.915
  const GAP = 0.045
  const arcs = items.reduce((acc, item, index) => {
    const fraction = total ? item.value / total : 0
    const prev = acc.reduce((sum, arc) => sum + arc.fraction, 0)
    const sweep = Math.max(fraction * 2 * Math.PI - GAP, 0)
    const a0 = prev * 2 * Math.PI
    const a1 = a0 + sweep
    const large = sweep > Math.PI ? 1 : 0
    const x0 = 21 + R * Math.cos(a0 - Math.PI / 2)
    const y0 = 21 + R * Math.sin(a0 - Math.PI / 2)
    const x1 = 21 + R * Math.cos(a1 - Math.PI / 2)
    const y1 = 21 + R * Math.sin(a1 - Math.PI / 2)
    const pct = total ? Math.round((item.value / total) * 100) : 0
    acc.push({
      item,
      fraction,
      pct,
      color: CYCLE_COLORS[index % CYCLE_COLORS.length],
      d: `M ${x0.toFixed(3)} ${y0.toFixed(3)} A ${R} ${R} 0 ${large} 1 ${x1.toFixed(3)} ${y1.toFixed(3)}`,
    })
    return acc
  }, [])
  return (
    <div className="ddonut">
      <div className="ddonut__ring">
        <svg viewBox="0 0 42 42">
          <circle cx="21" cy="21" r={R} fill="none" stroke="#eef1f6" strokeWidth="6.5" />
          {arcs.map((arc) => (
            <path
              key={arc.item.label}
              d={arc.d}
              fill="none"
              stroke={arc.color}
              strokeWidth="6.5"
              className="ddonut__seg"
            >
              <title>{`${arc.item.label} — ${arc.item.value} élève${arc.item.value > 1 ? 's' : ''} (${arc.pct}%)`}</title>
            </path>
          ))}
        </svg>
        <div className="ddonut__center">
          <strong>{total}</strong>
          <span>élèves</span>
        </div>
      </div>
      <ul className="ddonut__legend">
        {arcs.map((arc) => (
          <li key={arc.item.label}>
            <i style={{ background: arc.color }} />
            <span>{arc.item.label || '—'}</span>
            <b>{arc.item.value}</b>
            <em>{arc.pct}%</em>
          </li>
        ))}
      </ul>
    </div>
  )
}

function QuickAction({ icon, label, hint, tone, onClick }) {
  return (
    <button type="button" className={`dqa dqa--${tone}`} onClick={onClick}>
      <span className="dqa__icon"><Icon name={icon} /></span>
      <span className="dqa__body">
        <strong>{label}</strong>
        <small>{hint}</small>
      </span>
      <span className="dqa__arrow" aria-hidden="true">→</span>
    </button>
  )
}

export default function Dashboard() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [fees, setFees] = useState(null)
  const [events, setEvents] = useState([])
  const [salaryRecords, setSalaryRecords] = useState([])
  const [teachers, setTeachers] = useState([])
  const [centerName, setCenterName] = useState('Centre Oskar')

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const [feesData, eventsRes, salariesRes, settingsRes, teachersRes, cyclesRes, levelsRes, branchesRes, subjectsRes, groupsRes, tgsRes, gsRes] = await Promise.all([
          fetchFeesData(),
          supabase
            .from('student_events')
            .select('id, student_id, event_date, event_type, detail, created_at, students(first_name, last_name)'),
          supabase
            .from('teacher_salaries')
            .select('id, teacher_id, month, amount, status, created_at, teachers(first_name, last_name)'),
          supabase.from('center_settings').select('center_name').limit(1).maybeSingle(),
          supabase.from('teachers').select('*').eq('status', 'active').order('last_name'),
          supabase.from('cycles').select('id, name'),
          supabase.from('levels').select('id, name, cycle_id'),
          supabase.from('branches').select('id, name'),
          supabase.from('subjects').select('id, name'),
          supabase.from('groups').select('id, name, subject_id, level_id, branch_id'),
          supabase.from('teacher_group_subjects').select('teacher_id, group_id'),
          supabase.from('group_students').select('group_id, student_id'),
        ])
        if (cancelled) return

        const studentMap = Object.fromEntries((feesData.students || []).map((s) => [s.id, s.name]))

        setFees(feesData)
        setEvents(eventsRes.data || [])
        setSalaryRecords(salariesRes.data || [])
        setCenterName(settingsRes.data?.center_name || 'Centre Oskar')
        setTeachers(
          buildSalaryTeachers(
            { teachers: teachersRes, cycles: cyclesRes, levels: levelsRes, branches: branchesRes, subjects: subjectsRes, groups: groupsRes, tgs: tgsRes, gs: gsRes },
            studentMap
          )
        )
      } catch (err) {
        if (!cancelled) {
          console.error(err)
          setError(err.message)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const students = useMemo(() => fees?.students || [], [fees])
  const paymentsByStudent = useMemo(() => fees?.paymentsByStudent || {}, [fees])

  const academic = useMemo(() => academicMonths(), [])
  const currentMonth = useMemo(() => currentMonthKey(new Date()), [])
  const currentLabel = useMemo(() => monthLabelOf(currentMonth), [currentMonth])

  const windowMonths = useMemo(() => {
    const idx = academic.findIndex((m) => m.key === currentMonth)
    if (idx === -1) return academic.slice(0, 6).map((m) => m.key)
    return academic.slice(Math.max(0, idx - 5), idx + 1).map((m) => m.key)
  }, [academic, currentMonth])

  const activeCount = useMemo(() => students.filter((s) => s.active).length, [students])
  const inactiveCount = students.length - activeCount

  const growth = useMemo(() => {
    const now = new Date()
    const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    return students.filter((s) => String(s.registrationDate || '').startsWith(key)).length
  }, [students])

  const revenue = useMemo(() => {
    const expected = students
      .filter((s) => s.active)
      .reduce((sum, s) => sum + (Number(s.du_mois) || 0), 0)
    let collected = 0
    for (const list of Object.values(paymentsByStudent)) {
      for (const p of list) {
        if (p.month === currentMonth && p.status !== 'unpaid') collected += Number(p.amount) || 0
      }
    }
    const pending = Math.max(0, expected - collected)
    return { expected, collected, pending, rate: expected ? Math.min(100, Math.round((collected / expected) * 100)) : 0 }
  }, [students, paymentsByStudent, currentMonth])

  const salariesByMonth = useMemo(() => {
    const map = {}
    for (const record of salaryRecords) {
      if (record.status === 'pending') continue
      const key = String(record.month).slice(0, 7) + '-01'
      map[key] = (map[key] || 0) + (Number(record.amount) || 0)
    }
    return map
  }, [salaryRecords])

  const incomeByMonth = useMemo(() => {
    const map = {}
    for (const list of Object.values(paymentsByStudent)) {
      for (const p of list) {
        if (p.status === 'unpaid') continue
        const key = String(p.month).slice(0, 7) + '-01'
        map[key] = (map[key] || 0) + (Number(p.amount) || 0)
      }
    }
    return map
  }, [paymentsByStudent])

  const eventsByMonth = useMemo(() => {
    const map = {}
    for (const event of events) {
      const key = String(event.event_date).slice(0, 7) + '-01'
      const type = event.event_type
      if (!map[key]) map[key] = { absence: 0, retard: 0, discipline: 0, exercice: 0 }
      if (type === 'absence') map[key].absence += 1
      else if (type === 'retard') map[key].retard += 1
      else if (type === 'betise' || type === 'cahier') map[key].discipline += 1
      else if (type === 'exercice') map[key].exercice += 1
    }
    return map
  }, [events])

  const cycleDist = useMemo(() => {
    const map = {}
    for (const student of students) {
      const cycle = student.cycle || '—'
      map[cycle] = (map[cycle] || 0) + 1
    }
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([label, value]) => ({ label, value }))
  }, [students])

  const snapshot = useMemo(() => {
    let date = todayISO()
    if (events.length > 0) {
      const latest = events.reduce((acc, e) => (e.event_date > acc ? e.event_date : acc), '')
      if (latest) date = latest
    }
    const counts = { absence: 0, retard: 0, betise: 0, exercice: 0 }
    for (const e of events) {
      if (e.event_date !== date) continue
      if (e.event_type === 'absence') counts.absence += 1
      else if (e.event_type === 'retard') counts.retard += 1
      else if (e.event_type === 'betise' || e.event_type === 'cahier') counts.betise += 1
      else if (e.event_type === 'exercice') counts.exercice += 1
    }
    return { date, isToday: date === todayISO(), counts }
  }, [events])

  const studentById = useMemo(() => Object.fromEntries(students.map((s) => [s.id, s.name])), [students])

  const feed = useMemo(() => {
    const items = []
    for (const event of events) {
      const meta = EVENT_META[event.event_type]
      items.push({
        id: `ev-${event.id}`,
        ts: event.created_at,
        title: event.students?.first_name ? `${event.students.first_name} ${event.students.last_name}` : 'Élève',
        subtitle: meta?.label || event.event_type,
        meta: formatDate(event.event_date),
        tone: meta?.tone || 'slate',
        icon: meta?.icon || 'clock',
      })
    }
    for (const list of Object.values(paymentsByStudent)) {
      for (const p of list) {
        if (p.status === 'unpaid') continue
        items.push({
          id: `pay-${p.student_id}-${p.month}`,
          ts: p.paid_at || p.month,
          title: studentById[p.student_id] || 'Élève',
          subtitle: `Paiement reçu · ${fmtDH(p.amount)}`,
          meta: shortMonthLabel(p.month),
          tone: 'green',
          icon: 'coin',
        })
      }
    }
    for (const record of salaryRecords) {
      if (record.status === 'pending') continue
      items.push({
        id: `sal-${record.id}`,
        ts: record.created_at,
        title: record.teachers?.first_name ? `${record.teachers.first_name} ${record.teachers.last_name}` : 'Professeur',
        subtitle: `Salaire validé · ${fmtDH(record.amount)}`,
        meta: shortMonthLabel(record.month),
        tone: 'blue',
        icon: 'check',
      })
    }
    items.sort((a, b) => String(b.ts || '').localeCompare(String(a.ts || '')))
    return items.slice(0, 12)
  }, [events, paymentsByStudent, salaryRecords, studentById])

  const debtors = useMemo(() => {
    if (!fees) return []
    return buildDebtors(fees.students, fees.paymentsByStudent).slice(0, 5)
  }, [fees])

  const massSalariale = useMemo(() => teachers.reduce((sum, t) => sum + t.amount, 0), [teachers])
  const paidSalaryTeachers = useMemo(() => {
    const paid = new Set(
      salaryRecords.filter((r) => r.status === 'paid' && String(r.month).slice(0, 7) === currentMonth.slice(0, 7)).map((r) => r.teacher_id)
    )
    return teachers.filter((t) => paid.has(t.id)).length
  }, [salaryRecords, teachers, currentMonth])

  const openReminder = (debtor) => {
    const link = whatsappLink(debtor.phone, buildReminderMessage(debtor, null, centerName))
    if (link) window.open(link, '_blank', 'noopener,noreferrer')
  }

  const goEnroll = () => navigate('/students', { state: { quick: 'enroll' } })

  const quickActions = [
    { icon: 'user-plus', label: "Ajouter un élève", hint: 'Nouvelle inscription', tone: 'blue', onClick: goEnroll },
    { icon: 'clipboard', label: 'Pointer présence', hint: 'Pointage du jour', tone: 'violet', onClick: () => navigate('/students', { state: { quick: 'attendance' } }) },
    { icon: 'printer', label: "Générer Fiche d'absence", hint: 'Feuille vierge imprimable', tone: 'amber', onClick: () => navigate('/students', { state: { quick: 'absence-sheet' } }) },
    { icon: 'wallet', label: 'Imprimer Journal de Salaire', hint: 'Masse salariale', tone: 'green', onClick: () => navigate('/accounting/salaries') },
  ]

  const avatarLabel = initials(`${profile?.first_name || ''} ${profile?.last_name || ''}`.trim()) || 'DA'
  const greetingName = profile?.first_name || 'Directeur'

  if (loading && !fees) {
    return (
      <div className="dashboard-main">
        <div className="content">
          <div className="db-skeleton db-skeleton--hero" />
          <div className="db-skeleton-grid">
            {[0, 1, 2, 3].map((i) => <div className="db-skeleton" key={i} />)}
          </div>
          <div className="db-skeleton-grid db-skeleton-grid--wide">
            {[0, 1].map((i) => <div className="db-skeleton" key={i} />)}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard-main">
      <header className="topbar">
        <label className="searchbar">
          <span className="searchbar__icon"><Icon name="search" /></span>
          <input type="search" placeholder="Rechercher un élève, professeur..." />
        </label>
        <button type="button" className="branch-select">
          <span>Toutes les succursales</span>
          <span aria-hidden="true">⌄</span>
        </button>
        <button type="button" className="notifications" aria-label="Notifications">
          <Icon name="bell" />
          {debtors.length > 0 && <span className="notifications__badge">{debtors.length}</span>}
        </button>
        <div className="profile">
          <div className="profile__avatar">{avatarLabel}</div>
          <div>
            <strong>{profile?.first_name ? `${profile.first_name} ${profile.last_name || ''}` : 'Directeur Oskar'}</strong>
            <span>{profile?.role === 'super_admin' ? 'Administrateur' : 'Gestion'}</span>
          </div>
        </div>
        <button type="button" className="db-logout" onClick={signOut} title="Se déconnecter">
          <Icon name="logout" />
          <span>Se déconnecter</span>
        </button>
      </header>

      <main className="content">
        {error && (
          <div className="db-error" role="alert">
            <Icon name="alert" />
            <span>Impossible de charger certaines données : {error}</span>
            <button type="button" onClick={() => window.location.reload()}>Réessayer</button>
          </div>
        )}

        <section className="db-hero">
          <div className="db-hero__brand">
            <div className="db-hero__logo">
              <img src="/oskar-logo.png" alt="Logo Centre Oskar" />
            </div>
            <div>
              <h1>Centre Oskar <span className="db-hero__ar">مركز أوسكار</span></h1>
              <p>
                Bonjour, <strong>{greetingName}</strong> 👋 — command center opérationnel.
              </p>
            </div>
          </div>
          <div className="db-hero__chips">
            <span className="db-chip db-chip--date">
              <Icon name="calendar" />
              {currentLabel}
            </span>
            <span className="db-chip">Année 2026-2027</span>
            <span className="db-chip db-chip--live"><i />Temps réel</span>
          </div>
          <div className="controls">
            <button type="button" className="primary" onClick={goEnroll}>
              <span aria-hidden="true">+</span>
              Nouvelle inscription
            </button>
            <button type="button" className="secondary" onClick={() => navigate('/accounting/delinquencies')}>
              <Icon name="eye" />
              Voir les impayés
            </button>
          </div>
        </section>

        <section className="db-kpis" aria-label="Indicateurs clés">
          <article className="db-kpi db-kpi--students">
            <div className="db-kpi__head">
              <span className="db-kpi__label">Élèves</span>
              <span className="db-kpi__badge"><Icon name="users" /></span>
            </div>
            <strong className="db-kpi__value">{students.length}</strong>
            <div className="db-kpi__split">
              <span><i className="dot dot--green" />{activeCount} actifs</span>
              <span><i className="dot dot--gray" />{inactiveCount} inactifs</span>
            </div>
            <div className="db-kpi__bar"><i style={{ width: `${students.length ? Math.round((activeCount / students.length) * 100) : 0}%` }} /></div>
            <p className="db-kpi__note">
              <span className={`db-trend ${growth > 0 ? 'up' : 'flat'}`}>
                <Icon name={growth > 0 ? 'arrow-up' : 'arrow-down'} />+{growth} ce mois
              </span>
            </p>
          </article>

          <article className="db-kpi db-kpi--revenue">
            <div className="db-kpi__head">
              <span className="db-kpi__label">Revenus & encaissements</span>
              <span className="db-kpi__badge"><Icon name="coin" /></span>
            </div>
            <strong className="db-kpi__value">{fmtDH(revenue.collected)}</strong>
            <div className="db-kpi__split">
              <span className="paid">Payé · {fmtDH(revenue.collected)}</span>
              <span className="pending">En attente · {fmtDH(revenue.pending)}</span>
            </div>
            <div className="db-kpi__bar db-kpi__bar--revenue"><i style={{ width: `${revenue.rate}%` }} /></div>
            <p className="db-kpi__note">
              {revenue.rate}% encaissé sur {fmtDH(revenue.expected)} attendus
            </p>
          </article>

          <article className="db-kpi db-kpi--salary">
            <div className="db-kpi__head">
              <span className="db-kpi__label">Salaires profs</span>
              <span className="db-kpi__badge"><Icon name="cap" /></span>
            </div>
            <strong className="db-kpi__value">{fmtDH(massSalariale)}</strong>
            <div className="db-kpi__split">
              <span>{teachers.length} prof{teachers.length > 1 ? 's' : ''} actif{teachers.length > 1 ? 's' : ''}</span>
              <span>{paidSalaryTeachers} validé{paidSalaryTeachers > 1 ? 's' : ''}</span>
            </div>
            <div className="db-kpi__bar db-kpi__bar--salary"><i style={{ width: `${teachers.length ? Math.round((paidSalaryTeachers / teachers.length) * 100) : 0}%` }} /></div>
            <p className="db-kpi__note">Engagement du mois · {currentLabel}</p>
          </article>

          <article className="db-kpi db-kpi--discipline">
            <div className="db-kpi__head">
              <span className="db-kpi__label">Pointage du jour</span>
              <span className="db-kpi__badge"><Icon name="flame" /></span>
            </div>
            <div className="db-kpi__snap">
              <div className="snap"><i className="snap__i snap__i--red" /><b>{snapshot.counts.absence}</b><span>Absences</span></div>
              <div className="snap"><i className="snap__i snap__i--amber" /><b>{snapshot.counts.retard}</b><span>Retards</span></div>
              <div className="snap"><i className="snap__i snap__i--violet" /><b>{snapshot.counts.betise}</b><span>Bêtises</span></div>
              <div className="snap"><i className="snap__i snap__i--cyan" /><b>{snapshot.counts.exercice}</b><span>Exercices</span></div>
            </div>
            <p className="db-kpi__note">
              {snapshot.isToday ? "Aujourd'hui" : `Pointage du ${formatDate(snapshot.date)}`}
              <span className="db-live-dot" title="Données en direct" />
            </p>
          </article>
        </section>

        <section className="db-analytics">
          <article className="db-panel db-panel--trend">
            <header className="db-panel__head">
              <div>
                <h2>Revenus vs Salaires professeurs</h2>
                <p>Encaissements scolaires contre masse salariale, par mois</p>
              </div>
              <span className="db-panel__icon"><Icon name="trending-up" /></span>
            </header>
            <GroupedBarChart months={windowMonths} incomeByMonth={incomeByMonth} salariesByMonth={salariesByMonth} />
          </article>

          <article className="db-panel db-panel--cycles">
            <header className="db-panel__head">
              <div>
                <h2>Répartition par cycle</h2>
                <p>Collège · Lycée · autres</p>
              </div>
              <span className="db-panel__icon"><Icon name="layers" /></span>
            </header>
            <DonutChart items={cycleDist} />
          </article>

          <article className="db-panel db-panel--heatmap">
            <header className="db-panel__head">
              <div>
                <h2>Discipline & assiduité</h2>
                <p>Distribution mensuelle des comportements</p>
              </div>
              <span className="db-panel__icon"><Icon name="flame" /></span>
            </header>
            <StackedBarChart months={windowMonths} countsByMonth={eventsByMonth} />
          </article>
        </section>

        <section className="db-ops">
          <article className="db-panel db-panel--feed">
            <header className="db-panel__head">
              <div>
                <h2>Activité récente</h2>
                <p>Journal temps réel du centre</p>
              </div>
              <span className="db-live-pill"><i />Live</span>
            </header>
            <ul className="db-feed">
              {feed.length === 0 && <li className="db-feed__empty">Aucune activité récente pour le moment.</li>}
              {feed.map((item) => (
                <li className={`db-feed__item db-feed__item--${item.tone}`} key={item.id}>
                  <span className="db-feed__icon"><Icon name={item.icon} /></span>
                  <span className="db-feed__body">
                    <strong>{item.title}</strong>
                    <small>{item.subtitle} · <em>{item.meta}</em></small>
                  </span>
                  <time>{timeAgo(item.ts)}</time>
                </li>
              ))}
            </ul>
          </article>

          <div className="db-ops__side">
            <article className="db-panel db-panel--quick">
              <header className="db-panel__head">
                <div>
                  <h2>Actions rapides</h2>
                  <p>Raccourcis fréquents</p>
                </div>
                <span className="db-panel__icon"><Icon name="sparkles" /></span>
              </header>
              <div className="db-qa-grid">
                {quickActions.map((action) => (
                  <QuickAction key={action.label} {...action} />
                ))}
              </div>
            </article>

            <article className="db-panel db-panel--pending">
              <header className="db-panel__head">
                <div>
                  <h2>Paiements en attente</h2>
                  <p>Rappels WhatsApp directs</p>
                </div>
                <span className="db-panel__badge">{debtors.length}</span>
              </header>
              {debtors.length === 0 ? (
                <p className="db-pending__empty">Aucun élève en retard. Tout est à jour ✨</p>
              ) : (
                <ul className="db-pending">
                  {debtors.map((debtor) => (
                    <li className="db-pending__item" key={debtor.id}>
                      <span className="db-pending__avatar">{initials(debtor.name)}</span>
                      <span className="db-pending__body">
                        <strong>{debtor.name}</strong>
                        <small>{debtor.months} mois · <b>{debtor.debt.toLocaleString('fr-FR')} DH</b></small>
                      </span>
                      <button
                        type="button"
                        className="db-wa"
                        onClick={() => openReminder(debtor)}
                        disabled={!debtor.phone}
                        title={debtor.phone ? 'Envoyer un rappel WhatsApp' : 'Aucun numéro enregistré'}
                      >
                        <Icon name="phone" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          </div>
        </section>
      </main>
    </div>
  )
}
