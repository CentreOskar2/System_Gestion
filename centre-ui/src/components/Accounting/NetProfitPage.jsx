import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Header from '../shared/Header'
import Icon from '../Icon'
import { supabase } from '../../supabaseClient'
import { academicYearStart } from './feesApi'
import './NetProfitPage.css'

const SUBJECT_PRICE = 500
const CHARGES_KEY = 'net_profit_charges'

const seedCharges = [
  { id: 'loyer-nord', title: 'Loyer — Succursale Nord', amount: 12000 },
  { id: 'loyer-sud', title: 'Loyer — Succursale Sud', amount: 9000 },
  { id: 'electricite', title: 'Électricité & eau', amount: 2200 },
  { id: 'fournitures', title: 'Fournitures', amount: 1500 },
]

const formatAmount = (amount) => `${Number(amount || 0).toLocaleString('fr-FR')} DH`

function loadCharges() {
  try {
    const stored = localStorage.getItem(CHARGES_KEY)
    return stored ? JSON.parse(stored) : seedCharges
  } catch {
    return seedCharges
  }
}

function computeSalary(teacher, groups) {
  if (teacher.remuneration_type === 'fixe') {
    return Number(teacher.fixed_salary) || Number(teacher.remuneration_amount) || 0
  }
  let total = 0
  for (const group of groups) {
    const rate = teacher.cycle_rates?.[group.cycleId] || 0
    total += group.studentsCount * SUBJECT_PRICE * (rate / 100)
  }
  return Math.round(total)
}

export default function NetProfitPage() {
  const [collected, setCollected] = useState(0)
  const [massSalariale, setMassSalariale] = useState(0)
  const [charges, setCharges] = useState(loadCharges)
  const [form, setForm] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const yearStart = academicYearStart()

    async function load() {
      const [paymentsRes, teachersRes, levelsRes, groupsRes, tgRes, gsRes] = await Promise.all([
        supabase.from('student_payments').select('month, amount'),
        supabase.from('teachers').select('*').eq('status', 'active'),
        supabase.from('levels').select('id, cycle_id'),
        supabase.from('groups').select('id, level_id'),
        supabase.from('teacher_group_subjects').select('teacher_id, group_id'),
        supabase.from('group_students').select('group_id, student_id'),
      ])
      if (cancelled) return

      const totalCollected = (paymentsRes.data || []).reduce((sum, p) => {
        if (p.month >= `${yearStart}-09-01` && p.month <= `${yearStart + 1}-08-31`) {
          return sum + (Number(p.amount) || 0)
        }
        return sum
      }, 0)

      const levelById = Object.fromEntries((levelsRes.data || []).map((l) => [l.id, l]))
      const groupIdsByTeacher = {}
      for (const row of tgRes.data || []) {
        if (!groupIdsByTeacher[row.teacher_id]) groupIdsByTeacher[row.teacher_id] = []
        if (!groupIdsByTeacher[row.teacher_id].includes(row.group_id)) groupIdsByTeacher[row.teacher_id].push(row.group_id)
      }
      const studentsByGroup = {}
      for (const row of gsRes.data || []) {
        if (!studentsByGroup[row.group_id]) studentsByGroup[row.group_id] = []
        studentsByGroup[row.group_id].push(row.student_id)
      }
      const groupsById = Object.fromEntries((groupsRes.data || []).map((g) => [g.id, g]))

      const salaryTotal = (teachersRes.data || []).reduce((sum, t) => {
        const groups = (groupIdsByTeacher[t.id] || [])
          .map((groupId) => {
            const group = groupsById[groupId]
            if (!group) return null
            return {
              id: group.id,
              cycleId: levelById[group.level_id]?.cycle_id,
              studentsCount: (studentsByGroup[groupId] || []).length,
            }
          })
          .filter(Boolean)
        return sum + computeSalary(t, groups)
      }, 0)

      if (!cancelled) {
        setCollected(totalCollected)
        setMassSalariale(salaryTotal)
        setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(CHARGES_KEY, JSON.stringify(charges))
    } catch {
      /* storage unavailable (private mode etc.) */
    }
  }, [charges])

  const totalCharges = useMemo(() => charges.reduce((sum, c) => sum + (Number(c.amount) || 0), 0), [charges])
  const net = collected - massSalariale - totalCharges

  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }))

  const save = () => {
    if (!form || !form.title.trim() || !Number(form.amount)) return
    if (form.id) {
      setCharges((items) => items.map((item) => (item.id === form.id ? { ...item, ...form, amount: Number(form.amount) } : item)))
    } else {
      setCharges((items) => [...items, { ...form, id: crypto.randomUUID(), amount: Number(form.amount) }])
    }
    setForm(null)
  }

  const remove = (id) => setCharges((items) => items.filter((item) => item.id !== id))

  return (
    <div className="profit-page">
      <Header />
      <main className="profit-content">
        <div className="fees-heading">
          <h1>Comptabilité</h1>
          <p>Gestion financière du centre.</p>
        </div>
        <nav className="accounting-tabs">
          <Link to="/accounting/fees">Frais de scolarité</Link>
          <Link to="/accounting/delinquencies">Retards & Impayés</Link>
          <Link to="/accounting/salaries">Salaires Profs</Link>
          <Link to="/accounting/expenses">Charges</Link>
          <Link className="active" to="/accounting/profit">Bénéfice net</Link>
        </nav>
        {loading ? (
          <div className="fees-loading">Calcul du bénéfice net...</div>
        ) : (
          <>
            <section className="profit-stats">
              <article>
                <span>CA encaissé</span>
                <strong>{formatAmount(collected)}</strong>
                <i>▣</i>
              </article>
              <article>
                <span>Masse salariale</span>
                <strong>{formatAmount(massSalariale)}</strong>
                <i>↗</i>
              </article>
              <article>
                <span>Charges du mois</span>
                <strong>{formatAmount(totalCharges)}</strong>
                <i>☝</i>
              </article>
              <article className={net >= 0 ? 'profit-net positive' : 'profit-net negative'}>
                <span>Bénéfice net</span>
                <strong>{formatAmount(net)}</strong>
                <i>{net >= 0 ? '▲' : '▼'}</i>
              </article>
            </section>

            <div className="profit-breakdown">
              <section>
                <h2>Répartition du mois</h2>
                <div className="profit-bar">
                  <div className="profit-bar-track">
                    <div className="profit-bar-collected" style={{ width: `${barPct(collected, collected, massSalariale, totalCharges)}%` }} />
                    <div className="profit-bar-salaries" style={{ width: `${barPct(massSalariale, collected, massSalariale, totalCharges)}%` }} />
                    <div className="profit-bar-charges" style={{ width: `${barPct(totalCharges, collected, massSalariale, totalCharges)}%` }} />
                  </div>
                </div>
                <div className="profit-legend">
                  <span><i className="dot collected" /> CA encaissé — {formatAmount(collected)}</span>
                  <span><i className="dot salaries" /> Masse salariale — {formatAmount(massSalariale)}</span>
                  <span><i className="dot charges" /> Charges — {formatAmount(totalCharges)}</span>
                </div>
              </section>
              <section>
                <h2>Charges du mois</h2>
                <button className="profit-add" onClick={() => setForm({ title: '', amount: '' })}>
                  ＋ &nbsp; Ajouter une charge
                </button>
              </section>
            </div>

            <section className="profit-table-wrap">
              <table className="profit-table">
                <thead>
                  <tr>
                    <th>Intitulé</th>
                    <th>Montant</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {charges.map((item) => (
                    <tr key={item.id}>
                      <td><b>{item.title}</b></td>
                      <td>{formatAmount(item.amount)}</td>
                      <td>
                        <div className="profit-row-actions">
                          <button title="Modifier" aria-label={`Modifier ${item.title}`} onClick={() => setForm({ ...item, amount: String(item.amount) })}>
                            <Icon name="edit" />
                          </button>
                          <button className="profit-delete" title="Supprimer" aria-label={`Supprimer ${item.title}`} onClick={() => remove(item.id)}>
                            <Icon name="delete" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th>Total des charges</th>
                    <th>{formatAmount(totalCharges)}</th>
                    <th />
                  </tr>
                </tfoot>
              </table>
            </section>
          </>
        )}
      </main>

      {form && (
        <div className="profit-overlay" onMouseDown={() => setForm(null)}>
          <section className="profit-modal" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setForm(null)}>×</button>
            <h2>{form.id ? 'Modifier la charge' : 'Ajouter une charge'}</h2>
            <label>
              Intitulé
              <input value={form.title} onChange={update('title')} placeholder="Ex. Loyer" autoFocus />
            </label>
            <label>
              Montant (DH)
              <input type="number" min="0" value={form.amount} onChange={update('amount')} placeholder="0" />
            </label>
            <footer>
              <button className="profit-cancel" onClick={() => setForm(null)}>Annuler</button>
              <button className="profit-save" onClick={save}>Enregistrer</button>
            </footer>
          </section>
        </div>
      )}
    </div>
  )
}

function barPct(value, ca, sal, ch) {
  const total = ca + sal + ch
  if (total <= 0) return 0
  return Math.min(100, Math.max(0, Math.round((value / total) * 100)))
}
