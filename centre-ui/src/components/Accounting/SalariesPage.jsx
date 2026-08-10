import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Header from '../shared/Header'
import { initials } from '../Students/utils/studentHelpers'
import { exportToPdf, safeFilename } from '../../utils/exportToPdf'
import { supabase } from '../../supabaseClient'
import { useBranch } from '../../context/BranchContext'
import { waPhoneNumber } from './delinquenciesApi'
import { academicMonths, currentMonthKey, monthLabelOf } from './monthUtils'
import './SalariesPage.css'

const SUBJECT_PRICE = 500

function calculateSalary(teacher, groups) {
  if (teacher.paymentType === 'fixe') {
    return Number(teacher.fixed_salary) || Number(teacher.remuneration_amount) || 0
  }
  let total = 0
  for (const group of groups) {
    const rate = teacher.cycle_rates?.[group.cycleId] || 0
    total += group.studentsCount * SUBJECT_PRICE * (rate / 100)
  }
  return Math.round(total)
}

function buildSalaryMessage(teacher, monthLabel) {
  const percentage = teacher.type === 'Pourcentage'
  const lines = []
  lines.push(`مرحباً أ. ${teacher.name}،`)
  lines.push('')
  lines.push(`كشف أجر شهر *${monthLabel}* — *مركز أوسكار*`)
  lines.push('')
  if (teacher.groups.length > 0) {
    lines.push('*تفاصيل المجموعات:*')
    teacher.groups.forEach((group) => {
      const groupTotal = group.studentsCount * SUBJECT_PRICE
      const net = percentage ? Math.round((groupTotal * group.rate) / 100) : groupTotal
      lines.push('')
      lines.push(`▪️ *${group.name}* (${group.subject} · ${group.level})`)
      lines.push(`   عدد الطلبة المسجلين: ${group.studentsCount}`)
      if (group.students.length > 0) lines.push(`   الطلبة: ${group.students.join('، ')}`)
      lines.push(`   مجموع المجموعة: ${groupTotal.toLocaleString('fr-FR')} DH`)
      if (percentage && group.rate > 0) lines.push(`   النسبة (تأثير): ${group.rate}%`)
      lines.push(`   المبلغ المستحق للمجموعة: ${net.toLocaleString('fr-FR')} DH`)
    })
  } else {
    lines.push('لا توجد مجموعات معينة لهذا الأستاذ.')
  }
  lines.push('')
  lines.push(`*الأجر الإجمالي المستحق: ${teacher.amount.toLocaleString('fr-FR')} DH*`)
  lines.push('')
  lines.push('شكراً على التزامكم.')
  lines.push('مع تحياتنا،')
  lines.push('*مركز أوسكار*')
  return lines.join('\n')
}

function openWhatsApp(teacher, monthLabel) {
  const number = waPhoneNumber(teacher.phone)
  if (!number) {
    alert('Aucun numéro de téléphone disponible pour ce professeur')
    return
  }
  const message = buildSalaryMessage(teacher, monthLabel)
  window.open(`https://wa.me/${number}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer')
}

function Journal({ teacher, monthLabel, close }) {
  const journalRef = useRef(null)
  const [isExporting, setIsExporting] = useState(false)
  const percentage = teacher.type === 'Pourcentage'

  const groupTotals = teacher.groups.map((group) => group.studentsCount * SUBJECT_PRICE)
  const totalSalary = percentage
    ? teacher.amount
    : teacher.groups.reduce((sum, group) => sum + group.studentsCount * SUBJECT_PRICE, 0)

  const downloadPdf = async () => { setIsExporting(true); try { await exportToPdf(journalRef.current, `journal-salaire-${safeFilename(teacher.name)}.pdf`) } finally { setIsExporting(false) } }

  return (
    <div className="salary-overlay" onMouseDown={close}>
      <section ref={journalRef} className="salary-journal" onMouseDown={(event) => event.stopPropagation()}>
        <button className="salary-close" onClick={close}>×</button>
        <h2>Journal de salaire</h2>
        <div className="journal-teacher">
          <i>{initials(teacher.name)}</i>
          <span>
            <b>{teacher.name}</b>
            <small>{monthLabel}</small>
          </span>
          <em className={percentage ? 'percentage' : 'fixed'}>{teacher.type}</em>
        </div>

        {teacher.groups.length > 0 ? (
          teacher.groups.map((group, index) => (
            <article className="journal-group" key={group.id}>
              <header>
                <div>
                  <b>{group.name}</b>
                  <small>{group.subject} · {group.level} · {group.branch} · {group.studentsCount} élèves</small>
                </div>
                {percentage && group.rate > 0 && <span>Taux : {group.rate}%</span>}
              </header>
              <table>
                <thead>
                  <tr>
                    <th>Élève</th>
                    <th>Prix matière</th>
                  </tr>
                </thead>
                <tbody>
                  {(group.students.length > 0 ? group.students : Array.from({ length: group.studentsCount }, (_, i) => `Élève ${i + 1}`)).map((student, i) => (
                    <tr key={`${student}-${i}`}>
                      <td>{student}</td>
                      <td>{SUBJECT_PRICE} DH</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th>Total du groupe</th>
                    <th>{groupTotals[index].toLocaleString('fr-FR')} DH</th>
                  </tr>
                </tfoot>
              </table>
            </article>
          ))
        ) : (
          <p>Aucun groupe assigné à ce professeur</p>
        )}

        <section className="journal-summary">
          <h3>Récapitulatif</h3>
          <div className="summary-head">
            <span>Groupe / Matière</span>
            <span>Total groupe</span>
            <span>Taux</span>
            <span>Montant dû</span>
          </div>
          {teacher.groups.map((group, index) => (
            <div className="summary-row" key={group.id}>
              <span>{group.name}</span>
              <span>{groupTotals[index].toLocaleString('fr-FR')} DH</span>
              <span>{percentage ? `${group.rate}%` : 'Fixe'}</span>
              <span>{percentage ? `${Math.round(groupTotals[index] * group.rate / 100).toLocaleString('fr-FR')} DH` : `${groupTotals[index].toLocaleString('fr-FR')} DH`}</span>
            </div>
          ))}
          <div className="summary-total">
            <b>Salaire total à verser</b>
            <strong>{totalSalary.toLocaleString('fr-FR')} DH</strong>
          </div>
        </section>
        <footer>
          <button disabled={isExporting} onClick={downloadPdf}>
            {isExporting ? 'Génération du PDF…' : '▣  Télécharger le PDF'}
          </button>
          <button className="journal-whatsapp" onClick={() => openWhatsApp(teacher, monthLabel)}>💬 Envoyer via WhatsApp</button>
          <button onClick={close}>Fermer</button>
        </footer>
      </section>
    </div>
  )
}

export default function SalariesPage() {
  const { selectedBranch } = useBranch()
  const [selected, setSelected] = useState(null)
  const [validated, setValidated] = useState([])
  const [pendingSalaries, setPendingSalaries] = useState([])
  const [teachers, setTeachers] = useState([])
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState(currentMonthKey())
  const months = useMemo(() => academicMonths(), [])

  const branchFilter = selectedBranch && selectedBranch !== 'all' ? selectedBranch : null

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      let teachersQuery = supabase.from('teachers').select('*').eq('status', 'active').order('last_name')
      let groupsQuery = supabase.from('groups').select('id, name, subject_id, level_id, branch_id')
      if (branchFilter) {
        teachersQuery = teachersQuery.eq('branch_id', branchFilter)
        groupsQuery = groupsQuery.eq('branch_id', branchFilter)
      }
      const [teachersRes, cyclesRes, levelsRes, branchesRes, subjectsRes, groupsRes, tgRes, gsRes, studentsRes, salaryRes] = await Promise.all([
        teachersQuery,
        supabase.from('cycles').select('id, name'),
        supabase.from('levels').select('id, name, cycle_id'),
        supabase.from('branches').select('id, name'),
        supabase.from('subjects').select('id, name'),
        groupsQuery,
        supabase.from('teacher_group_subjects').select('teacher_id, group_id'),
        supabase.from('group_students').select('group_id, student_id'),
        supabase.from('students').select('id, first_name, last_name'),
        supabase.from('teacher_salaries').select('teacher_id').eq('month', month).eq('status', 'paid'),
      ])
      if (cancelled) return
      setLoading(false)
      if (teachersRes.error) return

      const cycleMap = Object.fromEntries((cyclesRes.data || []).map((c) => [c.id, c.name]))
      const levelMap = Object.fromEntries((levelsRes.data || []).map((l) => [l.id, l.name]))
      const levelById = Object.fromEntries((levelsRes.data || []).map((l) => [l.id, l]))
      const branchMap = Object.fromEntries((branchesRes.data || []).map((b) => [b.id, b.name]))
      const subjectMap = Object.fromEntries((subjectsRes.data || []).map((s) => [s.id, s.name]))
      const groupById = Object.fromEntries((groupsRes.data || []).map((g) => [g.id, g]))
      const studentMap = Object.fromEntries((studentsRes.data || []).map((s) => [s.id, `${s.first_name} ${s.last_name}`.trim()]))

      const groupIdsByTeacher = {}
      for (const row of tgRes.data || []) {
        if (!groupIdsByTeacher[row.teacher_id]) groupIdsByTeacher[row.teacher_id] = []
        if (!groupIdsByTeacher[row.teacher_id].includes(row.group_id)) groupIdsByTeacher[row.teacher_id].push(row.group_id)
      }
      const studentsByGroup = {}
      for (const row of gsRes.data || []) {
        if (!studentsByGroup[row.group_id]) studentsByGroup[row.group_id] = []
        if (studentMap[row.student_id]) studentsByGroup[row.group_id].push(studentMap[row.student_id])
      }

      setTeachers(
        (teachersRes.data || []).map((t) => {
          const cycleIds = t.cycle_ids || []
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
          const levels = [...new Set(groups.map((g) => g.level).filter((level) => level !== '—'))]
          return {
            id: t.id,
            name: `${t.first_name} ${t.last_name}`.trim(),
            phone: t.phone || '',
            branch_id: t.branch_id,
            paymentType: t.remuneration_type,
            type: t.remuneration_type === 'fixe' ? 'Fixe' : 'Pourcentage',
            fixed_salary: t.fixed_salary,
            remuneration_amount: t.remuneration_amount,
            cycle_rates: t.cycle_rates || {},
            cycles: cycleIds.map((id) => cycleMap[id]).filter(Boolean),
            levels,
            groups,
            amount: calculateSalary(
              {
                paymentType: t.remuneration_type,
                fixed_salary: t.fixed_salary,
                remuneration_amount: t.remuneration_amount,
                cycle_rates: t.cycle_rates || {},
              },
              groups
            ),
          }
        })
      )
      const paidIds = new Set((salaryRes.data || []).map((r) => r.teacher_id))
      setValidated((teachersRes.data || []).filter((t) => paidIds.has(t.id)).map((t) => `${t.id}:${month}`))
    }
    load()
    return () => { cancelled = true }
  }, [month, branchFilter])

  const validateSalary = async (teacher) => {
    const key = `${teacher.id}:${month}`
    if (validated.includes(key) || pendingSalaries.includes(teacher.id)) return
    setPendingSalaries((items) => [...items, teacher.id])
    const monthLabel = monthLabelOf(month)
    await Promise.all([
      supabase.from('expenses').insert({
        title: `Salaire - ${teacher.name} (${monthLabel})`,
        amount: teacher.amount,
        month,
        branch_id: teacher.branch_id || null,
        type: 'Auto',
        teacher_id: teacher.id,
      }),
      supabase.from('teacher_salaries').upsert(
        { teacher_id: teacher.id, month, amount: teacher.amount, status: 'paid' },
        { onConflict: 'teacher_id,month' }
      ),
    ])
    setPendingSalaries((items) => items.filter((id) => id !== teacher.id))
    setValidated((items) => (items.includes(key) ? items : [...items, key]))
    setSelected(teacher)
  }

  const openJournal = (teacher, validate) => {
    if (validate) validateSalary(teacher)
    else setSelected(teacher)
  }

  const massSalariale = teachers.reduce((sum, t) => sum + t.amount, 0)

  return (
    <div className="salaries-page">
      <Header />
      <main className="salaries-content">
        <div className="fees-heading">
          <h1>Comptabilité</h1>
          <p>Gestion financière du centre.</p>
        </div>
        <nav className="accounting-tabs">
          <Link to="/accounting/fees">Frais de scolarité</Link>
          <Link to="/accounting/delinquencies">Retards & Impayés</Link>
          <Link className="active" to="/accounting/salaries">Salaires Profs</Link>
          <Link to="/accounting/expenses">Charges</Link>
          <Link to="/accounting/profit">Bénéfice net</Link>
        </nav>
        <section className="salary-stats">
          <article>
            <span>Masse salariale du mois</span>
            <strong>{massSalariale.toLocaleString('fr-FR')} DH</strong>
            <i>▣</i>
          </article>
          <article>
            <span>Profs — salaire fixe</span>
            <strong>{teachers.filter((t) => t.paymentType === 'fixe').length}</strong>
            <i>↗</i>
          </article>
          <article>
            <span>Profs — pourcentage</span>
            <strong>{teachers.filter((t) => t.paymentType === 'pourcentage').length}</strong>
            <i>%</i>
          </article>
        </section>
        <label className="salary-month">
          Mois : <select value={month} onChange={(event) => setMonth(event.target.value)}>
            {months.map((m) => (
              <option key={m.key} value={m.key}>{m.label}</option>
            ))}
          </select>
        </label>
        <section className="salary-table-wrap">
          <table className="salary-table">
            <thead>
              <tr>
                <th>Professeur</th>
                <th>Type</th>
                <th>Cycle(s) / Niveau(x)</th>
                <th>Montant calculé</th>
                <th>Statut</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="salary-empty">Chargement des professeurs...</td>
                </tr>
              ) : teachers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="salary-empty">Aucun professeur actif.</td>
                </tr>
              ) : (
                teachers.map((teacher) => {
                  const isValidated = validated.includes(`${teacher.id}:${month}`)
                  const isPending = pendingSalaries.includes(teacher.id)
                  return (
                    <tr key={teacher.id}>
                      <td>
                        <div className="salary-person">
                          <i>{initials(teacher.name)}</i>
                          <b>{teacher.name}</b>
                        </div>
                      </td>
                      <td>
                        <span className={teacher.paymentType === 'fixe' ? 'type-fixed' : 'type-percent'}>
                          {teacher.type}
                        </span>
                      </td>
                      <td>
                        <small>{teacher.cycles.join(', ') || '—'}</small>
                        <br />
                        <small style={{ color: '#647088' }}>{teacher.levels.join(', ') || '—'}</small>
                      </td>
                      <td>
                        <b>{teacher.amount.toLocaleString('fr-FR')} DH</b>
                      </td>
                      <td>
                        <span className={isValidated ? 'salary-status paid' : 'salary-status'}>
                          {isValidated ? 'Validé' : 'En attente'}
                        </span>
                      </td>
                      <td>
                        <div className="salary-actions">
                          {teacher.paymentType === 'pourcentage' && (
                            <button className="journal-button" onClick={() => openJournal(teacher, false)}>
                              ▣  Imprimer journal
                            </button>
                          )}
                          <button
                            className="whatsapp-button"
                            onClick={() => openWhatsApp(teacher, monthLabelOf(month))}
                          >
                            💬 WhatsApp
                          </button>
                          <button
                            className={isValidated ? 'validate-salary done' : 'validate-salary'}
                            disabled={isPending}
                            onClick={() => openJournal(teacher, true)}
                          >
                            {isPending ? 'Enregistrement…' : (isValidated ? '✓ Validé' : '✓  Valider')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </section>
        {selected && <Journal teacher={selected} monthLabel={monthLabelOf(month)} close={() => setSelected(null)} />}
      </main>
    </div>
  )
}
