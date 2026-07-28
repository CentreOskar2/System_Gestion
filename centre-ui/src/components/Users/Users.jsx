import { useMemo, useState } from 'react'
import Icon from '../Icon'
import './Users.css'

const allPermissions = ['Dashboard', 'Étudiants', 'Groupes', 'Professeurs', 'Frais de scolarité', 'Retards & Impayés', 'Salaires Profs', 'Charges', 'Bénéfice net', 'Paramètres', 'Administration (Utilisateurs & Succursales)']
const branches = ['Succursale Nord', 'Succursale Sud', 'Succursale Centre']
const seed = [
  { id: 1, firstName: 'Yassine', lastName: 'El Idrissi', email: 'admin@centre-atlas.ma', role: 'Super Admin', assigned: ['Toutes'], permissions: allPermissions, active: true },
  { id: 2, firstName: 'Sofia', lastName: 'Benali', email: 'sofia.benali@centre-atlas.ma', role: 'Secrétaire', assigned: ['Succursale Nord'], permissions: allPermissions.slice(0, 5), active: true },
  { id: 3, firstName: 'Karim', lastName: 'Mansouri', email: 'karim.mansouri@centre-atlas.ma', role: 'Secrétaire', assigned: ['Succursale Sud', 'Succursale Centre'], permissions: allPermissions.slice(0, 6), active: true },
  { id: 4, firstName: 'Laila', lastName: 'Alaoui', email: 'laila.alaoui@centre-atlas.ma', role: 'Secrétaire', assigned: ['Succursale Centre'], permissions: allPermissions.slice(0, 2), active: false },
]
const blank = { firstName: '', lastName: '', email: '', password: '', role: 'Secrétaire', assigned: [], permissions: ['Dashboard', 'Étudiants', 'Groupes', 'Frais de scolarité', 'Retards & Impayés'], active: true }
const Pencil = () => <svg viewBox="0 0 24 24"><path d="m4 16.8-.7 3.9 3.9-.7L18.5 8.7 15.3 5.5 4 16.8Z" /><path d="m13.8 7 3.2 3.2" /></svg>
const Power = () => <svg viewBox="0 0 24 24"><path d="M12 3v8" /><path d="M6.3 5.8a8 8 0 1 0 11.4 0" /></svg>
const Close = () => <svg viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18" /></svg>

function Toggle({ checked, onChange }) { return <label className="user-switch"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /><i /></label> }

function UserModal({ user, onClose, onSave }) {
  const [form, setForm] = useState(user ? { ...user, password: '' } : blank)
  const edit = Boolean(user)
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }))
  const toggleArray = (key, value) => set(key, form[key].includes(value) ? form[key].filter((x) => x !== value) : [...form[key], value])
  const submit = (e) => { e.preventDefault(); onSave({ ...form, id: user?.id || crypto.randomUUID() }) }
  const permissions = allPermissions
  return <div className="user-modal-backdrop" onMouseDown={onClose} role="presentation"><section className={`user-modal ${edit ? 'user-modal--edit' : ''}`} onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
    <button className="user-modal__close" type="button" onClick={onClose} aria-label="Fermer"><Close /></button><h2>{edit ? "Modifier l'utilisateur" : 'Nouvel utilisateur'}</h2>
    <form onSubmit={submit}>
      <div className="user-form-grid"><label>Prénom *<input autoFocus value={form.firstName} onChange={(e) => set('firstName', e.target.value)} required /></label><label>Nom *<input value={form.lastName} onChange={(e) => set('lastName', e.target.value)} required /></label></div>
      <label>Email *<input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} required /></label>
      <label>Mot de passe {edit && <em>(vide = conserver)</em>}<input type="password" value={form.password} onChange={(e) => set('password', e.target.value)} required={!edit} /></label>
      <label>Rôle *<select value={form.role} onChange={(e) => set('role', e.target.value)}><option>Secrétaire</option><option>Super Admin</option></select></label>
      {!edit && <><fieldset className="user-branches"><legend>Succursale(s) assignée(s) *</legend>{branches.map((branch) => <label key={branch}><input type="checkbox" checked={form.assigned.includes(branch)} onChange={() => toggleArray('assigned', branch)} />{branch}</label>)}</fieldset>
      <fieldset className="user-permissions"><legend>♢ &nbsp; Permissions d'accès <small><button type="button" onClick={() => set('permissions', allPermissions)}>Tout</button> · <button type="button" onClick={() => set('permissions', [])}>Aucune</button></small></legend><b>GÉNÉRAL</b><div>{permissions.slice(0, 4).map((item) => <label key={item}><input type="checkbox" checked={form.permissions.includes(item)} onChange={() => toggleArray('permissions', item)} />{item}</label>)}</div><b>COMPTABILITÉ</b><div>{permissions.slice(4, 9).map((item) => <label key={item}><input type="checkbox" checked={form.permissions.includes(item)} onChange={() => toggleArray('permissions', item)} />{item}</label>)}</div><b>ADMINISTRATION</b><div>{permissions.slice(9).map((item) => <label key={item}><input type="checkbox" checked={form.permissions.includes(item)} onChange={() => toggleArray('permissions', item)} />{item}</label>)}</div></fieldset></>}
      <div className="user-status"><div><strong>Statut</strong><p>Un compte inactif ne peut pas se connecter.</p></div><span>{form.active ? 'Actif' : 'Inactif'}</span><Toggle checked={form.active} onChange={(active) => set('active', active)} /></div>
      <footer><button type="button" className="user-cancel" onClick={onClose}>Annuler</button><button className="user-save">Enregistrer</button></footer>
    </form>
  </section></div>
}

export default function Users() {
  const [users, setUsers] = useState(seed); const [query, setQuery] = useState(''); const [selected, setSelected] = useState(null); const [open, setOpen] = useState(false)
  const results = useMemo(() => users.filter((u) => `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(query.toLowerCase())), [users, query])
  const save = (item) => { setUsers((items) => items.some((x) => x.id === item.id) ? items.map((x) => x.id === item.id ? item : x) : [...items, item]); setOpen(false) }
  const edit = (item) => { setSelected(item); setOpen(true) }; const create = () => { setSelected(null); setOpen(true) }
  const toggle = (id) => setUsers((items) => items.map((x) => x.id === id ? { ...x, active: !x.active } : x))
  return <div className="users-page"><header className="topbar users-topbar"><label className="searchbar"><span className="searchbar__icon"><Icon name="search" /></span><input placeholder="Rechercher un élève, professeur..." /></label><button className="branch-select">Toutes les succursales <span>⌄</span></button><button className="notifications"><Icon name="bell" /><span className="notifications__badge">40</span></button><div className="profile"><div className="profile__avatar">DA</div><div><strong>Directeur Atlas</strong><span>Administrateur</span></div></div></header>
    <main className="users-content"><div className="users-heading"><div><h1>Utilisateurs</h1><p>Administrateurs et secrétaires ayant accès à la plateforme.</p></div><button className="user-add" onClick={create}>＋ &nbsp; Ajouter un utilisateur</button></div><label className="user-search"><Icon name="search" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher par nom ou email..." /></label>
    <div className="users-table-wrap"><table className="users-table"><colgroup><col className="users-col-name" /><col className="users-col-email" /><col className="users-col-role" /><col className="users-col-branches" /><col className="users-col-permissions" /><col className="users-col-status" /><col className="users-col-actions" /></colgroup><thead><tr><th>Nom</th><th>Email</th><th>Rôle</th><th>Succursale(s)</th><th>Permissions</th><th>Statut</th><th>Actions</th></tr></thead><tbody>{results.map((u) => <tr key={u.id}><td><strong>{u.lastName} {u.firstName}</strong></td><td>{u.email}</td><td><span className={`role ${u.role === 'Super Admin' ? 'super' : ''}`}>{u.role}</span></td><td>{u.assigned.map((x) => <span key={x} className="assigned">{x}</span>)}</td><td><span className="permission">♢ &nbsp;{u.role === 'Super Admin' ? 'Toutes' : `${u.permissions.length}/11`}</span></td><td><span className={`user-pill ${u.active ? 'on' : ''}`}>{u.active ? 'Actif' : 'Inactif'}</span></td><td><div className="user-actions"><button onClick={() => edit(u)} aria-label="Modifier"><Pencil /></button><button onClick={() => toggle(u.id)} aria-label="Activer ou désactiver"><Power /></button></div></td></tr>)}</tbody></table></div></main>{open && <UserModal user={selected} onClose={() => setOpen(false)} onSave={save} />}</div>
}
