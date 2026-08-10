import { useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient'
import Header from '../shared/Header'
import './Branches.css'

function PencilIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 16.8-.7 3.9 3.9-.7L18.5 8.7 15.3 5.5 4 16.8Z" /><path d="m13.8 7 3.2 3.2" /></svg>
}

function PowerIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v8" /><path d="M6.3 5.8a8 8 0 1 0 11.4 0" /></svg>
}

function CloseIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
}

function BranchModal({ branch, onClose, onSave }) {
  const emptyBranch = { name: '', address: '', phone: '', active: true }
  const [form, setForm] = useState(branch || emptyBranch)
  const [saving, setSaving] = useState(false)
  const isEditing = Boolean(branch?.id)

  const change = (field, value) => setForm((current) => ({ ...current, [field]: value }))
  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    try {
      await onSave(form, isEditing)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="branch-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="branch-modal" role="dialog" aria-modal="true" aria-labelledby="branch-modal-title" onMouseDown={(event) => event.stopPropagation()}>
        <button className="branch-modal__close" type="button" onClick={onClose} aria-label="Fermer"><CloseIcon /></button>
        <h2 id="branch-modal-title">{isEditing ? 'Modifier la succursale' : 'Nouvelle succursale'}</h2>

        <form onSubmit={submit}>
          <label>
            <span>Nom *</span>
            <input autoFocus value={form.name} onChange={(event) => change('name', event.target.value)} required />
          </label>
          <label>
            <span>Adresse *</span>
            <input value={form.address} onChange={(event) => change('address', event.target.value)} required />
          </label>
          <label>
            <span>Téléphone *</span>
            <input type="tel" value={form.phone} onChange={(event) => change('phone', event.target.value)} required />
          </label>

          <div className="branch-status-field">
            <div><strong>Statut</strong><p>Une succursale inactive n'apparaît plus dans les sélecteurs.</p></div>
            <label className="branch-switch"><span>{form.active ? 'Actif' : 'Inactif'}</span><input type="checkbox" checked={form.active} onChange={(event) => change('active', event.target.checked)} /><i /></label>
          </div>

          <footer>
            <button className="branch-cancel" type="button" onClick={onClose}>Annuler</button>
            <button className="branch-save" type="submit" disabled={saving}>{saving ? 'Enregistrement...' : 'Enregistrer'}</button>
          </footer>
        </form>
      </section>
    </div>
  )
}

export default function Branches() {
  const [branches, setBranches] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedBranch, setSelectedBranch] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  useEffect(() => { fetchBranches() }, [])

  async function fetchBranches() {
    setLoading(true)
    const { data } = await supabase.from('branches').select('*').order('created_at', { ascending: false })
    if (data) {
      setBranches(data.map((b) => ({ ...b, active: b.status === 'active' })))
    }
    setLoading(false)
  }

  const openCreate = () => { setSelectedBranch(null); setIsModalOpen(true) }
  const openEdit = (branch) => { setSelectedBranch(branch); setIsModalOpen(true) }
  const closeModal = () => setIsModalOpen(false)

  const toggleActive = async (id) => {
    const branch = branches.find((b) => b.id === id)
    if (!branch) return
    const newStatus = branch.active ? 'inactive' : 'active'
    const { error } = await supabase.from('branches').update({ status: newStatus }).eq('id', id)
    if (!error) {
      setBranches((items) => items.map((item) => item.id === id ? { ...item, active: !item.active, status: newStatus } : item))
    }
  }

  const saveBranch = async (branchForm, editing) => {
    if (editing) {
      const { error } = await supabase.from('branches').update({
        name: branchForm.name,
        address: branchForm.address,
        phone: branchForm.phone,
        status: branchForm.active ? 'active' : 'inactive'
      }).eq('id', branchForm.id)
      if (error) throw new Error(error.message)
    } else {
      const { error } = await supabase.from('branches').insert({
        name: branchForm.name,
        address: branchForm.address,
        phone: branchForm.phone,
        status: branchForm.active ? 'active' : 'inactive'
      })
      if (error) throw new Error(error.message)
    }
    closeModal()
    await fetchBranches()
  }

  if (loading) return <div className="branches-page"><main className="branches-content" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}><p>Chargement des succursales...</p></main></div>

  return (
    <div className="branches-page">
      <Header />

      <main className="branches-content">
        <div className="branches-heading">
          <div><h1>Succursales</h1><p>Les différents sites du centre.</p></div>
          <button type="button" className="branch-add" onClick={openCreate}><span aria-hidden="true">＋</span> Ajouter une succursale</button>
        </div>

        <div className="branches-table-wrap">
          <table className="branches-table"><colgroup><col className="branch-col-name" /><col className="branch-col-address" /><col className="branch-col-phone" /><col className="branch-col-status" /><col className="branch-col-actions" /></colgroup>
            <thead><tr><th>Nom</th><th>Adresse</th><th>Téléphone</th><th>Statut</th><th>Actions</th></tr></thead>
            <tbody>
              {branches.length === 0 ? <tr><td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: '#888' }}>Aucune succursale</td></tr> : branches.map((branch) => <tr key={branch.id}>
                <td><strong>{branch.name}</strong></td><td>{branch.address}</td><td className="branch-phone">{branch.phone}</td>
                <td><span className={`branch-pill ${branch.active ? 'is-active' : 'is-inactive'}`}>{branch.active ? 'Actif' : 'Inactif'}</span></td>
                <td><div className="branch-actions"><button type="button" onClick={() => openEdit(branch)} aria-label={`Modifier ${branch.name}`}><PencilIcon /></button><button className={branch.active ? '' : 'is-off'} type="button" onClick={() => toggleActive(branch.id)} aria-label={`${branch.active ? 'Désactiver' : 'Activer'} ${branch.name}`}><PowerIcon /></button></div></td>
              </tr>)}
            </tbody>
          </table>
        </div>
      </main>

      {isModalOpen && <BranchModal branch={selectedBranch} onClose={closeModal} onSave={saveBranch} />}
    </div>
  )
}
