import { useState } from 'react'
import Icon from '../Icon'
import './Branches.css'

const initialBranches = [
  { id: 1, name: 'Succursale Nord', address: '12 Bd Zerktouni, Casablanca', phone: '0522334455', active: true },
  { id: 2, name: 'Succursale Sud', address: '45 Rue Ibn Sina, Marrakech', phone: '0524889977', active: true },
  { id: 3, name: 'Succursale Centre', address: '8 Av. Hassan II, Rabat', phone: '0537221100', active: true },
]

const emptyBranch = { name: '', address: '', phone: '', active: true }

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
  const [form, setForm] = useState(branch || emptyBranch)
  const isEditing = Boolean(branch?.id)

  const change = (field, value) => setForm((current) => ({ ...current, [field]: value }))
  const submit = (event) => {
    event.preventDefault()
    onSave({ ...form, id: branch?.id || crypto.randomUUID() })
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
            <button className="branch-save" type="submit">Enregistrer</button>
          </footer>
        </form>
      </section>
    </div>
  )
}

export default function Branches() {
  const [branches, setBranches] = useState(initialBranches)
  const [selectedBranch, setSelectedBranch] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const openCreate = () => { setSelectedBranch(null); setIsModalOpen(true) }
  const openEdit = (branch) => { setSelectedBranch(branch); setIsModalOpen(true) }
  const closeModal = () => setIsModalOpen(false)
  const toggleActive = (id) => setBranches((items) => items.map((item) => item.id === id ? { ...item, active: !item.active } : item))
  const saveBranch = (branch) => {
    setBranches((items) => items.some((item) => item.id === branch.id) ? items.map((item) => item.id === branch.id ? branch : item) : [...items, branch])
    closeModal()
  }

  return (
    <div className="branches-page">
      <header className="topbar branches-topbar">
        <label className="searchbar"><span className="searchbar__icon"><Icon name="search" /></span><input type="search" placeholder="Rechercher un élève, professeur..." /></label>
        <button type="button" className="branch-select"><span>Toutes les succursales</span><span aria-hidden="true">⌄</span></button>
        <button type="button" className="notifications" aria-label="Notifications"><Icon name="bell" /><span className="notifications__badge">40</span></button>
        <div className="profile"><div className="profile__avatar">DA</div><div><strong>Directeur Atlas</strong><span>Administrateur</span></div></div>
      </header>

      <main className="branches-content">
        <div className="branches-heading">
          <div><h1>Succursales</h1><p>Les différents sites du centre.</p></div>
          <button type="button" className="branch-add" onClick={openCreate}><span aria-hidden="true">＋</span> Ajouter une succursale</button>
        </div>

        <div className="branches-table-wrap">
          <table className="branches-table"><colgroup><col className="branch-col-name" /><col className="branch-col-address" /><col className="branch-col-phone" /><col className="branch-col-status" /><col className="branch-col-actions" /></colgroup>
            <thead><tr><th>Nom</th><th>Adresse</th><th>Téléphone</th><th>Statut</th><th>Actions</th></tr></thead>
            <tbody>
              {branches.map((branch) => <tr key={branch.id}>
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
