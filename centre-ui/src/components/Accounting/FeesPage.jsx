import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Header from '../shared/Header'
import Icon from '../Icon'
import { supabase } from '../../supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { exportToPdf, safeFilename } from '../../utils/exportToPdf'
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
import './Receipt.css'

function AdvanceModal({ student, close, onValidate }) {
  const [selectedMonths, setSelectedMonths] = useState([])

  const unpaidMonths = student.payments
    .map((status, index) => ({ month: MONTHS[index], index, status }))
    .filter((item) => item.status === 'unpaid')

  const paidMonths = student.payments
    .map((status, index) => ({ month: MONTHS[index], index, status }))
    .filter((item) => item.status === 'paid')

  const toggleMonth = (index) => {
    setSelectedMonths((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    )
  }

  const totalAmount = selectedMonths.length * student.monthly

  const handleValidate = () => {
    onValidate(selectedMonths)
    close()
  }

  return (
    <div className="fee-overlay">
      <section className="payment-modal">
        <button className="modal-close" onClick={close}>×</button>
        <h2>Avance de paiement</h2>
        <div className="payment-person">
          <i>{initials(student.name)}</i>
          <span>
            <b>{student.name}</b>
            <small>{student.code}</small>
          </span>
        </div>
        <div className="payment-amount">
          <span>Montant dû/mois</span>
          <strong>{student.monthly} DH</strong>
        </div>

        <div className="advance-months-selection">
          <h3>Mois à payer</h3>
          <div className="advance-months-grid">
            {unpaidMonths.map(({ month, index }) => (
              <label key={index} className="advance-month-checkbox">
                <input
                  type="checkbox"
                  checked={selectedMonths.includes(index)}
                  onChange={() => toggleMonth(index)}
                />
                <span>{month}</span>
              </label>
            ))}
          </div>

          <h3>Mois déjà payés</h3>
          <div className="advance-months-grid">
            {paidMonths.map(({ month, index }) => (
              <label key={index} className="advance-month-checkbox disabled">
                <input type="checkbox" disabled />
                <span>{month}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="advance-total">
          <span>Total à payer</span>
          <strong>{totalAmount} DH</strong>
        </div>

        <div className="advance-actions">
          <button className="advance-cancel" onClick={close}>Annuler</button>
          <button
            className="validate-button"
            onClick={handleValidate}
            disabled={selectedMonths.length === 0}
          >
            Valider l'avance
          </button>
        </div>
      </section>
    </div>
  )
}

function Receipt({ receipts, close, catalog }) {
  const receiptRefs = useRef([])
  const [isExporting, setIsExporting] = useState(false)

  const allReceipts = useMemo(() => {
    const list = Array.isArray(receipts) ? receipts : [receipts]
    return list.map((r) => ({
      month: r.month,
      student: r.student,
      lines: studentLineItems(r.student, catalog),
      total: r.student.du_mois || 0,
    }))
  }, [receipts, catalog])

  const downloadPdf = async (receipt = allReceipts[0], receiptIndex = 0) => {
    setIsExporting(true)
    try {
      await exportToPdf(
        receiptRefs.current[receiptIndex],
        `recu-paiement-${safeFilename(receipt.student.name)}-${safeFilename(receipt.month)}.pdf`
      )
    } catch (err) {
      console.error(err)
    } finally {
      setIsExporting(false)
    }
  }

  const handleDownloadAll = async () => {
    setIsExporting(true)
    try {
      for (const [index, receipt] of allReceipts.entries()) {
        await exportToPdf(
          receiptRefs.current[index],
          `recu-paiement-${safeFilename(receipt.student.name)}-${safeFilename(receipt.month)}.pdf`
        )
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <main className="fee-receipt">
      <div className="fee-receipt-actions">
        <button onClick={close}>← Retour</button>
        {allReceipts.length > 1 ? (
          <button className="fee-print" disabled={isExporting} onClick={handleDownloadAll}>
            {isExporting ? 'Génération des PDF…' : '▣  Télécharger tous les reçus'}
          </button>
        ) : (
          <button className="fee-print" disabled={isExporting} onClick={() => downloadPdf()}>
            {isExporting ? 'Génération du PDF…' : '▣  Télécharger le reçu'}
          </button>
        )}
      </div>

      <div className="fee-receipts">
        {allReceipts.map((receipt, index) => (
          <article
            key={index}
            ref={(element) => {
              receiptRefs.current[index] = element
            }}
            className="fee-document"
          >
            <header>
              <div className="fee-brand">
                <img src="/oskar-logo.png" alt="Logo Centre Atlas" />
                <div>
                  <strong>Centre Atlas</strong>
                  <span>Cours particuliers — Casablanca</span>
                </div>
              </div>
              <div className="fee-ref">
                <span>REÇU DE PAIEMENT MENSUEL</span>
                <b>{receipt.student.code}</b>
                <small>Date : {new Intl.DateTimeFormat('fr-MA').format(new Date())}</small>
              </div>
            </header>

            <section className="fee-receipt-student">
              <div>{initials(receipt.student.name)}</div>
              <p>
                <strong>{receipt.student.name}</strong>
                <small>Niveau : {receipt.student.level}</small>
                <small>Mois réglé : {receipt.month}</small>
              </p>
            </section>

            <section className="fee-lines">
              <h2>Détail des matières</h2>
              <div className="fee-line fee-line-head">
                <span>Matière</span>
                <span>Prix</span>
              </div>
              {receipt.lines.map((line) => (
                <div className="fee-line" key={line.name}>
                  <span>{line.name}</span>
                  <span>{line.amount.toLocaleString('fr-FR')} DH</span>
                </div>
              ))}
              <div className="fee-total">
                <b>Montant total payé</b>
                <strong>{receipt.total.toLocaleString('fr-FR')} DH</strong>
              </div>
            </section>

            <div className="fee-confirmation">
              ✓ Paiement reçu en espèces — Le {new Intl.DateTimeFormat('fr-MA').format(new Date())}
            </div>

            <footer>
              <span>Signature parent/tuteur</span>
              <span>Signature administration</span>
            </footer>
          </article>
        ))}
      </div>
    </main>
  )
}

function AdvanceReceiptsModal({ receipts, close, onPrint }) {
  const student = receipts[0]?.student

  if (!student) return null

  return (
    <div className="fee-overlay">
      <section className="advance-receipts-modal" role="dialog" aria-modal="true" aria-labelledby="advance-receipts-title">
        <button className="modal-close" onClick={close} aria-label="Fermer">×</button>
        <h2 id="advance-receipts-title">Paiement d'avance</h2>
        <div className="payment-person">
          <i>{initials(student.name)}</i>
          <span><b>{student.name}</b><small>{student.code}</small></span>
          <strong className="advance-monthly-amount"><small>Dû / mois</small>{student.du_mois} DH</strong>
        </div>
        <div className="validated">✓ Avance validée — {receipts.length} reçu{receipts.length > 1 ? 's générés' : ' généré'}</div>
        <div className="advance-receipt-list">
          {receipts.map((item) => (
            <div className="advance-receipt-item" key={item.month}>
              <span>Reçu — {item.month} · {item.student.du_mois} DH</span>
              <button onClick={() => onPrint(item)}>▣ <b>Imprimer</b></button>
            </div>
          ))}
        </div>
        <footer className="advance-receipts-actions">
          <button className="advance-cancel" onClick={close}>Fermer</button>
          <button className="fee-print" onClick={() => onPrint(receipts)}>▣ &nbsp; Imprimer tous les reçus</button>
        </footer>
      </section>
    </div>
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
  const [advance, setAdvance] = useState(null)
  const [advanceReceipts, setAdvanceReceipts] = useState(null)
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

  const paymentsOf = (student) => MONTHS.map((_, index) => stateOf(student, index))

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

  const validateAdvance = async (selectedMonths) => {
    if (!advance || saving) return
    setSaving(true)
    setError('')
    try {
      const student = advance
      const rows = selectedMonths.map((index) => ({
        student_id: student.id,
        month: monthDate(index),
        amount: student.du_mois || 0,
        status: 'paid',
        paid_at: new Date().toISOString(),
        paid_by: user?.id || null,
      }))
      const { error: err } = await supabase
        .from('student_payments')
        .upsert(rows, { onConflict: 'student_id,month' })
      if (err) throw err
      setPaymentsByStudent((prev) => {
        const next = { ...prev }
        for (const row of rows) {
          next[student.id] = [
            ...(next[student.id] || []).filter((p) => p.month !== row.month),
            { month: row.month, amount: row.amount, status: 'paid', paid_at: row.paid_at, paid_by: row.paid_by },
          ]
        }
        return next
      })
      invalidateFeesCache()
      const generatedReceipts = selectedMonths.map((index) => ({
        student: { ...student, du_mois: student.du_mois || 0 },
        month: MONTHS[index],
      }))
      setAdvance(null)
      setAdvanceReceipts(generatedReceipts)
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

  if (receipt) return <Receipt receipts={receipt} close={() => setReceipt(null)} catalog={catalog} />

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
          <Link to="/accounting/salaries">Salaires Profs</Link>
          <Link to="/accounting/expenses">Charges</Link>
          <Link to="/accounting/profit">Bénéfice net</Link>
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
                  <th aria-label="Actions" />
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
                      <div className="fee-actions">
                        <button className="fee-edit" onClick={() => openEdit(student)}><Icon name="pencil" /></button>
                        <button className="fee-advance" onClick={() => setAdvance(student)} title="Paiement d'avance"><Icon name="advance" /></button>
                      </div>
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

      {advance && (
        <AdvanceModal
          student={{ ...advance, payments: paymentsOf(advance), monthly: advance.du_mois }}
          close={() => setAdvance(null)}
          onValidate={validateAdvance}
        />
      )}
      {advanceReceipts && (
        <AdvanceReceiptsModal
          receipts={advanceReceipts}
          close={() => setAdvanceReceipts(null)}
          onPrint={(items) => {
            setAdvanceReceipts(null)
            setReceipt(items)
          }}
        />
      )}
    </div>
  )
}
