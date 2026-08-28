import { useEffect, useState } from 'react'
import Icon from '../../Icon'
import { initials, today } from '../utils/studentHelpers'
import { supabase } from '../../../supabaseClient'
import { academicMonths } from '../../Accounting/monthUtils'
import { safeFilename } from '../../../utils/exportToPdf'
import { downloadPdfDocument } from '../../pdf/downloadPdf'
import StudentSheetPdf from '../../pdf/StudentSheetPdf'
import { waPhoneNumber } from '../../Accounting/delinquenciesApi'
import AddGradeModal from './AddGradeModal'

const formatAmount = (value) => `${Number(value || 0).toLocaleString('fr-FR')} DH`

const formatDate = (value) => {
  const [year, month, day] = String(value || '').split('-')
  return year && month && day ? `${day}/${month}/${year}` : String(value || '—')
}

function monthsBetween(from, to) {
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()) + 1
}

const MONTHS = academicMonths()

const EVENT_META = [
  { id: 'absence', emoji: '🔴', label: 'Absence' },
  { id: 'retard', emoji: '⏱️', label: 'Retard' },
  { id: 'betise', emoji: '⚠️', label: 'Bêtise / Discipline' },
  { id: 'cahier', emoji: '📘', label: 'Cahier non apporté' },
  { id: 'exercice', emoji: '📝', label: 'Exercice non fait' },
]
const labelOf = (type) => EVENT_META.find((meta) => meta.id === type)?.label || type

export default function StudentSheetModal({ student, close }) {
  const [subscriptions, setSubscriptions] = useState(null)
  const [payments, setPayments] = useState(null)
  const [grades, setGrades] = useState(null)
  const [gradeModalOpen, setGradeModalOpen] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState('all')
  const [events, setEvents] = useState(null)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [subsRes, paymentsRes, gradesRes] = await Promise.all([
          supabase
            .from('student_subscriptions')
            .select('subject_id, group_id, teacher_id, pricing_type, monthly_price, subjects(name), groups(name)')
            .eq('student_id', student.id),
          supabase
            .from('student_payments')
            .select('month, amount')
            .eq('student_id', student.id),
          supabase
            .from('student_grades')
            .select('id, value, exam, session, grade_date, subjects(name)')
            .eq('student_id', student.id)
            .order('grade_date', { ascending: false }),
        ])
        if (cancelled) return
        setSubscriptions(subsRes.data || [])
        setPayments(paymentsRes.data || [])
        setGrades(gradesRes.data || [])
      } catch (err) {
        if (cancelled) {
          console.error(err)
          setSubscriptions([])
          setPayments([])
          setGrades([])
        }
      }
    }
    load()
    return () => { cancelled = true }
  }, [student.id])

  useEffect(() => {
    let cancelled = false
    async function loadEvents() {
      let query = supabase
        .from('student_events')
        .select('event_type, detail, event_date')
        .eq('student_id', student.id)
        .order('event_date', { ascending: true })
      if (selectedMonth !== 'all') {
        query = query.like('event_date', `${selectedMonth.slice(0, 7)}-%`)
      }
      try {
        const { data } = await query
        if (cancelled) return
        setEvents(data || [])
      } catch (err) {
        if (cancelled) {
          console.error(err)
          setEvents([])
        }
      }
    }
    loadEvents()
    return () => { cancelled = true }
  }, [student.id, selectedMonth])

  const eventCounts = Object.fromEntries(EVENT_META.map((meta) => [meta.id, 0]))
  for (const event of events || []) {
    if (eventCounts[event.event_type] !== undefined) eventCounts[event.event_type] += 1
  }
  const totalRetardMinutes = (events || []).reduce(
    (sum, event) => (event.event_type === 'retard' ? sum + (Number(event.detail) || 0) : sum),
    0
  )
  const logEvents = [...(events || [])].sort((a, b) =>
    String(a.event_date || '').localeCompare(String(b.event_date || ''))
  )

  const totalMonths = student.registrationDate
    ? Math.max(1, monthsBetween(new Date(student.registrationDate), new Date()))
    : 0
  const paidMonths = payments ? new Set(payments.map((p) => p.month?.slice(0, 7))).size : 0
  const totalPaid = (payments || []).reduce((sum, p) => sum + Number(p.amount || 0), 0)

  const periodLabel =
    selectedMonth === 'all'
      ? 'Bilan annuel'
      : MONTHS.find((month) => month.key === selectedMonth)?.label || selectedMonth

  const stopPropagation = (e) => e.stopPropagation()

  const downloadPdf = async () => {
    if (exporting) return
    setExporting(true)
    try {
      const eventStats = EVENT_META.map((meta) => ({
        id: meta.id,
        label: meta.label,
        count: eventCounts[meta.id],
        note: meta.id === 'retard' && totalRetardMinutes > 0 ? `${totalRetardMinutes} min` : undefined,
      }))
      const pdfLogEvents = logEvents.map((event) => ({ ...event, label: labelOf(event.event_type) }))
      await downloadPdfDocument(
        <StudentSheetPdf
          data={{
            student,
            subscriptions: subscriptions || [],
            grades: grades || [],
            logEvents: pdfLogEvents,
            eventStats,
            periodLabel,
            totalMonths,
            paidMonths,
            totalPaid,
            formatAmount,
            formatDate,
            generatedDate: formatDate(today()),
          }}
        />,
        `fiche-eleve-${safeFilename(student.name)}.pdf`
      )
    } catch (err) {
      console.error(err)
    } finally {
      setExporting(false)
    }
  }

  const openWhatsApp = () => {
    const phone = student.phone1 || student.phone2 || student.phone
    const number = waPhoneNumber(phone)
    if (!number) {
      alert('Aucun numéro de téléphone disponible')
      return
    }
    window.open(`https://wa.me/${number}`, '_blank', 'noopener,noreferrer')
  }

  const refreshGrades = async () => {
    const { data } = await supabase
      .from('student_grades')
      .select('id, value, exam, session, grade_date, subjects(name)')
      .eq('student_id', student.id)
      .order('grade_date', { ascending: false })
    setGrades(data || [])
  }

  return (
    <div className="student-overlay sheet-overlay" onMouseDown={close}>
      <section className="student-sheet" onMouseDown={stopPropagation}>
        <button className="student-close" onClick={close}>
          <Icon name="close" />
        </button>
        <aside>
          <div className="sheet-profile">
            {student.photoUrl ? (
              <img className="sheet-profile-avatar-img" src={student.photoUrl} alt={student.name} />
            ) : (
              <span>{initials(student.name)}</span>
            )}
            <h2>{student.name}</h2>
            <small>{student.code}</small>
            <b>{student.level}</b>
          </div>
          <p>♟ &nbsp; {student.registrationDate || '—'}</p>
          <p>⌖ &nbsp; {student.address || student.branch || '—'}</p>
          <p>♧ &nbsp; {student.phone || '—'}</p>
          {student.phone2 && <p>☎ &nbsp; {student.phone2}</p>}
          <p>♜ &nbsp; {[student.school, student.schoolClass].filter(Boolean).join(' · ') || student.level || '—'}</p>
          <section className="sheet-alerts">
            <h3>Alertes médicales / comportementales</h3>
            <p>{student.alerts || 'Aucune alerte enregistrée.'}</p>
          </section>
          <div className="sheet-contact">
            <button className="sheet-download" onClick={downloadPdf} disabled={exporting}>
              {exporting ? 'Génération du PDF…' : 'Télécharger Fiche Élève PDF'}
            </button>
            <button>⌕ &nbsp; Appeler</button>
            <button onClick={openWhatsApp}>◯ &nbsp; WhatsApp</button>
          </div>
        </aside>
        <main>
          <div className="paid-card">
            <small>MOIS PAYÉS</small>
            <strong>{totalMonths ? `${paidMonths}/${totalMonths}` : '—'}</strong>
            {totalPaid > 0 && <small>{formatAmount(totalPaid)} réglés</small>}
          </div>
          <section className="monthly">
            <header>
              <h3>⌁ &nbsp; Suivi mensuel</h3>
              <div>
                <select value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)}>
                  <option value="all">Tous les mois (Bilan Annuel)</option>
                  {MONTHS.map((month) => (
                    <option key={month.key} value={month.key}>{month.label}</option>
                  ))}
                </select>
              </div>
            </header>
            <div className="monthly-stats">
              {EVENT_META.map((meta) => (
                <div key={meta.id} className={eventCounts[meta.id] ? 'has-count' : ''}>
                  <small>{meta.emoji} {meta.label}</small>
                  <b>{eventCounts[meta.id]}</b>
                  <span>
                    {meta.id === 'retard'
                      ? `${totalRetardMinutes} min`
                      : `événement${eventCounts[meta.id] > 1 ? 's' : ''}`}
                  </span>
                </div>
              ))}
            </div>
            {events === null ? (
              <p className="sheet-empty">Chargement du suivi...</p>
            ) : logEvents.length === 0 ? (
              <p className="sheet-empty">Aucun événement enregistré pour cette période.</p>
            ) : (
              <div className="sheet-events-log">
                <table>
                  <thead>
                    <tr><th>Date</th><th>Événement</th><th>Note / Détail</th></tr>
                  </thead>
                  <tbody>
                    {logEvents.map((event, index) => (
                      <tr key={`${event.event_date}-${event.event_type}-${index}`}>
                        <td>{formatDate(event.event_date)}</td>
                        <td>{labelOf(event.event_type)}</td>
                        <td>{event.detail || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="grades">
            <header>
              <h3>Notes scolaires</h3>
              <button onClick={() => setGradeModalOpen(true)}>+ Ajouter une note</button>
            </header>
            {grades === null ? (
              <p className="sheet-empty">Chargement des notes...</p>
            ) : grades.length === 0 ? (
              <p className="sheet-empty">Aucune note enregistrée.</p>
            ) : (
              <div className="sheet-grades-scroll">
                <table>
                  <thead>
                    <tr><th>Matière</th><th>Note /20</th><th>N° examen</th><th>Session</th><th>Date</th></tr>
                  </thead>
                  <tbody>
                    {grades.map((grade) => (
                      <tr key={grade.id}>
                        <td>{grade.subjects?.name || '—'}</td>
                        <td><span>{Number(grade.value)}</span></td>
                        <td>{grade.exam || '—'}</td>
                        <td>{grade.session}</td>
                        <td>{formatDate(grade.grade_date)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          <section className="enrolled-subjects">
            <h3>Matières inscrites</h3>
            <div>
              {subscriptions === null ? (
                <p className="sheet-empty">Chargement des matières...</p>
              ) : subscriptions.length === 0 ? (
                <p className="sheet-empty">Aucune matière inscrite.</p>
              ) : (
                subscriptions.map((sub, index) => (
                  <article key={sub.subject_id || index}>
                    <b>{sub.subjects?.name || 'Matière inconnue'}</b>
                    <small>Groupe : {sub.groups?.name || 'Non assigné'}</small>
                    <span>{formatAmount(sub.monthly_price)}</span>
                  </article>
                ))
              )}
            </div>
          </section>
        </main>
      </section>

      {gradeModalOpen && (
        <AddGradeModal
          student={student}
          onSaved={refreshGrades}
          close={() => setGradeModalOpen(false)}
        />
      )}
    </div>
  )
}
