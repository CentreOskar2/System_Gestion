import { useEffect, useState } from 'react'
import Icon from '../../Icon'
import { initials } from '../utils/studentHelpers'
import { supabase } from '../../../supabaseClient'

const formatAmount = (value) => `${Number(value || 0).toLocaleString('fr-FR')} DH`

function monthsBetween(from, to) {
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()) + 1
}

export default function StudentSheetModal({ student, close }) {
  const [subscriptions, setSubscriptions] = useState(null)
  const [payments, setPayments] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [subsRes, paymentsRes] = await Promise.all([
        supabase
          .from('student_subscriptions')
          .select('subject_id, group_id, teacher_id, pricing_type, monthly_price, subjects(name), groups(name)')
          .eq('student_id', student.id),
        supabase
          .from('student_payments')
          .select('month, amount')
          .eq('student_id', student.id),
      ])
      if (cancelled) return
      setSubscriptions(subsRes.data || [])
      setPayments(paymentsRes.data || [])
    }
    load()
    return () => { cancelled = true }
  }, [student.id])

  const totalMonths = student.registrationDate
    ? Math.max(1, monthsBetween(new Date(student.registrationDate), new Date()))
    : 0
  const paidMonths = payments ? new Set(payments.map((p) => p.month?.slice(0, 7))).size : 0
  const totalPaid = (payments || []).reduce((sum, p) => sum + Number(p.amount || 0), 0)

  const stopPropagation = (e) => e.stopPropagation()

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
            <button>⌕ &nbsp; Appeler</button>
            <button>◯ &nbsp; WhatsApp</button>
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
            </header>
            <p className="sheet-empty">Aucune donnée enregistrée.</p>
          </section>
          <section className="grades">
            <header>
              <h3>Notes scolaires</h3>
            </header>
            <p className="sheet-empty">Aucune donnée enregistrée.</p>
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
    </div>
  )
}
