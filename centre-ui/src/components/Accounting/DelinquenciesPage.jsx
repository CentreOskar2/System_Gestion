import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Header from '../shared/Header'
import { initials } from '../Students/utils/studentHelpers'
import { useAuth } from '../../context/AuthContext'
import {
  buildReminderMessage,
  fetchDelinquenciesData,
  logPaymentReminder,
  whatsappLink,
} from './delinquenciesApi'
import { subscribeFeesCache } from './feesApi'
import './DelinquenciesPage.css'

export default function DelinquenciesPage() {
  const { user } = useAuth()
  const [data, setData] = useState({ debtors: [], stats: { count: 0, totalDebt: 0, avgDelay: 0 }, template: null, centerName: 'Centre Atlas' })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reminded, setReminded] = useState([])
  const [modal, setModal] = useState(null)
  const [message, setMessage] = useState('')
  const [modalError, setModalError] = useState('')
  const [saving, setSaving] = useState(false)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const next = await fetchDelinquenciesData()
        if (!active) return
        setData(next)
        setError('')
      } catch (err) {
        if (!active) return
        console.error(err)
        setError(err.message)
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [reload])

  useEffect(() => {
    const bump = () => setReload((count) => count + 1)
    const onStorage = (event) => {
      if (event.key === 'fees_cache_version') bump()
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') bump()
    }
    const unsubscribe = subscribeFeesCache(bump)
    window.addEventListener('storage', onStorage)
    window.addEventListener('focus', bump)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      unsubscribe()
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('focus', bump)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  const openReminder = (debtor) => {
    setModalError('')
    setMessage(buildReminderMessage(debtor, data.template, data.centerName))
    setModal(debtor)
  }

  const finishReminder = (id) => {
    setReminded((list) => (list.includes(id) ? list : [...list, id]))
    setModal(null)
  }

  const handleSend = async () => {
    if (!modal || saving) return
    setSaving(true)
    setModalError('')
    try {
      await logPaymentReminder(modal.id, { months: modal.months, amount: modal.debt, message, sentBy: user?.id })
      const link = whatsappLink(modal.phone, message)
      if (link) window.open(link, '_blank', 'noopener,noreferrer')
      finishReminder(modal.id)
    } catch (err) {
      console.error(err)
      setModalError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleLogOnly = async () => {
    if (!modal || saving) return
    setSaving(true)
    setModalError('')
    try {
      await logPaymentReminder(modal.id, { months: modal.months, amount: modal.debt, message, channel: 'other', sentBy: user?.id })
      finishReminder(modal.id)
    } catch (err) {
      console.error(err)
      setModalError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const stats = useMemo(() => data.stats, [data.stats])
  const debtors = useMemo(() => data.debtors, [data.debtors])

  return (
    <div className="delinquencies-page">
      <Header />
      <main className="delinquencies-content">
        <div className="fees-heading"><h1>Comptabilité</h1><p>Gestion financière du centre.</p></div>
        <nav className="accounting-tabs">
          <Link to="/accounting/fees">Frais de scolarité</Link>
          <Link className="active" to="/accounting/delinquencies">Retards & Impayés</Link>
          <button>Salaires Profs</button>
          <button>Charges</button>
          <button>Bénéfice net</button>
        </nav>
        <section className="delinquency-stats">
          <article><div><span>Élèves en retard</span><strong>{stats.count}</strong></div><i className="danger">!</i></article>
          <article><div><span>Dette totale accumulée</span><strong>{stats.totalDebt.toLocaleString('fr-FR')} DH</strong></div><i className="danger">▣</i></article>
          <article><div><span>Retard moyen</span><strong>{stats.avgDelay} jours</strong></div><i className="warning">◷</i></article>
        </section>
        {error && <div className="fees-error">Erreur : {error}</div>}
        {loading ? (
          <div className="fees-loading">Chargement des retards & impayés...</div>
        ) : (
          <section className="delinquency-radar">
            <header>
              <h2>Radar des défaillants</h2>
              <p>Trié par dette décroissante</p>
            </header>
            <div className="radar-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Élève</th>
                    <th>Niveau</th>
                    <th>Mois impayés</th>
                    <th>Durée</th>
                    <th>Dette</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {debtors.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="radar-empty">Aucun élève en retard. Tous les paiements sont à jour.</td>
                    </tr>
                  ) : (
                    debtors.map((student) => (
                      <tr key={student.id}>
                        <td>
                          <div className="debtor">
                            <i>{initials(student.name)}</i>
                            <span><b>{student.name}</b><small>{student.code}</small></span>
                          </div>
                        </td>
                        <td>
                          <span className="level-pill">{student.level}</span>
                          {student.filiere && <small className="level-sub">{student.filiere}</small>}
                        </td>
                        <td>{student.months}</td>
                        <td><span className="delay-pill">{student.days} j</span></td>
                        <td><strong className="debt">{student.debt.toLocaleString('fr-FR')} DH</strong></td>
                        <td>
                          <button
                            className={reminded.includes(student.id) ? 'reminder sent' : 'reminder'}
                            onClick={() => openReminder(student)}
                          >
                            {reminded.includes(student.id) ? '✓ Rappel envoyé' : '◯  Rappel'}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>

      {modal && (
        <div className="delinquency-overlay" onMouseDown={() => setModal(null)}>
          <section className="reminder-modal" onMouseDown={(e) => e.stopPropagation()}>
            <button className="reminder-modal-close" onClick={() => setModal(null)}>×</button>
            <header>
              <i>{initials(modal.name)}</i>
              <div>
                <h2>Rappel de paiement</h2>
                <p>{modal.name} — {modal.code}</p>
              </div>
            </header>
            <div className="reminder-modal-stats">
              <span>Mois impayés <b>{modal.months}</b></span>
              <span>Dette <b>{modal.debt.toLocaleString('fr-FR')} DH</b></span>
              <span>Téléphone <b>{modal.phone || '—'}</b></span>
            </div>
            <label className="reminder-modal-message">
              Message WhatsApp
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} />
            </label>
            {modalError && <div className="fees-error">Erreur : {modalError}</div>}
            <footer>
              <button className="reminder-cancel" onClick={() => setModal(null)}>Annuler</button>
              <button className="reminder-log" onClick={handleLogOnly} disabled={saving}>
                Enregistrer le rappel
              </button>
              <button
                className="reminder-send"
                onClick={handleSend}
                disabled={saving || !modal.phone}
                title={!modal.phone ? 'Aucun numéro de téléphone enregistré' : 'Ouvrir WhatsApp'}
              >
                {saving ? 'Envoi...' : 'Ouvrir WhatsApp'}
              </button>
            </footer>
          </section>
        </div>
      )}
    </div>
  )
}
