import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Percent, TrendingUp, Wallet } from 'lucide-react'
import Header from '../shared/Header'
import Icon from '../Icon'
import { initials } from '../Students/utils/studentHelpers'
import { safeFilename } from '../../utils/exportToPdf'
import { downloadPdfDocument } from '../pdf/downloadPdf'
import SalaryJournalPdf from '../pdf/SalaryJournalPdf'
import { supabase } from '../../supabaseClient'
import { useBranch } from '../../context/BranchContext'
import { waPhoneNumber } from './delinquenciesApi'
import { calendarMonthOptions, currentMonthKey, monthLabelOf, schoolYearOptions } from './monthUtils'
import { fetchTeacherSalaries } from './salariesApi'
import './SalariesPage.css'

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
      const groupTotal = group.studentsCount * group.price
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
  const [isExporting, setIsExporting] = useState(false)
  const percentage = teacher.type === 'Pourcentage'

  const groupTotals = teacher.groups.map((group) => group.studentsCount * group.price)
  const totalSalary = percentage
    ? teacher.amount
    : teacher.groups.reduce((sum, group) => sum + group.studentsCount * group.price, 0)

  const downloadPdf = async () => {
    setIsExporting(true)
    try {
      await downloadPdfDocument(
        <SalaryJournalPdf teacher={teacher} monthLabel={monthLabel} />,
        `journal-salaire-${safeFilename(teacher.name)}.pdf`
      )
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="salary-overlay" onMouseDown={close}>
      <section className="salary-journal" onMouseDown={(event) => event.stopPropagation()}>
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
                      <td>{group.price} DH</td>
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
          <button className="journal-download" disabled={isExporting} onClick={downloadPdf}>
            {isExporting ? 'Génération du PDF…' : (<><Icon name="download" /> Télécharger le PDF</>)}
          </button>
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
  const initialPeriod = currentMonthKey()
  const [selectedMonthNumber, setSelectedMonthNumber] = useState(() => String(Number(initialPeriod.slice(5, 7))))
  const [selectedYear, setSelectedYear] = useState(() => initialPeriod.slice(0, 4))
  const [notice, setNotice] = useState(null)
  const monthOptions = useMemo(() => calendarMonthOptions(), [])
  const yearOptions = useMemo(() => schoolYearOptions(), [])

  // An academic year begins in September: Jan–Aug belong to its following calendar year.
  const selectedCalendarYear = Number(selectedYear) + (Number(selectedMonthNumber) < 9 ? 1 : 0)
  const month = `${selectedCalendarYear}-${selectedMonthNumber.padStart(2, '0')}-01`

  const branchFilter = selectedBranch && selectedBranch !== 'all' ? selectedBranch : null

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const { teachers: rows } = await fetchTeacherSalaries({ month, branchId: branchFilter })
        if (cancelled) return
        setTeachers(rows)
        setValidated(rows.filter((t) => t.validated).map((t) => `${t.id}:${month}`))
      } catch (err) {
        if (cancelled) return
        console.error(err)
        setTeachers([])
        setValidated([])
        setNotice(err.message || 'Impossible de charger les salaires')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [month, branchFilter])

  const validateSalary = async (teacher) => {
    const key = `${teacher.id}:${month}`
    if (validated.includes(key) || pendingSalaries.includes(teacher.id)) return
    setPendingSalaries((items) => [...items, teacher.id])
    setNotice(null)
    const monthLabel = monthLabelOf(month)
    let insertedExpenseId
    try {
      const expenseRes = await supabase
        .from('expenses')
        .insert({
          title: `Salaire - ${teacher.name} (${monthLabel})`,
          amount: teacher.amount,
          month,
          charge_date: new Date().toISOString().slice(0, 10),
          branch_id: teacher.branch_id || null,
          type: 'Auto',
          teacher_id: teacher.id,
        })
        .select('id')
        .single()
      if (expenseRes.error) throw new Error(expenseRes.error.message)
      insertedExpenseId = expenseRes.data?.id

      const salaryRes = await supabase.from('teacher_salaries').upsert(
        { teacher_id: teacher.id, month, amount: teacher.amount, status: 'paid' },
        { onConflict: 'teacher_id,month' }
      )
      if (salaryRes.error) {
        if (insertedExpenseId) {
          await supabase.from('expenses').delete().eq('id', insertedExpenseId)
        }
        throw new Error(salaryRes.error.message)
      }

      setValidated((items) => (items.includes(key) ? items : [...items, key]))
      openWhatsApp(teacher, monthLabel)
      if (teacher.paymentType !== 'fixe') {
        setSelected(teacher)
      }
    } catch (err) {
      console.error(err)
      setNotice(err.message || "Erreur lors de l'enregistrement du salaire")
    } finally {
      setPendingSalaries((items) => items.filter((id) => id !== teacher.id))
    }
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
            <i><Wallet size={22} /></i>
          </article>
          <article>
            <span>Profs — salaire fixe</span>
            <strong>{teachers.filter((t) => t.paymentType === 'fixe').length}</strong>
            <i><TrendingUp size={22} /></i>
          </article>
          <article>
            <span>Profs — pourcentage</span>
            <strong>{teachers.filter((t) => t.paymentType === 'pourcentage').length}</strong>
            <i><Percent size={22} /></i>
          </article>
        </section>
        <div className="salary-period" aria-label="Période des salaires">
          <label>
            <span>Mois</span>
            <select value={selectedMonthNumber} onChange={(event) => setSelectedMonthNumber(event.target.value)}>
              {monthOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Année scolaire</span>
            <select value={selectedYear} onChange={(event) => setSelectedYear(event.target.value)}>
              {yearOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        </div>
        {notice && (
          <p style={{ margin: '0 0 16px', padding: '10px 14px', background: '#fdecea', color: '#c0392b', borderRadius: 8 }}>
            {notice}
          </p>
        )}
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
                              <Icon name="printer" /> Imprimer journal
                            </button>
                          )}
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
