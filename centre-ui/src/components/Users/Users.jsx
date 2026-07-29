import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../supabaseClient'
import Icon from '../Icon'
import './Users.css'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL

const allPermissions = ['Dashboard', 'Étudiants', 'Groupes', 'Professeurs', 'Frais de scolarité', 'Retards & Impayés', 'Salaires Profs', 'Charges', 'Bénéfice net', 'Paramètres', 'Administration (Utilisateurs & Succursales)']

const permColumn = {
  'Dashboard': 'dashboard',
  'Étudiants': 'students',
  'Groupes': 'groups',
  'Professeurs': 'teachers',
  'Frais de scolarité': 'tuition',
  'Retards & Impayés': 'late_payments',
  'Salaires Profs': 'teacher_salaries',
  'Charges': 'expenses',
  'Bénéfice net': 'net_profit',
  'Paramètres': 'settings',
  'Administration (Utilisateurs & Succursales)': 'administration',
}

const colToLabel = Object.fromEntries(Object.entries(permColumn).map(([k, v]) => [v, k]))

const Pencil = () => <svg viewBox="0 0 24 24"><path d="m4 16.8-.7 3.9 3.9-.7L18.5 8.7 15.3 5.5 4 16.8Z" /><path d="m13.8 7 3.2 3.2" /></svg>
const Power = () => <svg viewBox="0 0 24 24"><path d="M12 3v8" /><path d="M6.3 5.8a8 8 0 1 0 11.4 0" /></svg>
const Close = () => <svg viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18" /></svg>

function Toggle({ checked, onChange }) { return <label className="user-switch"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /><i /></label> }

function UserModal({ user, branchList, onClose, onSave }) {
  const blank = { firstName: '', lastName: '', email: '', password: '', role: 'secretary', assignedIds: [], permissions: [...allPermissions], active: true }
  const [form, setForm] = useState(user ? {
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    password: '',
    role: user.dbRole,
    assignedIds: user.assignedIds || [],
    permissions: user.permissions,
    active: user.active
  } : blank)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const edit = Boolean(user)

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }))
  const toggleArray = (key, value) => set(key, form[key].includes(value) ? form[key].filter((x) => x !== value) : [...form[key], value])

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await onSave({ ...form, id: user?.id }, edit)
    } catch (err) {
      setError(err.message || 'Une erreur est survenue')
      setSaving(false)
    }
  }

  return <div className="user-modal-backdrop" onMouseDown={onClose} role="presentation"><section className={`user-modal ${edit ? 'user-modal--edit' : ''}`} onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
    <button className="user-modal__close" type="button" onClick={onClose} aria-label="Fermer"><Close /></button><h2>{edit ? "Modifier l'utilisateur" : 'Nouvel utilisateur'}</h2>
    <form onSubmit={submit}>
      <div className="user-form-grid"><label>Prénom *<input autoFocus value={form.firstName} onChange={(e) => set('firstName', e.target.value)} required /></label><label>Nom *<input value={form.lastName} onChange={(e) => set('lastName', e.target.value)} required /></label></div>
      <label>Email *<input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} required /></label>
      <label>Mot de passe {edit && <em>(vide = conserver)</em>}<input type="password" value={form.password} onChange={(e) => set('password', e.target.value)} required={!edit} /></label>
      <label>Rôle *<select value={form.role} onChange={(e) => set('role', e.target.value)}><option value="secretary">Secrétaire</option><option value="super_admin">Super Admin</option></select></label>
      {form.role !== 'super_admin' && <><fieldset className="user-branches"><legend>Succursale(s) assignée(s) *</legend>{branchList.map((b) => <label key={b.id}><input type="checkbox" checked={form.assignedIds.includes(b.id)} onChange={() => toggleArray('assignedIds', b.id)} />{b.name}</label>)}</fieldset>
      <fieldset className="user-permissions"><legend>Permissions d'accès <small><button type="button" onClick={() => set('permissions', allPermissions)}>Tout</button> · <button type="button" onClick={() => set('permissions', [])}>Aucune</button></small></legend><b>GÉNÉRAL</b><div>{allPermissions.slice(0, 4).map((item) => <label key={item}><input type="checkbox" checked={form.permissions.includes(item)} onChange={() => toggleArray('permissions', item)} />{item}</label>)}</div><b>COMPTABILITÉ</b><div>{allPermissions.slice(4, 9).map((item) => <label key={item}><input type="checkbox" checked={form.permissions.includes(item)} onChange={() => toggleArray('permissions', item)} />{item}</label>)}</div><b>ADMINISTRATION</b><div>{allPermissions.slice(9).map((item) => <label key={item}><input type="checkbox" checked={form.permissions.includes(item)} onChange={() => toggleArray('permissions', item)} />{item}</label>)}</div></fieldset></>}
      <div className="user-status"><div><strong>Statut</strong><p>Un compte inactif ne peut pas se connecter.</p></div><span>{form.active ? 'Actif' : 'Inactif'}</span><Toggle checked={form.active} onChange={(active) => set('active', active)} /></div>
      {error && <div className="user-error" style={{ color: '#e74c3c', background: '#fdf0ef', padding: '0.75rem', borderRadius: '6px', fontSize: '0.85rem', marginBottom: '0.75rem' }}>{error}</div>}
      <footer><button type="button" className="user-cancel" onClick={onClose}>Annuler</button><button className="user-save" disabled={saving}>{saving ? 'Enregistrement...' : 'Enregistrer'}</button></footer>
    </form>
  </section></div>
}

export default function Users() {
  const [users, setUsers] = useState([])
  const [branchList, setBranchList] = useState([])
  const [userBranches, setUserBranches] = useState([])
  const [permMap, setPermMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(null)
  const [open, setOpen] = useState(false)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [usersRes, branchesRes, ubRes, permRes] = await Promise.all([
      supabase.from('users').select('*').order('created_at', { ascending: false }),
      supabase.from('branches').select('*'),
      supabase.from('user_branches').select('*'),
      supabase.from('user_permissions').select('*')
    ])
    if (usersRes.data) setUsers(usersRes.data)
    if (branchesRes.data) setBranchList(branchesRes.data)
    if (ubRes.data) setUserBranches(ubRes.data)
    if (permRes.data) {
      const map = {}
      for (const row of permRes.data) {
        map[row.user_id] = row
      }
      setPermMap(map)
    }
    setLoading(false)
  }

  const branchMap = useMemo(() => Object.fromEntries(branchList.map((b) => [b.id, b.name])), [branchList])

  const enrichedUsers = useMemo(() => {
    return users.map((u) => {
      const assignedIds = userBranches.filter((ub) => ub.user_id === u.id).map((ub) => ub.branch_id)
      const assigned = assignedIds.map((id) => branchMap[id]).filter(Boolean)
      const permRow = permMap[u.id]
      const permissions = permRow
        ? Object.keys(permColumn).filter((label) => permRow[permColumn[label]])
        : []
      return {
        id: u.id,
        firstName: u.first_name,
        lastName: u.last_name,
        email: u.email,
        role: u.role === 'super_admin' ? 'Super Admin' : 'Secrétaire',
        dbRole: u.role,
        assigned,
        assignedIds,
        permissions,
        active: u.status === 'active',
        _createdAt: u.created_at
      }
    })
  }, [users, branchMap, userBranches, permMap])

  const results = useMemo(() => {
    return enrichedUsers.filter((u) => `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(query.toLowerCase()))
  }, [enrichedUsers, query])

  const toggleStatus = async (id) => {
    const user = users.find((u) => u.id === id)
    if (!user) return
    const newStatus = user.status === 'active' ? 'inactive' : 'active'
    const { error } = await supabase.from('users').update({ status: newStatus }).eq('id', id)
    if (!error) {
      setUsers((prev) => prev.map((u) => u.id === id ? { ...u, status: newStatus } : u))
    }
  }

  const saveUser = async (form, editing) => {
    if (editing) {
      const updates = {
        first_name: form.firstName,
        last_name: form.lastName,
        email: form.email,
        role: form.role,
        status: form.active ? 'active' : 'inactive'
      }
      const { error: userError } = await supabase.from('users').update(updates).eq('id', form.id)
      if (userError) throw new Error(userError.message)

      const currentIds = userBranches.filter((ub) => ub.user_id === form.id).map((ub) => ub.branch_id)
      const toRemove = currentIds.filter((id) => !form.assignedIds.includes(id))
      const toAdd = form.assignedIds.filter((id) => !currentIds.includes(id))
      if (toRemove.length > 0) {
        await supabase.from('user_branches').delete().eq('user_id', form.id).in('branch_id', toRemove)
      }
      if (toAdd.length > 0) {
        await supabase.from('user_branches').insert(toAdd.map((branch_id) => ({ user_id: form.id, branch_id })))
      }

      const permRow = { user_id: form.id }
      for (const label of allPermissions) {
        permRow[permColumn[label]] = form.permissions.includes(label)
      }
      const { error: permError } = await supabase.from('user_permissions').upsert(permRow)
      if (permError) throw new Error(permError.message)

      await fetchAll()
      setOpen(false)
      return
    }

    const res = await fetch(`${SUPABASE_URL}/functions/v1/create-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
      },
      body: JSON.stringify({
        email: form.email,
        password: form.password,
        first_name: form.firstName,
        last_name: form.lastName,
        role: form.role,
        branch_ids: form.assignedIds,
        permissions: form.permissions.map((label) => permColumn[label])
      })
    })
    if (!res.ok) {
      let msg = 'Failed to create user'
      try { const err = await res.json(); msg = err.error || msg } catch {}
      throw new Error(msg)
    }
    setOpen(false)
    await fetchAll()
  }

  const edit = (item) => { setSelected(item); setOpen(true) }
  const create = () => { setSelected(null); setOpen(true) }

  if (loading) return <div className="users-page"><main className="users-content" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}><p>Chargement des utilisateurs...</p></main></div>

  return <div className="users-page"><header className="topbar users-topbar"><label className="searchbar"><span className="searchbar__icon"><Icon name="search" /></span><input placeholder="Rechercher un élève, professeur..." /></label><button className="branch-select">Toutes les succursales <span>⌄</span></button><button className="notifications"><Icon name="bell" /><span className="notifications__badge">40</span></button><div className="profile"><div className="profile__avatar">DA</div><div><strong>Directeur Atlas</strong><span>Administrateur</span></div></div></header>
    <main className="users-content"><div className="users-heading"><div><h1>Utilisateurs</h1><p>Administrateurs et secrétaires ayant accès à la plateforme.</p></div><button className="user-add" onClick={create}>＋ &nbsp; Ajouter un utilisateur</button></div><label className="user-search"><Icon name="search" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher par nom ou email..." /></label>
    <div className="users-table-wrap"><table className="users-table"><colgroup><col className="users-col-name" /><col className="users-col-email" /><col className="users-col-role" /><col className="users-col-branches" /><col className="users-col-permissions" /><col className="users-col-status" /><col className="users-col-actions" /></colgroup><thead><tr><th>Nom</th><th>Email</th><th>Rôle</th><th>Succursale(s)</th><th>Permissions</th><th>Statut</th><th>Actions</th></tr></thead><tbody>{results.length === 0 ? <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: '#888' }}>{query ? 'Aucun utilisateur trouvé' : 'Aucun utilisateur'}</td></tr> : results.map((u) => <tr key={u.id}><td><strong>{u.lastName} {u.firstName}</strong></td><td>{u.email}</td><td><span className={`role ${u.role === 'Super Admin' ? 'super' : ''}`}>{u.role}</span></td><td>{u.assigned.length > 0 ? u.assigned.map((x) => <span key={x} className="assigned">{x}</span>) : <span style={{ color: '#999' }}>—</span>}</td><td><span className="permission">{u.role === 'Super Admin' ? 'Toutes' : `${u.permissions.length}/${allPermissions.length}`}</span></td><td><span className={`user-pill ${u.active ? 'on' : ''}`}>{u.active ? 'Actif' : 'Inactif'}</span></td><td><div className="user-actions"><button onClick={() => edit(u)} aria-label="Modifier"><Pencil /></button><button onClick={() => toggleStatus(u.id)} aria-label="Activer ou désactiver"><Power /></button></div></td></tr>)}</tbody></table></div></main>{open && <UserModal user={selected} branchList={branchList} onClose={() => setOpen(false)} onSave={saveUser} />}</div>
}
