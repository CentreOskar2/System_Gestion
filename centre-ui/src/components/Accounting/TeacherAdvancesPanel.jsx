import { useMemo, useState } from 'react'
import Icon from '../Icon'
import { useAuth } from '../../context/AuthContext'
import { formatShortDate, monthLabelOf, normalizeMonthKey } from './monthUtils'
import { deleteTeacherAdvance, saveTeacherAdvance } from './advancesApi'

const formatAmount = (amount) => `${Number(amount || 0).toLocaleString('fr-FR')} DH`

// Mois de salaire proposés : l'année scolaire affichée (septembre → août), ou
// l'année en cours quand aucun filtre d'année n'est choisi.
function salaryMonthOptions(schoolYearStart) {
  const start = Number(schoolYearStart) || new Date().getFullYear() - (new Date().getMonth() < 8 ? 1 : 0)
  return Array.from({ length: 12 }, (_, index) => {
    const month = ((8 + index) % 12) + 1
    const year = month >= 9 ? start : start + 1
    const key = `${year}-${String(month).padStart(2, '0')}-01`
    return { value: key, label: monthLabelOf(key) }
  })
}

/* Onglet « Avances des profs » de la page Charges.
 *
 * Une avance est rattachée à un mois de salaire : elle est déduite du net à
 * verser de ce mois-là dans la page Salaires Profs et dans le journal du
 * professeur (voir salariesApi / netToPay).
 */
export default function TeacherAdvancesPanel({
  advances,
  teachers,
  missingTable,
  loading,
  validatedSalaryKeys,
  schoolYearStart,
  toolbar,
  onChanged,
}) {
  const { user } = useAuth()
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const teacherNameById = useMemo(() => Object.fromEntries(teachers.map((t) => [t.id, t.name])), [teachers])
  const monthOptions = useMemo(() => salaryMonthOptions(schoolYearStart), [schoolYearStart])

  const openAdd = () => {
    const today = new Date().toISOString().slice(0, 10)
    setForm({
      teacherId: teachers[0]?.id || '',
      amount: '',
      advanceDate: today,
      month: normalizeMonthKey(today),
      note: '',
    })
  }

  const openEdit = (advance) =>
    setForm({
      id: advance.id,
      teacherId: advance.teacher_id,
      amount: String(advance.amount),
      advanceDate: advance.advance_date,
      month: normalizeMonthKey(advance.month),
      note: advance.note || '',
    })

  const update = (field) => (event) => {
    const value = event.target.value
    setForm((current) => {
      const next = { ...current, [field]: value }
      // Par défaut l'avance est déduite du salaire du mois où elle est remise ;
      // le mois reste modifiable (avance de fin de mois sur le mois suivant).
      if (field === 'advanceDate' && value && normalizeMonthKey(current.advanceDate) === current.month) {
        next.month = normalizeMonthKey(value)
      }
      return next
    })
  }

  const salaryAlreadyValidated = form ? validatedSalaryKeys.has(`${form.teacherId}:${form.month}`) : false
  const formMonthOptions = form && !monthOptions.some((o) => o.value === form.month)
    ? [{ value: form.month, label: monthLabelOf(form.month) }, ...monthOptions]
    : monthOptions

  const save = async () => {
    if (!form.teacherId || !(Number(form.amount) > 0) || !form.advanceDate || !form.month) return
    setSaving(true)
    setError(null)
    try {
      await saveTeacherAdvance({ ...form, userId: user?.id })
      setForm(null)
      await onChanged()
    } catch (err) {
      setError(`Impossible d'enregistrer l'avance : ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  const remove = async (advance) => {
    const name = teacherNameById[advance.teacher_id] || 'ce professeur'
    if (!window.confirm(`Supprimer l'avance de ${formatAmount(advance.amount)} versée à ${name} ?`)) return
    setError(null)
    try {
      await deleteTeacherAdvance(advance.id)
      await onChanged()
    } catch (err) {
      setError(`Impossible de supprimer l'avance : ${err.message}`)
    }
  }

  if (missingTable) {
    return (
      <p className="expenses-error" role="alert">
        La table des avances n'existe pas encore dans la base. Exécutez la migration
        <b> supabase/migrations/038_teacher_advances.sql</b> dans l'éditeur SQL de Supabase, puis rechargez la page.
      </p>
    )
  }

  return (
    <>
      {error && <p className="expenses-error" role="alert">{error}</p>}
      <div className="expenses-actions">
        {toolbar}
        <button onClick={openAdd} disabled={teachers.length === 0}>＋ &nbsp; Ajouter une avance</button>
      </div>
      <section className="expenses-table-wrap">
        <table className="expenses-table">
          <thead>
            <tr>
              <th>Professeur</th>
              <th>Montant</th>
              <th>Date de remise</th>
              <th>Déduite du salaire de</th>
              <th>Motif</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="expense-empty">Chargement des avances...</td>
              </tr>
            ) : advances.length === 0 ? (
              <tr>
                <td colSpan={6} className="expense-empty">Aucune avance sur cette période.</td>
              </tr>
            ) : (
              advances.map((advance) => (
                <tr key={advance.id}>
                  <td><b>{teacherNameById[advance.teacher_id] || 'Professeur supprimé'}</b></td>
                  <td>{formatAmount(advance.amount)}</td>
                  <td>{formatShortDate(advance.advance_date)}</td>
                  <td>
                    {monthLabelOf(normalizeMonthKey(advance.month))}
                    {validatedSalaryKeys.has(`${advance.teacher_id}:${normalizeMonthKey(advance.month)}`) && (
                      <span className="expense-type auto" title="Le salaire de ce mois est déjà validé">Salaire validé</span>
                    )}
                  </td>
                  <td>{advance.note || '—'}</td>
                  <td>
                    <div className="expense-row-actions">
                      <button title="Modifier" aria-label="Modifier l'avance" onClick={() => openEdit(advance)}>
                        <Icon name="edit" />
                      </button>
                      <button className="delete-expense" title="Supprimer" aria-label="Supprimer l'avance" onClick={() => remove(advance)}>
                        <Icon name="delete" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      {form && (
        <div className="expense-overlay" onMouseDown={() => setForm(null)}>
          <section className="expense-modal" onMouseDown={(event) => event.stopPropagation()}>
            <button className="expense-close" onClick={() => setForm(null)}>×</button>
            <h2>{form.id ? "Modifier l'avance" : 'Ajouter une avance sur salaire'}</h2>
            <label>
              Professeur
              <select value={form.teacherId} onChange={update('teacherId')} autoFocus>
                {!teacherNameById[form.teacherId] && <option value={form.teacherId}>Professeur supprimé</option>}
                {teachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>{teacher.name}</option>
                ))}
              </select>
            </label>
            <label>
              Montant (DH)
              <input type="number" min="0" step="any" value={form.amount} onChange={update('amount')} />
            </label>
            <label>
              Date de remise
              <input type="date" value={form.advanceDate} onChange={update('advanceDate')} />
            </label>
            <label>
              Déduite du salaire de
              <select value={form.month} onChange={update('month')}>
                {formMonthOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label>
              Motif (facultatif)
              <input value={form.note} onChange={update('note')} placeholder="ex : avance demandée le 15" />
            </label>
            {salaryAlreadyValidated && (
              <p className="expense-warning">
                Le salaire de {monthLabelOf(form.month)} est déjà validé pour ce professeur. L'avance sera
                tout de même déduite du net affiché dans son journal ; vérifiez le montant réellement versé.
              </p>
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
    </>
  )
}
