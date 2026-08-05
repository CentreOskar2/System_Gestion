import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Header from '../shared/Header'
import Icon from '../Icon'
import { supabase } from '../../supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { exportToPdf } from '../../utils/exportToPdf'
import { syncSubscriptions } from '../Students/enrollment/enrollmentApi'
import { initials } from '../Students/utils/studentHelpers'
import {
  MONTHS,
  academicYearStart,
  monthDate,
  isFutureMonth,
  priceFor,
  studentLineItems,
  fetchFeesData,
  invalidateFeesCache,
} from './feesApi'
import './FeesPage.css'
import './FeesEditModal.css'

function Receipt({ student, month, catalog, close }) {
  const docRef = useRef(null)
  const lines = studentLineItems(student, catalog)
  const today = new Intl.DateTimeFormat('fr-MA').format(new Date())

  const downloadPdf = async () => {
    try {
      await exportToPdf(docRef.current, `recu-${student.code}-${month}.pdf`)
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <main className="fee-receipt">
      <div className="fee-receipt-actions">
        <button onClick={close}>← Retour</button>
        <button className="fee-print" onClick={downloadPdf}>▣ &nbsp; Télécharger le PDF</button>
      </div>
      <article className="fee-document" ref={docRef}>
        <header>
          <div className="fee-brand">
            <img src="/oskar-logo.png" alt="Logo Centre Atlas" />
            <div><strong>Centre Atlas</strong><span>Cours particuliers — Casablanca</span></div>
          </div>
          <div className="fee-ref">
            <span>REÇU DE PAIEMENT MENSUEL</span>
            <b>{student.code}</b>
            <small>Date : {today}</small>
          </div>
        </header>
        <section className="fee-receipt-student">
          <div>{initials(student.name)}</div>
          <p>
            <strong>{student.name}</strong>
            <span>Niveau : {student.level}</span>
            <span>Mois réglé : {month}</span>
          </p>
        </section>
        <section className="fee-lines">
          <h2>Détail des matières</h2>
          <div className="fee-line fee-line-head"><span>Matière</span><span>Prix</span></div>
          {lines.map((line) => (
            <div className="fee-line" key={line.name}>
              <span>{line.name}</span>
              <span>{line.amount.toLocaleString('fr-FR')} DH</span>
            </div>
          ))}
          <div className="fee-total"><b>Montant total payé</b><strong>{student.du_mois.toLocaleString('fr-FR')} DH</strong></div>
        </section>
        <div className="fee-confirmation">✓ Paiement reçu en espèces — Le {today}</div>
        <footer>
          <span>Signature parent/tuteur</span>
          <span>Signature administration</span>
        </footer>
      </article>
    </main>
  )
}

export default function FeesPage() {
  const { user } = useAuth()
  const [students, setStudents] = useState([])
  const [paymentsByStudent, setPaymentsByStudent] = useState({})
  const [catalog, setCatalog] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(null)
  const [editing, setEditing] = useState(null)
  const [receipt, setReceipt] = useState(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await fetchFeesData()
      setStudents(data.students)
      setPaymentsByStudent(data.paymentsByStudent)
      setCatalog(data.catalog)
    } catch (err) {
      console.error(err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    fetchFeesData()
      .then((data) => {
        if (!active) return
        setStudents(data.students)
        setPaymentsByStudent(data.paymentsByStudent)
        setCatalog(data.catalog)
      })
      .catch((err) => {
        if (active) {
          console.error(err)
          setError(err.message)
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const shown = useMemo(
    () => students.filter((s) => `${s.name} ${s.code}`.toLowerCase().includes(query.toLowerCase())),
    [students, query]
  )

  const stats = useMemo(() => {
    const yearStart = academicYearStart()
    const active = students.filter((s) => s.active)
    const totalCollected = Object.values(paymentsByStudent)
      .flat()
      .reduce((sum, p) => {
        if (p.month >= `${yearStart}-09-01` && p.month <= `${yearStart + 1}-08-31`) {
          return sum + (p.amount || 0)
        }
        return sum
      }, 0)
    return {
      totalCollected,
      billed: active.length,
      dueTotal: active.reduce((sum, s) => sum + (s.du_mois || 0), 0),
    }
  }, [students, paymentsByStudent])

  const stateOf = (student, index) => {
    const key = monthDate(index)
    if (paymentsByStudent[student.id]?.some((p) => p.month === key)) return 'paid'
    if (!student.active || isFutureMonth(index)) return 'inactive'
    return 'unpaid'
  }

  const openPayment = (student, index) => {
    if (stateOf(student, index) !== 'inactive') setSelected({ student, index })
  }

  const handleValidate = async () => {
    if (!selected || saving) return
    setSaving(true)
    setError('')
    try {
      const { student, index } = selected
      const month = monthDate(index)
      const amount = student.du_mois || 0
      const { error: err } = await supabase
        .from('student_payments')
        .upsert(
          {
            student_id: student.id,
            month,
            amount,
            status: 'paid',
            paid_at: new Date().toISOString(),
            paid_by: user?.id || null,
          },
          { onConflict: 'student_id,month' }
        )
      if (err) throw err
      setPaymentsByStudent((prev) => ({
        ...prev,
        [student.id]: [
          ...(prev[student.id] || []).filter((p) => p.month !== month),
          { month, amount, status: 'paid', paid_at: new Date().toISOString(), paid_by: user?.id || null },
        ],
      }))
      invalidateFeesCache()
      setReceipt({ student: { ...student, du_mois: amount }, month: MONTHS[index], catalog })
      setSelected(null)
    } catch (err) {
      console.error(err)
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const openEdit = (student) => {
    setEditing({
      ...student,
      chosen: [...student.chosen],
      subjectDetails: { ...(student.subjectDetails || {}) },
    })
  }

  const toggleSubject = (subject) =>
    setEditing((e) => ({
      ...e,
      chosen: e.chosen.includes(subject) ? e.chosen.filter((s) => s !== subject) : [...e.chosen, subject],
      subjectDetails: {
        ...e.subjectDetails,
        [subject]: e.subjectDetails?.[subject] || { teacher: '', group: '', priceType: 'standard', manualPrice: '' },
      },
    }))

  const setSubjectDetails = (subject, changes) =>
    setEditing((e) => ({ ...e, subjectDetails: { ...e.subjectDetails, [subject]: { ...e.subjectDetails?.[subject], ...changes } } }))

  const editTotal = useMemo(() => {
    if (!editing || !catalog) return 0
    return editing.chosen.reduce((sum, name) => {
      const details = editing.subjectDetails?.[name] || {}
      const value =
        details.priceType === 'manual'
          ? Number(details.manualPrice || 0)
          : priceFor(catalog, editing, name, details)
      return sum + (Number.isFinite(value) ? value : 0)
    }, 0)
  }, [editing, catalog])

  const availableSubjects = useMemo(() => {
    if (!editing || !catalog) return []
    const tariffSubjectIds = new Set(Object.keys(catalog.tariffsByLevelSubject?.[editing.level_id] || {}))
    return catalog.subjects
      .filter((s) => tariffSubjectIds.has(s.id) || editing.chosen.includes(s.name))
      .map((s) => s.name)
  }, [editing, catalog])

  const saveEdit = async () => {
    if (!editing || saving) return
    setSaving(true)
    setError('')
    try {
      await syncSubscriptions(
        editing.id,
        { chosen: editing.chosen, subjectDetails: editing.subjectDetails, level: editing.level },
        catalog
      )
      await supabase.from('students').update({ du_mois: editTotal }).eq('id', editing.id)
      await load()
      invalidateFeesCache()
      setEditing(null)
    } catch (err) {
      console.error(err)
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (receipt) return <Receipt {...receipt} close={() => setReceipt(null)} />

  return (
    <div className="fees-page">
      <Header />
      <main className="fees-content">
        <div className="fees-heading">
          <h1>Comptabilité</h1>
          <p>Gestion financière du centre.</p>
        </div>
        <nav className="accounting-tabs">
          <Link className="active" to="/accounting/fees">Frais de scolarité</Link>
          <Link to="/accounting/delinquencies">Retards & Impayés</Link>
          <button>Salaires Profs</button>
          <button>Charges</button>
          <button>Bénéfice net</button>
        </nav>
        <section className="fee-stats">
          <article><span>Total encaissé</span><strong>{stats.totalCollected.toLocaleString('fr-FR')} DH</strong></article>
          <article><span>Élèves facturés</span><strong>{stats.billed}</strong></article>
          <article><span>Dû mensuel total</span><strong>{stats.dueTotal.toLocaleString('fr-FR')} DH</strong></article>
        </section>
        {error && <div className="fees-error">Erreur : {error}</div>}
        <label className="fees-search">
          <Icon name="search" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher un élève..." />
        </label>
        {loading ? (
          <div className="fees-loading">Chargement des frais de scolarité...</div>
        ) : (
          <div className="fees-table-wrap">
            <table className="fees-table">
              <thead>
                <tr>
                  <th>Élève</th>
                  <th>Niveau</th>
                  <th>Matières</th>
                  <th>Dû/mois</th>
                  {MONTHS.map((m) => <th key={m}>{m}</th>)}
                  <th aria-label="Modifier" />
                </tr>
              </thead>
              <tbody>
                {shown.map((student) => (
                  <tr key={student.id}>
                    <td>
                      <div className="fee-student">
                        <i>{initials(student.name)}</i>
                        <span><b>{student.name}</b><small>{student.code}</small></span>
                      </div>
                    </td>
                    <td>{student.level}</td>
                    <td>{student.chosen.length}</td>
                    <td><b>{student.du_mois.toLocaleString('fr-FR')} DH</b></td>
                    {MONTHS.map((_, index) => (
                      <td key={index}>
                        <button
                          aria-label={`${MONTHS[index]} : ${stateOf(student, index)}`}
                          className={`payment-dot ${stateOf(student, index)}`}
                          disabled={stateOf(student, index) === 'inactive'}
                          onClick={() => openPayment(student, index)}
                        />
                      </td>
                    ))}
                    <td>
                      <button className="fee-edit" onClick={() => openEdit(student)}><Icon name="pencil" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {selected && (
        <div className="fee-overlay">
          <section className="payment-modal">
            <button className="modal-close" onClick={() => setSelected(null)}>×</button>
            <h2>Paiement — {MONTHS[selected.index]}</h2>
            <div className="payment-person">
              <i>{initials(selected.student.name)}</i>
              <span><b>{selected.student.name}</b><small>{selected.student.code}</small></span>
            </div>
            <div className="payment-amount">
              <span>Montant dû</span>
              <strong>{selected.student.du_mois.toLocaleString('fr-FR')} DH</strong>
            </div>
            {stateOf(selected.student, selected.index) === 'paid' ? (
              <>
                <div className="validated">✓ Paiement validé</div>
                <button
                  className="receipt-button"
                  onClick={() => {
                    setReceipt({ student: selected.student, month: MONTHS[selected.index], catalog })
                    setSelected(null)
                  }}
                >
                  ▣ &nbsp; Imprimer le reçu
                </button>
              </>
            ) : (
              <button className="validate-button" disabled={saving} onClick={handleValidate}>
                {saving ? 'Enregistrement...' : 'Valider le paiement'}
              </button>
            )}
          </section>
        </div>
      )}

      {editing && (
        <div className="fee-overlay">
          <section className="edit-modal">
            <button className="modal-close" onClick={() => setEditing(null)}>×</button>
            <h2>Modifier les matières & groupes</h2>
            <p>{editing.name} — sélectionnez les matières auxquelles l'élève est inscrit.</p>
            <div className="edit-subjects">
              {availableSubjects.map((subject) => {
                const isSelected = editing.chosen.includes(subject)
                const details = editing.subjectDetails?.[subject] || { teacher: '', group: '', priceType: 'standard', manualPrice: '' }
                return (
                  <article key={subject} className={isSelected ? 'selected' : ''}>
                    <label className="edit-subject-toggle">
                      <input type="checkbox" checked={isSelected} onChange={() => toggleSubject(subject)} />
                      <span>
                        <b>{subject}</b>
                        <small>{priceFor(catalog, editing, subject, details).toLocaleString('fr-FR')} DH/mois</small>
                      </span>
                    </label>
                    {isSelected && (
                      <div className="edit-subject-details">
                        <label>
                          Professeur
                          <select value={details.teacher} onChange={(e) => setSubjectDetails(subject, { teacher: e.target.value })}>
                            <option value="">Choisir un professeur</option>
                            {(catalog.teachers || []).map((teacher) => (
                              <option key={teacher.id} value={teacher.name}>{teacher.name}</option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Groupe
                          <select value={details.group} onChange={(e) => setSubjectDetails(subject, { group: e.target.value })}>
                            <option value="">Choisir un groupe</option>
                            {(catalog.groupsBySubject?.[subject] || []).map((group) => (
                              <option key={group.id} value={group.name}>{group.name}</option>
                            ))}
                          </select>
                        </label>
                        <fieldset>
                          <legend>Tarification</legend>
                          <label className={details.priceType === 'standard' ? 'active' : ''}>
                            <input
                              type="radio"
                              name={`${subject}-price`}
                              checked={details.priceType === 'standard'}
                              onChange={() => setSubjectDetails(subject, { priceType: 'standard' })}
                            />
                            <span><b>Prix standard</b><small>{priceFor(catalog, editing, subject, { ...details, priceType: 'standard' }).toLocaleString('fr-FR')} DH/mois</small></span>
                          </label>
                          <label className={details.priceType === 'manual' ? 'active' : ''}>
                            <input
                              type="radio"
                              name={`${subject}-price`}
                              checked={details.priceType === 'manual'}
                              onChange={() => setSubjectDetails(subject, { priceType: 'manual' })}
                            />
                            <span>
                              <b>Prix manuel</b>
                              <input
                                type="number"
                                min="0"
                                placeholder="Montant DH"
                                disabled={details.priceType !== 'manual'}
                                value={details.manualPrice}
                                onChange={(e) => setSubjectDetails(subject, { manualPrice: e.target.value })}
                              />
                            </span>
                          </label>
                        </fieldset>
                      </div>
                    )}
                  </article>
                )
              })}
            </div>
            <div className="edit-total">
              <span>Total dû / mois</span>
              <strong>{editTotal.toLocaleString('fr-FR')} DH</strong>
            </div>
            <footer>
              <button onClick={() => setEditing(null)}>Annuler</button>
              <button className="validate-button" disabled={saving} onClick={saveEdit}>
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </footer>
          </section>
        </div>
      )}
    </div>
  )
}
