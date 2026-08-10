import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Header from '../shared/Header'
import Icon from '../Icon'
import './ExpensesPage.css'

const initialExpenses = [
  { id: 1, title: 'Salaire fixe – K. El Amrani', amount: 8000, month: '2026-02', branch: 'Succursale Nord', type: 'Auto' },
  { id: 2, title: 'Salaire fixe – Y. Tazi', amount: 7000, month: '2026-02', branch: 'Succursale Sud', type: 'Auto' },
  { id: 3, title: 'Salaire fixe – O. Fassi', amount: 6500, month: '2026-02', branch: 'Succursale Nord', type: 'Auto' },
  { id: 4, title: 'Loyer', amount: 12000, month: '2026-02', branch: 'Succursale Nord', type: 'Manuel' },
  { id: 5, title: 'Loyer', amount: 9000, month: '2026-02', branch: 'Succursale Sud', type: 'Manuel' },
  { id: 6, title: 'Électricité & eau', amount: 2200, month: '2026-02', branch: 'Succursale Centre', type: 'Manuel' },
  { id: 7, title: 'Fournitures', amount: 1500, month: '2026-02', branch: 'Succursale Nord', type: 'Manuel' },
  { id: 8, title: 'Salaire secrétaire', amount: 4500, month: '2026-02', branch: 'Succursale Sud', type: 'Auto' },
]

const emptyExpense = { title: '', amount: '', month: '2026-02', branch: 'Succursale Nord' }
const formatAmount = (amount) => `${Number(amount).toLocaleString('fr-FR')} DH`

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState(initialExpenses)
  const [form, setForm] = useState(null)
  const totals = useMemo(() => ({
    auto: expenses.filter(item => item.type === 'Auto').reduce((sum, item) => sum + item.amount, 0),
    manual: expenses.filter(item => item.type === 'Manuel').reduce((sum, item) => sum + item.amount, 0),
  }), [expenses])
  const update = (field) => (event) => setForm(current => ({ ...current, [field]: event.target.value }))
  const save = () => {
    if (!form.title.trim() || !Number(form.amount)) return
    if (form.id) setExpenses(items => items.map(item => item.id === form.id ? { ...item, ...form, amount: Number(form.amount) } : item))
    else setExpenses(items => [...items, { ...form, id: crypto.randomUUID(), amount: Number(form.amount), type: 'Manuel' }])
    setForm(null)
  }

  return <div className="expenses-page"><Header /><main className="expenses-content">
    <div className="fees-heading"><h1>Comptabilité</h1><p>Gestion financière du centre.</p></div>
    <nav className="accounting-tabs">
      <Link to="/accounting/fees">Frais de scolarité</Link><Link to="/accounting/delinquencies">Retards & Impayés</Link><Link to="/accounting/salaries">Salaires Profs</Link><Link className="active" to="/accounting/expenses">Charges</Link><Link to="/accounting/profit">Bénéfice net</Link>
    </nav>
    <section className="expense-stats"><article><span>Total des charges</span><strong>{formatAmount(totals.auto + totals.manual)}</strong><i className="red"><Icon name="coins" /></i></article><article><span>Charges automatiques</span><strong>{formatAmount(totals.auto)}</strong><i><Icon name="robot" /></i></article><article><span>Charges manuelles</span><strong>{formatAmount(totals.manual)}</strong><i><Icon name="hand" /></i></article></section>
    <div className="expenses-actions"><button onClick={() => setForm({ ...emptyExpense })}>＋ &nbsp; Ajouter une charge manuelle</button></div>
    <section className="expenses-table-wrap"><table className="expenses-table"><thead><tr><th>Intitulé</th><th>Montant</th><th>Mois</th><th>Succursale</th><th>Type</th><th>Actions</th></tr></thead><tbody>{expenses.map(item => <tr key={item.id}><td><b>{item.title}</b></td><td>{formatAmount(item.amount)}</td><td>{item.month}</td><td>{item.branch}</td><td><span className={item.type === 'Auto' ? 'expense-type auto' : 'expense-type'}>{item.type}</span></td><td><div className="expense-row-actions"><button title="Modifier" aria-label={`Modifier ${item.title}`} onClick={() => setForm({ ...item, amount: String(item.amount) })}><Icon name="edit" /></button><button className="delete-expense" title="Supprimer" aria-label={`Supprimer ${item.title}`} onClick={() => setExpenses(items => items.filter(expense => expense.id !== item.id))}><Icon name="delete" /></button></div></td></tr>)}</tbody></table></section>
  </main>{form && <div className="expense-overlay" onMouseDown={() => setForm(null)}><section className="expense-modal" onMouseDown={(event) => event.stopPropagation()}><button className="expense-close" onClick={() => setForm(null)}>×</button><h2>{form.id ? 'Modifier la charge' : 'Ajouter une charge manuelle'}</h2><label>Intitulé<input value={form.title} onChange={update('title')} autoFocus /></label><label>Montant (DH)<input type="number" min="0" value={form.amount} onChange={update('amount')} /></label><label>Mois<input type="month" value={form.month} onChange={update('month')} /></label><label>Succursale<select value={form.branch} onChange={update('branch')}><option>Succursale Nord</option><option>Succursale Sud</option><option>Succursale Centre</option></select></label><footer><button onClick={() => setForm(null)}>Annuler</button><button onClick={save}>Enregistrer</button></footer></section></div>}</div>
}
