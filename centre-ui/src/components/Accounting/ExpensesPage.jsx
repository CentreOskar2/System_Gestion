import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bot, Coins, Hand } from 'lucide-react'
import Header from '../shared/Header'
import Icon from '../Icon'
import { supabase } from '../../supabaseClient'
import { useBranch } from '../../context/BranchContext'
import { useAuth } from '../../context/AuthContext'
import { calendarMonthOptions, currentMonthKey, formatShortDate, schoolYearOptions } from './monthUtils'
import { fetchTeacherSalaries } from './salariesApi'
import './ExpensesPage.css'

const formatAmount = (amount) => `${Number(amount || 0).toLocaleString('fr-FR')} DH`

const TYPE_LABELS = { Auto: 'Auto', Manuel: 'Manuel', recurring_fixed: 'Fixe récurrente' }

// La paie ne regarde que la direction : un secrétaire gère les charges du
// centre sans jamais voir ce que gagnent les professeurs, fixe ou pourcentage.
const SALARY_ROLES = ['super_admin', 'admin', 'director']

function defaultFilters() {
  const key = currentMonthKey()
  return {
    month: String(Number(key.slice(5, 7))),
    year: String(key.slice(0, 4)),
  }
}

export default function ExpensesPage() {
  const { selectedBranch } = useBranch()
  const { role } = useAuth()
  const canSeeSalaries = SALARY_ROLES.includes(role)
  const [tab, setTab] = useState('charges')
  const [expenses, setExpenses] = useState([])
  const [recurringCharges, setRecurringCharges] = useState([])
  const [branches, setBranches] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(null)
  const [recurringForm, setRecurringForm] = useState(null)
  const initialFilters = useMemo(() => defaultFilters(), [])
  const [filterMonth, setFilterMonth] = useState(initialFilters.month)
  const [filterYear, setFilterYear] = useState(initialFilters.year)
  const monthOptions = useMemo(() => calendarMonthOptions(), [])
  const yearOptions = useMemo(() => schoolYearOptions(), [])

  const branchFilter = selectedBranch && selectedBranch !== 'all' ? selectedBranch : null

  // Mois sur lequel porte la paie affichée : celui du filtre, ou le mois réel
  // quand aucun mois n'est filtré. Un salaire au pourcentage se recalcule mois
  // par mois, il ne peut donc pas rester collé au mois en cours.
  const salaryMonth = useMemo(() => {
    const monthNumber = Number(filterMonth)
    const yearStart = Number(filterYear)
    if (!monthNumber || !yearStart) return currentMonthKey()
    // L'année scolaire démarre en septembre : janvier–août tombent l'année civile suivante.
    const calendarYear = yearStart + (monthNumber < 9 ? 1 : 0)
    return `${calendarYear}-${String(monthNumber).padStart(2, '0')}-01`
  }, [filterMonth, filterYear])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    // Rattrape les mois manquants des charges fixes (loyer, wifi…) avant de
    // lire la table : une charge récurrente doit réapparaître chaque mois, et
    // rien côté serveur ne la génère — pg_cron n'est pas activé.
    const { error: recurringError } = await supabase.rpc('generate_recurring_charges')
    if (recurringError) console.error(recurringError)
    let expensesQuery = supabase.from('expenses').select('*').order('charge_date', { ascending: false })
    let recurringQuery = supabase.from('recurring_charges').select('*').order('created_at', { ascending: false })
    if (branchFilter) {
      expensesQuery = expensesQuery.eq('branch_id', branchFilter)
      recurringQuery = recurringQuery.eq('branch_id', branchFilter)
    }
    const [branchesRes, expensesRes, recurringRes] = await Promise.all([
      supabase.from('branches').select('id, name').order('name'),
      expensesQuery,
      recurringQuery,
    ])
    const loadError = [branchesRes.error, expensesRes.error, recurringRes.error].find(Boolean)
    if (loadError) {
      setError(`Impossible de charger les charges : ${loadError.message}`)
      setLoading(false)
      return
    }
    const branchMap = Object.fromEntries((branchesRes.data || []).map((b) => [b.id, b.name]))
    setBranches(branchesRes.data || [])
    setRecurringCharges((recurringRes.data || []).map((r) => ({ ...r, branch: branchMap[r.branch_id] || '—' })))

    const rows = expensesRes.data || []
    const persisted = rows.map((e) => ({
      id: e.id,
      title: e.title,
      amount: Number(e.amount),
      month: e.month,
      charge_date: e.charge_date || e.month,
      branch: branchMap[e.branch_id] || '—',
      branch_id: e.branch_id,
      teacher_id: e.teacher_id,
      recurring_charge_id: e.recurring_charge_id,
      type: e.type,
      // Une charge rattachée à un professeur est un salaire validé : son
      // montant a été figé ce jour-là et fait foi pour ce mois.
      isSalary: Boolean(e.teacher_id),
    }))

    // Salaires du mois consulté qui restent à valider — le fixe comme le
    // pourcentage. Le pourcentage est recalculé à chaque ouverture de la page :
    // une inscription ou une désactivation en fin de mois le fait bouger.
    let pending = []
    if (canSeeSalaries) {
      try {
        const { teachers } = await fetchTeacherSalaries({ month: salaryMonth, branchId: branchFilter })
        const alreadyValidated = new Set(
          rows.filter((e) => e.teacher_id && e.month === salaryMonth).map((e) => e.teacher_id)
        )
        pending = teachers
          .filter((t) => !alreadyValidated.has(t.id) && t.amount > 0)
          .map((t) => ({
            id: `auto-${t.id}`,
            title: `Salaire ${t.paymentType === 'fixe' ? 'fixe' : 'pourcentage'} – ${t.name}`,
            amount: t.amount,
            month: salaryMonth,
            charge_date: salaryMonth,
            branch: branchMap[t.branch_id] || '—',
            branch_id: t.branch_id,
            teacher_id: t.id,
            type: 'Auto',
            isSalary: true,
            pending: true,
          }))
      } catch (salaryError) {
        setError(`Charges affichées sans les salaires en attente : ${salaryError.message}`)
      }
    }

    setExpenses(canSeeSalaries ? [...pending, ...persisted] : persisted.filter((item) => !item.isSalary))
    setLoading(false)
  }, [branchFilter, canSeeSalaries, salaryMonth])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      await load()
      if (cancelled) return
    }
    run()
    return () => { cancelled = true }
  }, [load])

  const filteredExpenses = useMemo(() => {
    return expenses.filter((item) => {
      const date = item.charge_date
      if (!date) return true
      if (filterMonth && Number(date.slice(5, 7)) !== Number(filterMonth)) return false
      if (filterYear) {
        const yearStart = Number(filterYear)
        const schoolStart = `${yearStart}-09-01`
        const schoolEnd = `${yearStart + 1}-08-31`
        if (date < schoolStart || date > schoolEnd) return false
      }
      return true
    })
  }, [expenses, filterMonth, filterYear])

  const totals = useMemo(
    () => ({
      auto: filteredExpenses.filter((item) => item.type === 'Auto').reduce((sum, item) => sum + item.amount, 0),
      manual: filteredExpenses.filter((item) => item.type !== 'Auto').reduce((sum, item) => sum + item.amount, 0),
    }),
    [filteredExpenses]
  )

  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }))

  const save = async () => {
    if (!form.title.trim() || !Number(form.amount) || !form.charge_date) return
    setSaving(true)
    setError(null)
    const isAuto = form.type === 'Auto'
    const monthKey = `${form.charge_date.slice(0, 7)}-01`
    const basePayload = {
      title: form.title.trim(),
      amount: Number(form.amount),
      month: monthKey,
      charge_date: form.charge_date,
      branch_id: form.branch_id || null,
      ...(form.teacher_id ? { teacher_id: form.teacher_id } : {}),
    }
    try {
      if (form.id) {
        const { error: updateError } = await supabase.from('expenses').update({ ...basePayload, type: isAuto ? 'Auto' : form.type }).eq('id', form.id)
        if (updateError) throw updateError
      if (isAuto && form.teacher_id) {
          const { error: salaryError } = await supabase.from('teacher_salaries').upsert(
          { teacher_id: form.teacher_id, month: monthKey, amount: basePayload.amount, status: 'paid' },
          { onConflict: 'teacher_id,month' }
        )
          if (salaryError) throw salaryError
        }
      } else if (form.recurring) {
        const { error: templateError } = await supabase
          .from('recurring_charges')
          .insert({
            label: form.title.trim(),
            amount: Number(form.amount),
            branch_id: form.branch_id || null,
            day_of_month: Number(form.charge_date.slice(8, 10)),
            status: 'active',
          })
        if (templateError) throw templateError
        // La charge du mois est produite par le générateur, pas ici : il est
        // seul à savoir quels mois restent à créer, et évite ainsi le doublon.
        const { error: generateError } = await supabase.rpc('generate_recurring_charges')
        if (generateError) throw generateError
      } else {
        const { error: insertError } = await supabase.from('expenses').insert({ ...basePayload, type: 'Manuel' })
        if (insertError) throw insertError
      }
      setForm(null)
      await load()
    } catch (saveError) {
      setError(`Impossible d'enregistrer la charge : ${saveError.message || 'erreur inconnue'}`)
    } finally {
      setSaving(false)
    }
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
      await supabase.from('teacher_salaries').update({ status: 'pending' }).eq('teacher_id', item.teacher_id).eq('month', item.month)
    }
    load()
  }

  const openAdd = () =>
    setForm({
      title: '',
      amount: '',
      charge_date: new Date().toISOString().slice(0, 10),
      branch_id: branchFilter || branches[0]?.id || '',
      recurring: false,
    })

  const openAddRecurring = () =>
    setForm({
      title: '',
      amount: '',
      charge_date: new Date().toISOString().slice(0, 10),
      branch_id: branchFilter || branches[0]?.id || '',
      recurring: true,
    })

  const saveRecurring = async () => {
    if (!recurringForm.label.trim() || !Number(recurringForm.amount)) return
    setSaving(true)
    const payload = {
      label: recurringForm.label.trim(),
      amount: Number(recurringForm.amount),
      day_of_month: Math.min(28, Math.max(1, Number(recurringForm.day_of_month) || 1)),
      branch_id: recurringForm.branch_id || null,
      status: recurringForm.status,
    }
    await supabase.from('recurring_charges').update(payload).eq('id', recurringForm.id)
    setSaving(false)
    setRecurringForm(null)
    load()
  }

  const toggleRecurringStatus = async (item) => {
    const nextStatus = item.status === 'active' ? 'inactive' : 'active'
    const payload = { status: nextStatus }
    if (nextStatus === 'active') {
      // Une charge qu'on réactive repart du mois en cours : les mois pendant
      // lesquels elle était suspendue n'ont pas à être facturés après coup.
      const now = new Date()
      const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      payload.generated_through = `${previousMonth.getFullYear()}-${String(previousMonth.getMonth() + 1).padStart(2, '0')}-01`
    }
    await supabase.from('recurring_charges').update(payload).eq('id', item.id)
    load()
  }

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
        {error && <p className="expenses-error" role="alert">{error}</p>}
        <section className="expense-stats">
          <article>
            <span>Total des charges</span>
            <strong>{formatAmount(totals.auto + totals.manual)}</strong>
            <i className="red"><Coins size={22} /></i>
          </article>
          <article>
            <span>Charges automatiques</span>
            <strong>{formatAmount(totals.auto)}</strong>
            <i><Bot size={22} /></i>
          </article>
          <article>
            <span>Charges manuelles</span>
            <strong>{formatAmount(totals.manual)}</strong>
            <i><Hand size={22} /></i>
          </article>
        </section>

        <nav className="expenses-subtabs">
          <button className={tab === 'charges' ? 'active' : ''} onClick={() => setTab('charges')}>Charges</button>
          <button className={tab === 'recurring' ? 'active' : ''} onClick={() => setTab('recurring')}>Charges fixes récurrentes</button>
        </nav>

        {tab === 'charges' ? (
          <>
            <div className="expenses-actions">
              <div className="expense-filters">
                <label className="expense-month">
                  <span>Mois</span>
                  <select value={filterMonth} onChange={(event) => setFilterMonth(event.target.value)}>
                    <option value="">Tous les mois</option>
                    {monthOptions.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </label>
                <label className="expense-month">
                  <span>Année</span>
                  <select value={filterYear} onChange={(event) => setFilterYear(event.target.value)}>
                    <option value="">Toutes les années</option>
                    {yearOptions.map((y) => (
                      <option key={y.value} value={y.value}>{y.label}</option>
                    ))}
                  </select>
                </label>
              </div>
              <button onClick={openAdd}>＋ &nbsp; Ajouter une charge manuelle</button>
            </div>
            <section className="expenses-table-wrap">
              <table className="expenses-table">
                <thead>
                  <tr>
                    <th>Intitulé</th>
                    <th>Montant</th>
                    <th>Date</th>
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
                  ) : filteredExpenses.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="expense-empty">Aucune charge enregistrée.</td>
                    </tr>
                  ) : (
                    filteredExpenses.map((item) => (
                      <tr key={item.id}>
                        <td><b>{item.title}</b></td>
                        <td>{formatAmount(item.amount)}</td>
                        <td>{formatShortDate(item.charge_date)}</td>
                        <td>{item.branch}</td>
                        <td>
                          <span className={`expense-type ${item.type === 'Auto' ? 'auto' : item.type === 'recurring_fixed' ? 'recurring' : ''}`}>
                            {TYPE_LABELS[item.type] || item.type}
                          </span>
                          {item.pending && (
                            <span
                              className="expense-pending"
                              title="Salaire pas encore validé. Un salaire au pourcentage évolue jusqu'à la fin du mois, au fil des inscriptions et des désactivations."
                            >
                              En attente
                            </span>
                          )}
                        </td>
                        <td>
                          <div className="expense-row-actions">
                            {!String(item.id).startsWith('auto-') && (
                              <>
                                <button
                                  title="Modifier"
                                  aria-label={`Modifier ${item.title}`}
                                  onClick={() => setForm({ ...item, charge_date: item.charge_date, amount: String(item.amount) })}
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
          </>
        ) : (
          <>
            <div className="expenses-actions">
              <button onClick={openAddRecurring}>＋ &nbsp; Ajouter une charge fixe récurrente</button>
            </div>
            <section className="expenses-table-wrap">
              <table className="expenses-table">
                <thead>
                  <tr>
                    <th>Intitulé</th>
                    <th>Montant</th>
                    <th>Jour du mois</th>
                    <th>Succursale</th>
                    <th>Statut</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="expense-empty">Chargement...</td>
                    </tr>
                  ) : recurringCharges.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="expense-empty">Aucune charge fixe récurrente. Ajoutez-en une pour qu'elle se recrée chaque mois automatiquement.</td>
                    </tr>
                  ) : (
                    recurringCharges.map((item) => (
                      <tr key={item.id}>
                        <td><b>{item.label}</b></td>
                        <td>{formatAmount(item.amount)}</td>
                        <td>Le {item.day_of_month}</td>
                        <td>{item.branch}</td>
                        <td>
                          <span className={item.status === 'active' ? 'recurring-status active' : 'recurring-status'}>
                            {item.status === 'active' ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td>
                          <div className="expense-row-actions">
                            <button
                              title="Modifier"
                              aria-label={`Modifier ${item.label}`}
                              onClick={() => setRecurringForm({ ...item, amount: String(item.amount) })}
                            >
                              <Icon name="edit" />
                            </button>
                            <button
                              title={item.status === 'active' ? 'Désactiver' : 'Activer'}
                              aria-label={item.status === 'active' ? `Désactiver ${item.label}` : `Activer ${item.label}`}
                              onClick={() => toggleRecurringStatus(item)}
                            >
                              <Icon name={item.status === 'active' ? 'ban' : 'power'} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </section>
          </>
        )}
      </main>
      {form && (
        <div className="expense-overlay" onMouseDown={() => setForm(null)}>
          <section className="expense-modal" onMouseDown={(event) => event.stopPropagation()}>
            <button className="expense-close" onClick={() => setForm(null)}>×</button>
            <h2>{form.id ? 'Modifier la charge' : form.recurring ? 'Ajouter une charge fixe récurrente' : 'Ajouter une charge manuelle'}</h2>
            <label>
              Intitulé
              <input value={form.title} onChange={update('title')} autoFocus placeholder="ex : Loyer" />
            </label>
            <label>
              Montant (DH)
              <input type="number" min="0" value={form.amount} onChange={update('amount')} />
            </label>
            <label>
              Date
              <input type="date" value={form.charge_date} onChange={update('charge_date')} />
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
            {!form.id && form.type !== 'Auto' && (
              <label className="expense-recurring-toggle">
                <input type="checkbox" checked={form.recurring} onChange={(e) => setForm((f) => ({ ...f, recurring: e.target.checked }))} />
                <span>Charge fixe récurrente <small>(se recrée automatiquement chaque mois avec le même montant)</small></span>
              </label>
            )}
            <footer>
              <button onClick={() => setForm(null)}>Annuler</button>
              <button onClick={save} disabled={saving}>
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </footer>
          </section>
        </div>
      )}
      {recurringForm && (
        <div className="expense-overlay" onMouseDown={() => setRecurringForm(null)}>
          <section className="expense-modal" onMouseDown={(event) => event.stopPropagation()}>
            <button className="expense-close" onClick={() => setRecurringForm(null)}>×</button>
            <h2>Modifier la charge fixe récurrente</h2>
            <label>
              Intitulé
              <input value={recurringForm.label} onChange={(e) => setRecurringForm((f) => ({ ...f, label: e.target.value }))} autoFocus />
            </label>
            <label>
              Montant (DH)
              <input type="number" min="0" value={recurringForm.amount} onChange={(e) => setRecurringForm((f) => ({ ...f, amount: e.target.value }))} />
            </label>
            <label>
              Jour du mois
              <input
                type="number"
                min="1"
                max="28"
                value={recurringForm.day_of_month}
                onChange={(e) => setRecurringForm((f) => ({ ...f, day_of_month: e.target.value }))}
              />
            </label>
            <label>
              Succursale
              <select value={recurringForm.branch_id || ''} onChange={(e) => setRecurringForm((f) => ({ ...f, branch_id: e.target.value }))}>
                <option value="">— Aucune —</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>{branch.name}</option>
                ))}
              </select>
            </label>
            <label className="expense-recurring-toggle">
              <input
                type="checkbox"
                checked={recurringForm.status === 'active'}
                onChange={(e) => setRecurringForm((f) => ({ ...f, status: e.target.checked ? 'active' : 'inactive' }))}
              />
              <span>Charge active <small>(désactivez pour arrêter les recréations futures, ex : fin de contrat)</small></span>
            </label>
            <footer>
              <button onClick={() => setRecurringForm(null)}>Annuler</button>
              <button onClick={saveRecurring} disabled={saving}>
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </footer>
          </section>
        </div>
      )}
    </div>
  )
}
