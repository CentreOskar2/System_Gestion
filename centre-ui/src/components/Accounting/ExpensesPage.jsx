import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Header from '../shared/Header'
import Icon from '../Icon'
import { supabase } from '../../supabaseClient'
import { academicMonths, currentMonthKey } from './monthUtils'
import './ExpensesPage.css'

const formatAmount = (amount) => `${Number(amount || 0).toLocaleString('fr-FR')} DH`

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState([])
  const [branches, setBranches] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(null)
  const [month, setMonth] = useState(currentMonthKey())
  const months = useMemo(() => academicMonths(), [])

  const load = useCallback(async () => {
    setLoading(true)
    const [branchesRes, expensesRes, teachersRes] = await Promise.all([
      supabase.from('branches').select('id, name').order('name'),
      supabase.from('expenses').select('*').eq('month', month).order('created_at'),
      supabase
        .from('teachers')
        .select('id, first_name, last_name, branch_id, remuneration_type, fixed_salary, remuneration_amount')
        .eq('status', 'active'),
    ])
    if (branchesRes.error || expensesRes.error || teachersRes.error) {
      setLoading(false)
      return
    }
    const branchMap = Object.fromEntries((branchesRes.data || []).map((b) => [b.id, b.name]))
    setBranches(branchesRes.data || [])

    const rows = expensesRes.data || []
    const validatedTeacherIds = new Set(rows.filter((e) => e.type === 'Auto' && e.teacher_id).map((e) => e.teacher_id))

    const auto = (teachersRes.data || [])
      .filter((t) => t.remuneration_type === 'fixe' && !validatedTeacherIds.has(t.id))
      .map((t) => ({
        id: `auto-${t.id}`,
        title: `Salaire fixe – ${`${t.first_name} ${t.last_name}`.trim()}`,
        amount: Number(t.fixed_salary || t.remuneration_amount || 0),
        month,
        branch: branchMap[t.branch_id] || '—',
        type: 'Auto',
      }))

    const persisted = rows.map((e) => ({
      id: e.id,
      title: e.title,
      amount: Number(e.amount),
      month: e.month,
      branch: branchMap[e.branch_id] || '—',
      branch_id: e.branch_id,
      teacher_id: e.teacher_id,
      type: e.type,
    }))

    setExpenses([...auto, ...persisted])
    setLoading(false)
  }, [month])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      await load()
      if (cancelled) return
    }
    run()
    return () => { cancelled = true }
  }, [load])

  const totals = useMemo(
    () => ({
      auto: expenses.filter((item) => item.type === 'Auto').reduce((sum, item) => sum + item.amount, 0),
      manual: expenses.filter((item) => item.type === 'Manuel').reduce((sum, item) => sum + item.amount, 0),
    }),
    [expenses]
  )

  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }))

  const save = async () => {
    if (!form.title.trim() || !Number(form.amount)) return
    setSaving(true)
    const isAuto = form.type === 'Auto'
    const payload = {
      title: form.title.trim(),
      amount: Number(form.amount),
      month: `${form.month}-01`,
      branch_id: form.branch_id || null,
      type: isAuto ? 'Auto' : 'Manuel',
      ...(form.teacher_id ? { teacher_id: form.teacher_id } : {}),
    }
    if (form.id) {
      await supabase.from('expenses').update(payload).eq('id', form.id)
      if (isAuto && form.teacher_id) {
        await supabase.from('teacher_salaries').upsert(
          { teacher_id: form.teacher_id, month: payload.month, amount: payload.amount, status: 'paid' },
          { onConflict: 'teacher_id,month' }
        )
      }
    } else {
      await supabase.from('expenses').insert(payload)
    }
    setSaving(false)
    setForm(null)
    load()
  }

  const remove = async (id) => {
    const item = expenses.find((i) => i.id === id)
    if (!item) return
    const message = item.type === 'Auto'
      ? `Cette charge automatique « ${item.title} » sera supprimée et le salaire repassera en attente. Continuer ?`
      : `Supprimer la charge « ${item.title} » ?`
    if (!window.confirm(message)) return
    await supabase.from('expenses').delete().eq('id', id)
    if (item.type === 'Auto' && item.teacher_id) {
      await supabase.from('teacher_salaries').update({ status: 'pending' }).eq('teacher_id', item.teacher_id).eq('month', month)
    }
    load()
  }

  const openAdd = () =>
    setForm({
      title: '',
      amount: '',
      month: month.slice(0, 7),
      branch_id: branches[0]?.id || '',
    })

  return (
    <div className="expenses-page">
      <Header />
      <main className="expenses-content">
        <div className="fees-heading">
          <h1>Comptabilité</h1>
          <p>Gestion financière du centre.</p>
        </div>
        <nav className="accounting-tabs">
          <Link to="/accounting/fees">Frais de scolarité</Link>
          <Link to="/accounting/delinquencies">Retards & Impayés</Link>
          <Link to="/accounting/salaries">Salaires Profs</Link>
          <Link className="active" to="/accounting/expenses">Charges</Link>
          <Link to="/accounting/profit">Bénéfice net</Link>
        </nav>
        <section className="expense-stats">
          <article>
            <span>Total des charges</span>
            <strong>{formatAmount(totals.auto + totals.manual)}</strong>
            <i className="red">⊘</i>
          </article>
          <article>
            <span>Charges automatiques</span>
            <strong>{formatAmount(totals.auto)}</strong>
            <i>▣</i>
          </article>
          <article>
            <span>Charges manuelles</span>
            <strong>{formatAmount(totals.manual)}</strong>
            <i>☝</i>
          </article>
        </section>
        <div className="expenses-actions">
          <label className="expense-month">
            Mois : <select value={month} onChange={(event) => setMonth(event.target.value)}>
              {months.map((m) => (
                <option key={m.key} value={m.key}>{m.label}</option>
              ))}
            </select>
          </label>
          <button onClick={openAdd}>＋ &nbsp; Ajouter une charge manuelle</button>
        </div>
        <section className="expenses-table-wrap">
          <table className="expenses-table">
            <thead>
              <tr>
                <th>Intitulé</th>
                <th>Montant</th>
                <th>Mois</th>
                <th>Succursale</th>
                <th>Type</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="expense-empty">Chargement des charges...</td>
                </tr>
              ) : expenses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="expense-empty">Aucune charge enregistrée.</td>
                </tr>
              ) : (
                expenses.map((item) => (
                  <tr key={item.id}>
                    <td><b>{item.title}</b></td>
                    <td>{formatAmount(item.amount)}</td>
                    <td>{item.month.slice(0, 7)}</td>
                    <td>{item.branch}</td>
                    <td>
                      <span className={item.type === 'Auto' ? 'expense-type auto' : 'expense-type'}>{item.type}</span>
                    </td>
                    <td>
                      <div className="expense-row-actions">
                        {!String(item.id).startsWith('auto-') && (
                          <>
                            <button
                              title="Modifier"
                              aria-label={`Modifier ${item.title}`}
                              onClick={() => setForm({ ...item, month: item.month.slice(0, 7), amount: String(item.amount) })}
                            >
                              <Icon name="edit" />
                            </button>
                            <button className="delete-expense" title="Supprimer" aria-label={`Supprimer ${item.title}`} onClick={() => remove(item.id)}>
                              <Icon name="delete" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      </main>
      {form && (
        <div className="expense-overlay" onMouseDown={() => setForm(null)}>
          <section className="expense-modal" onMouseDown={(event) => event.stopPropagation()}>
            <button className="expense-close" onClick={() => setForm(null)}>×</button>
            <h2>{form.id ? 'Modifier la charge' : 'Ajouter une charge manuelle'}</h2>
            <label>
              Intitulé
              <input value={form.title} onChange={update('title')} autoFocus />
            </label>
            <label>
              Montant (DH)
              <input type="number" min="0" value={form.amount} onChange={update('amount')} />
            </label>
            <label>
              Mois
              <input type="month" value={form.month} onChange={update('month')} />
            </label>
            <label>
              Succursale
              <select value={form.branch_id} onChange={update('branch_id')}>
                <option value="">— Aucune —</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>{branch.name}</option>
                ))}
              </select>
            </label>
            <footer>
              <button onClick={() => setForm(null)}>Annuler</button>
              <button onClick={save} disabled={saving}>
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </footer>
          </section>
        </div>
      )}
    </div>
  )
}
