/* eslint-disable no-irregular-whitespace */
import { createClient } from '@supabase/supabase-js'
import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../supabaseClient'
import { useAuth } from '../../context/AuthContext'
import Header from '../shared/Header'
import Icon from '../Icon'
import { deactivateAllStudents, reactivateAllStudents } from '../Students/enrollment/enrollmentApi'
import { normalizePhoneInput, phoneValidationMessage } from '../../utils/validators'
import { fetchAppSettings, saveAppSettings } from '../../appSettings'
import { schoolYearLabel, academicYearStart } from '../Accounting/monthUtils'
import './Settings.css'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

const confirmationTexts = {
  deactivate: 'DÉSACTIVER TOUS LES ÉLÈVES',
  reactivate: 'RÉACTIVER TOUS LES ÉLÈVES',
}

const authCheckClient = SUPABASE_URL && SUPABASE_ANON_KEY
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  })
  : null

const textDefault = 'مرحباً، هذا تذكير من مركز أوسكار بخصوص مصاريف الدراسة للتلميذ(ة) {nom_eleve} لشهر {mois}.\n\nالمبلغ المستحق: {montant_du}.\n\nنرجو منكم تسوية الوضع في أقرب وقت ممكن.\n— مركز أوسكار'
const salaryDefault = 'مرحباً {nom_prof},\n\nإليك كشف راتبك لشهر {mois}: {montant} درهم.\n\nشكراً على التزامك.\n— مركز أوسكار'

const Trash = () => <svg viewBox="0 0 24 24"><path d="M3 6h18" /><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" /><path d="M19 6l-.9 13a2 2 0 0 1-2 1.9H7.9a2 2 0 0 1-2-1.9L5 6" /><path d="M10 11v6M14 11v6" /></svg>
const Pencil = () => <svg viewBox="0 0 24 24"><path d="m4 16.8-.7 3.9 3.9-.7L18.5 8.7 15.3 5.5 4 16.8Z" /><path d="m13.8 7 3.2 3.2" /></svg>

function Toast({ notice }) {
  if (!notice) return null
  return (
    <div className={`settings-toast is-${notice.type}`} role="status">
      <span>{notice.type === 'success' ? '✓' : '✕'}</span>
      {notice.text}
    </div>
  )
}

function LevelModal({ cycles, onClose, onSave }) {
  const [name, setName] = useState('')
  const [cycleId, setCycleId] = useState(cycles[0]?.id || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    if (!name.trim() || !cycleId) return
    setSaving(true)
    setError(null)
    try {
      await onSave(name.trim(), cycleId)
    } catch (err) {
      setError(err.message || 'Une erreur est survenue')
      setSaving(false)
    }
  }

  return (
    <div className="settings-dialog-bg" onMouseDown={onClose}>
      <section className="settings-dialog" onMouseDown={(e) => e.stopPropagation()}>
        <button className="settings-close" onClick={onClose}>×</button>
        <h2>Ajouter un niveau</h2>
        <form onSubmit={submit}>
          <label>Nom du niveau<input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="ex : 1ère année" required /></label>
          <label>Cycle
            <select value={cycleId} onChange={(e) => setCycleId(e.target.value)} required>
              {cycles.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          {error && <div className="settings-error">{error}</div>}
          <footer>
            <button type="button" className="settings-outline" onClick={onClose}>Annuler</button>
            <button type="submit" className="settings-save" disabled={saving || !cycleId}>{saving ? 'Enregistrement...' : 'Enregistrer'}</button>
          </footer>
        </form>
      </section>
    </div>
  )
}

function NameModal({ title, label, placeholder, onClose, onSave }) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    setError(null)
    try {
      await onSave(name.trim())
    } catch (err) {
      setError(err.message || 'Une erreur est survenue')
      setSaving(false)
    }
  }

  return (
    <div className="settings-dialog-bg" onMouseDown={onClose}>
      <section className="settings-dialog" onMouseDown={(e) => e.stopPropagation()}>
        <button className="settings-close" onClick={onClose}>×</button>
        <h2>{title}</h2>
        <form onSubmit={submit}>
          <label>{label}<input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={placeholder} required /></label>
          {error && <div className="settings-error">{error}</div>}
          <footer><button type="button" className="settings-outline" onClick={onClose}>Annuler</button><button type="submit" className="settings-save" disabled={saving}>{saving ? 'Enregistrement...' : 'Enregistrer'}</button></footer>
        </form>
      </section>
    </div>
  )
}

function CycleModal({ cycle, onClose, onSave }) {
  const editing = Boolean(cycle)
  const [form, setForm] = useState(cycle
    ? { id: cycle.id, name: cycle.name, has_fixed_price: Boolean(cycle.has_fixed_price), fixed_price: cycle.fixed_price != null ? String(cycle.fixed_price) : '' }
    : { id: undefined, name: '', has_fixed_price: false, fixed_price: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const submit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return
    if (form.has_fixed_price && (form.fixed_price === '' || Number(form.fixed_price) <= 0)) {
      setError('Veuillez saisir un prix fixe valide.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSave(form, editing)
    } catch (err) {
      setError(err.message || 'Une erreur est survenue')
      setSaving(false)
    }
  }

  return (
    <div className="settings-dialog-bg" onMouseDown={onClose}>
      <section className="settings-dialog" onMouseDown={(e) => e.stopPropagation()}>
        <button className="settings-close" onClick={onClose}>×</button>
        <h2>{editing ? 'Modifier le cycle' : 'Nouveau cycle'}</h2>
        <form onSubmit={submit}>
          <label>Nom du cycle *<input autoFocus value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="ex : Collège" required /></label>
          <div className="cycle-fixed">
            <div><strong>Prix fixe pour tout le cycle</strong><p>Si activé, tous les niveaux du cycle partagent ce tarif.</p></div>
            <label className="settings-switch"><input type="checkbox" checked={form.has_fixed_price} onChange={(e) => set('has_fixed_price', e.target.checked)} /><i /></label>
          </div>
          {form.has_fixed_price && <label>Prix fixe (DH / mois)<input type="number" min="0" step="0.01" value={form.fixed_price} onChange={(e) => set('fixed_price', e.target.value)} placeholder="ex : 400" /></label>}
          {error && <div className="settings-error">{error}</div>}
          <footer><button type="button" className="settings-outline" onClick={onClose}>Annuler</button><button type="submit" className="settings-save" disabled={saving}>{saving ? 'Enregistrement...' : 'Enregistrer'}</button></footer>
        </form>
      </section>
    </div>
  )
}

function TemplateEditor({ label, value, placeholders, onChange, saving, onSave, renderPreview }) {
  const ref = useRef(null)

  const insertPlaceholder = (ph) => {
    const el = ref.current
    const start = el ? el.selectionStart : value.length
    const end = el ? el.selectionEnd : value.length
    onChange(value.slice(0, start) + ph + value.slice(end))
    requestAnimationFrame(() => {
      if (el) {
        el.focus()
        el.selectionStart = el.selectionEnd = start + ph.length
      }
    })
  }

  return (
    <div className="template-editor">
      <header>
        <strong>{label}</strong>
        <button className="settings-save" onClick={onSave} disabled={saving}>{saving ? 'Enregistrement...' : (<><Icon name="save" /> Enregistrer</>)}</button>
      </header>
      <div className="template-vars"><span>Variables disponibles :</span>{placeholders.map((p) => <button type="button" key={p} onClick={() => insertPlaceholder(p)}>{p}</button>)}</div>
      <textarea ref={ref} value={value} onChange={(e) => onChange(e.target.value)} />
      <div className="settings-preview"><small>APERÇU</small><p>{renderPreview(value)}</p></div>
    </div>
  )
}

function SchoolYearChangeModal({ year, onClose, onConfirm }) {
  const [saving, setSaving] = useState(false)

  const confirm = async () => {
    setSaving(true)
    try {
      await onConfirm()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="settings-dialog-bg" onMouseDown={onClose}>
      <section className="settings-dialog" onMouseDown={(e) => e.stopPropagation()}>
        <button className="settings-close" onClick={onClose}>×</button>
        <h2>Passer à l'année scolaire {year} ?</h2>
        <p style={{ margin: '10px 0 0', color: '#647088', lineHeight: 1.5 }}>
          Tous les élèves actifs devront repayer les frais d'inscription pour cette nouvelle année.
          Aucune donnée existante n'est supprimée : les frais déjà réglés restent rattachés à leur année scolaire.
        </p>
        <footer style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
          <button type="button" className="settings-outline" onClick={onClose}>Annuler</button>
          <button type="button" className="settings-save" onClick={confirm} disabled={saving}>
            {saving ? 'Enregistrement...' : 'Confirmer le changement'}
          </button>
        </footer>
      </section>
    </div>
  )
}

function GlobalStudentsActionModal({ mode, email, onClose, onConfirm }) {
  const targetText = confirmationTexts[mode]
  const warningText = mode === 'reactivate'
    ? 'Cette action va réactiver tous les élèves désactivés de la plateforme.'
    : 'Cette action va désactiver tous les élèves actifs de la plateforme.'
  const [confirmText, setConfirmText] = useState('')
  const [password, setPassword] = useState('')
  const [passwordStatus, setPasswordStatus] = useState('idle')
  const [passwordMessage, setPasswordMessage] = useState('')
  const [saving, setSaving] = useState(false)

  const validatePassword = async (value) => {
    if (!authCheckClient || !email || !value) {
      setPasswordStatus('invalid')
      setPasswordMessage('Veuillez saisir le mot de passe de votre compte.')
      return false
    }

    setPasswordStatus('checking')
    setPasswordMessage('')

    const { error } = await authCheckClient.auth.signInWithPassword({ email, password: value })
    if (error) {
      setPasswordStatus('invalid')
      setPasswordMessage('Mot de passe incorrect.')
      return false
    }

    await authCheckClient.auth.signOut()
    setPasswordStatus('valid')
    setPasswordMessage('Mot de passe validé.')
    return true
  }

  const confirmTextValid = confirmText === targetText
  const passwordValid = passwordStatus === 'valid'
  const canConfirm = confirmTextValid && passwordValid && !saving

  const handlePasswordBlur = async () => {
    if (!password.trim()) {
      setPasswordStatus('idle')
      setPasswordMessage('')
      return
    }
    await validatePassword(password)
  }

  const submit = async (event) => {
    event.preventDefault()
    if (!canConfirm) return
    setSaving(true)
    try {
      await onConfirm()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="settings-dialog-bg" onMouseDown={onClose}>
      <section className="settings-dialog settings-dialog--wide" onMouseDown={(e) => e.stopPropagation()}>
        <button className="settings-close" onClick={onClose}>×</button>
        <h2>{mode === 'reactivate' ? 'Réactiver tous les élèves' : 'Désactiver tous les élèves'}</h2>
        <form className="global-students-action-form" onSubmit={submit}>
          <p className="global-students-action-warning">{warningText}</p>
          <p className="global-students-action-helper">
            Copiez et collez exactement : <strong>{targetText}</strong>
          </p>
          <label>
            Saisissez exactement ce texte pour confirmer
            <input
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              placeholder={targetText}
              autoComplete="off"
              spellCheck="false"
              required
            />
          </label>
          <label>
            Mot de passe
            <input
              type="password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value)
                setPasswordStatus('idle')
                setPasswordMessage('')
              }}
              onBlur={handlePasswordBlur}
              autoComplete="current-password"
              required
            />
          </label>
          {passwordMessage && (
            <div className={`settings-hint ${passwordStatus === 'invalid' ? 'is-error' : 'is-ok'}`}>
              {passwordMessage}
            </div>
          )}
          <footer>
            <button type="button" className="settings-outline" onClick={onClose}>Annuler</button>
            <button type="submit" className="settings-save" disabled={!canConfirm}>
              {saving ? 'Confirmation...' : 'Confirmer'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  )
}

export default function Settings() {
  const { user, profile } = useAuth()
  const [tab, setTab] = useState('general')
  const [cycles, setCycles] = useState([])
  const [levels, setLevels] = useState([])
  const [studyBranches, setStudyBranches] = useState([])
  const [subjects, setSubjects] = useState([])
  const [tariffs, setTariffs] = useState([])
  const [tariffDrafts, setTariffDrafts] = useState({})
  const [tariffSaving, setTariffSaving] = useState(false)
  const [appSettings, setAppSettings] = useState(null)
  const [registrationFeeDraft, setRegistrationFeeDraft] = useState('')
  const [schoolYearDraft, setSchoolYearDraft] = useState('')
  const [centerSettings, setCenterSettings] = useState(null)
  const [centerForm, setCenterForm] = useState({ center_name: '', logo_url: '', address: '', phone: '', contact_info: '' })
  const [templates, setTemplates] = useState({})
  const [templateDrafts, setTemplateDrafts] = useState({ payment_reminder: textDefault, salary_bulletin: salaryDefault })
  const [generalSaving, setGeneralSaving] = useState(false)
  const [templateSaving, setTemplateSaving] = useState(null)
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [notice, setNotice] = useState(null)
  const [branchDrafts, setBranchDrafts] = useState({})
  const [studentSummary, setStudentSummary] = useState({ active: 0, total: 0, loading: true })
  const [centerPhoneError, setCenterPhoneError] = useState('')
  const noticeTimer = useRef(null)

  const notify = (text, type = 'success') => {
    setNotice({ text, type })
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current)
    noticeTimer.current = window.setTimeout(() => setNotice(null), 4000)
  }

  const setCenterPhone = (value) => {
    const nextValue = normalizePhoneInput(value)
    setCenterForm((current) => ({ ...current, phone: nextValue }))
    if (centerPhoneError) setCenterPhoneError(phoneValidationMessage(nextValue))
  }

  const validateCenterPhone = () => {
    const message = phoneValidationMessage(centerForm.phone)
    setCenterPhoneError(message)
    return !message
  }

  async function loadAcademicData() {
    const [c, l, sb, s, t, cs, wt] = await Promise.all([
      supabase.from('cycles').select('*').order('name'),
      supabase.from('levels').select('*').order('name'),
      supabase.from('study_branches').select('*').order('name'),
      supabase.from('subjects').select('*').order('name'),
      supabase.from('tariffs').select('*'),
      supabase.from('center_settings').select('*'),
      supabase.from('whatsapp_templates').select('*'),
    ])
    const firstError = [c, l, sb, s, t, cs, wt].find((r) => r.error)
    if (firstError) throw new Error(firstError.error.message)

    let centerSettings = cs.data && cs.data.length > 0 ? cs.data[0] : null
    if (!centerSettings) {
      const { data: inserted, error: insErr } = await supabase.from('center_settings').insert({
        center_name: 'Centre Oskar',
        logo_url: '',
        address: '12 Bd Zerktouni, Casablanca',
        phone: '0522334455',
        contact_info: 'contact@centre-oskar.ma',
      }).select().single()
      if (insErr) throw new Error(insErr.message)
      centerSettings = inserted
    }

    const templateMap = {}
    for (const row of wt.data || []) templateMap[row.type] = row

    return {
      cycles: c.data || [],
      levels: l.data || [],
      studyBranches: sb.data || [],
      subjects: s.data || [],
      tariffs: t.data || [],
      centerSettings,
      templates: templateMap,
    }
  }

  function applyData(data, opts = {}) {
    setCycles(data.cycles)
    setLevels(data.levels)
    setStudyBranches(data.studyBranches)
    setSubjects(data.subjects)
    setTariffs(data.tariffs)
    if (opts.resetTariffDrafts) {
      const drafts = {}
      for (const row of data.tariffs) drafts[`${row.level_id}::${row.subject_id}`] = String(row.price)
      setTariffDrafts(drafts)
    }
    setCenterSettings(data.centerSettings)
    setCenterForm({
      center_name: data.centerSettings?.center_name || '',
      logo_url: data.centerSettings?.logo_url || '',
      address: data.centerSettings?.address || '',
      phone: data.centerSettings?.phone || '',
      contact_info: data.centerSettings?.contact_info || '',
    })
    setTemplates(data.templates || {})
    setTemplateDrafts({
      payment_reminder: data.templates?.payment_reminder?.content || textDefault,
      salary_bulletin: data.templates?.salary_bulletin?.content || salaryDefault,
    })
    setLoading(false)
  }

  async function fetchAll() {
    try {
      applyData(await loadAcademicData())
    } catch (err) {
      notify(err.message || 'Une erreur est survenue', 'error')
      setLoading(false)
    }
  }

  async function getStudentSummary() {
    const [activeRes, totalRes] = await Promise.all([
      supabase.from('students').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('students').select('id', { count: 'exact', head: true }),
    ])
    const firstError = [activeRes, totalRes].find((r) => r.error)
    if (firstError) throw new Error(firstError.error.message)

    return {
      active: activeRes.count || 0,
      total: totalRes.count || 0,
    }
  }

  async function loadStudentSummary() {
    const summary = await getStudentSummary()
    setStudentSummary({
      active: summary.active,
      total: summary.total,
      loading: false,
    })
  }

  const refreshStudentSummary = async () => {
    try {
      await loadStudentSummary()
    } catch (err) {
      notify(err.message || 'Une erreur est survenue', 'error')
    }
  }

  useEffect(() => {
    let ignore = false
    loadAcademicData().then((data) => {
      if (!ignore) applyData(data, { resetTariffDrafts: true })
    }).catch((err) => {
      if (!ignore) {
        notify(err.message || 'Une erreur est survenue', 'error')
        setLoading(false)
      }
    })
    return () => { ignore = true }
  }, [])

  useEffect(() => {
    let ignore = false
    ;(async () => {
      try {
        const summary = await getStudentSummary()
        if (!ignore) {
          setStudentSummary({ ...summary, loading: false })
        }
      } catch (err) {
        if (!ignore) notify(err.message || 'Une erreur est survenue', 'error')
      }
    })()
    return () => {
      ignore = true
    }
  }, [])

  useEffect(() => {
    let ignore = false
    fetchAppSettings()
      .then((settings) => {
        if (ignore) return
        setAppSettings(settings)
        setRegistrationFeeDraft(String(settings.registrationFee))
        setSchoolYearDraft(settings.activeSchoolYear)
      })
      .catch((err) => {
        if (!ignore) notify(err.message || 'Une erreur est survenue', 'error')
      })
    return () => {
      ignore = true
    }
  }, [])

  const cycleMap = useMemo(() => Object.fromEntries(cycles.map((c) => [c.id, c])), [cycles])

  const levelsByCycle = useMemo(() => {
    const map = {}
    for (const l of levels) {
      if (!map[l.cycle_id]) map[l.cycle_id] = []
      map[l.cycle_id].push(l)
    }
    return map
  }, [levels])

  const branchesByLevel = useMemo(() => {
    const map = {}
    for (const b of studyBranches) {
      if (!map[b.level_id]) map[b.level_id] = []
      map[b.level_id].push(b)
    }
    return map
  }, [studyBranches])

  const branchCountByCycle = useMemo(() => {
    const map = {}
    for (const l of levels) {
      const count = branchesByLevel[l.id]?.length || 0
      map[l.cycle_id] = (map[l.cycle_id] || 0) + count
    }
    return map
  }, [levels, branchesByLevel])

  const isSuperAdmin = profile?.role === 'super_admin'
  const feeChanged = appSettings != null && String(appSettings.registrationFee) !== String(registrationFeeDraft).trim()
  const schoolYearChanged = appSettings != null && appSettings.activeSchoolYear !== schoolYearDraft

  const schoolYearChoices = useMemo(() => {
    const start = academicYearStart()
    const years = []
    for (let year = start - 4; year <= start + 2; year += 1) years.push(schoolYearLabel(year))
    if (appSettings?.activeSchoolYear && !years.includes(appSettings.activeSchoolYear)) {
      years.push(appSettings.activeSchoolYear)
      years.sort()
    }
    return years
  }, [appSettings])

  const templatePreview = (text) => text
    .replace('{nom_eleve}', 'Yasmine Alaoui')
    .replace('{nom_prof}', 'M. Karimi')
    .replace('{mois}', 'Février 2026')
    .replace('{montant_du}', '1 200 DH')
    .replace('{montant}', '3 500 DH')
    .replace('{succursale}', 'Centre Oskar')

  const setPricingValue = (levelId, subjectId, value) =>
    setTariffDrafts((d) => ({ ...d, [`${levelId}::${subjectId}`]: value }))

  const saveCenterSettings = async (e) => {
    e.preventDefault()
    if (!validateCenterPhone()) return
    setGeneralSaving(true)
    try {
      const { error } = await supabase.from('center_settings').upsert({
        id: centerSettings?.id,
        center_name: centerForm.center_name,
        logo_url: centerForm.logo_url,
        address: centerForm.address,
        phone: centerForm.phone,
        contact_info: centerForm.contact_info,
      })
      if (error) throw new Error(error.message)
      notify('Paramètres du centre enregistrés')
    } catch (err) {
      notify(err.message || 'Une erreur est survenue', 'error')
    } finally {
      setGeneralSaving(false)
    }
  }

  const saveTemplate = async (type) => {
    setTemplateSaving(type)
    try {
      const existing = templates[type]
      const { error } = existing
        ? await supabase.from('whatsapp_templates').update({ content: templateDrafts[type] }).eq('id', existing.id)
        : await supabase.from('whatsapp_templates').insert({ type, content: templateDrafts[type] })
      if (error) throw new Error(error.message)
      applyData(await loadAcademicData())
      notify('Template WhatsApp enregistré')
    } catch (err) {
      notify(err.message || 'Une erreur est survenue', 'error')
    } finally {
      setTemplateSaving(null)
    }
  }

  const saveLevel = async (name, cycleId) => {
    const { error } = await supabase.from('levels').insert({ cycle_id: cycleId, name })
    if (error) throw new Error(error.message)
    setModal(null)
    await fetchAll()
    notify('Niveau ajouté')
  }

  const saveSubject = async (name) => {
    const { error } = await supabase.from('subjects').insert({ name })
    if (error) throw new Error(error.message)
    setModal(null)
    await fetchAll()
    notify('Matière ajoutée')
  }

  const saveCycle = async (form, editing) => {
    const payload = {
      name: form.name,
      has_fixed_price: form.has_fixed_price,
      fixed_price: form.has_fixed_price ? Number(form.fixed_price) : 0,
    }
    const { error } = editing
      ? await supabase.from('cycles').update(payload).eq('id', form.id)
      : await supabase.from('cycles').insert(payload)
    if (error) throw new Error(error.message)
    setModal(null)
    await fetchAll()
    notify(editing ? 'Cycle mis à jour' : 'Cycle ajouté')
  }

  const deleteCycle = async (id) => {
    if (!window.confirm('Supprimer ce cycle ainsi que tous ses niveaux et filières ?')) return
    const { error } = await supabase.from('cycles').delete().eq('id', id)
    if (error) return notify(error.message, 'error')
    await fetchAll()
    notify('Cycle supprimé')
  }

  const toggleFixedPrice = async (id, value) => {
    const cycle = cycles.find((c) => c.id === id)
    const { error } = await supabase.from('cycles').update({
      has_fixed_price: value,
      fixed_price: value ? (cycle?.fixed_price ?? 0) : 0,
    }).eq('id', id)
    if (error) return notify(error.message, 'error')
    await fetchAll()
    notify(value ? 'Prix fixe activé pour le cycle' : 'Prix fixe désactivé')
  }

  const deleteLevel = async (id) => {
    if (!window.confirm('Supprimer ce niveau et ses filières ?')) return
    const { error } = await supabase.from('levels').delete().eq('id', id)
    if (error) return notify(error.message, 'error')
    await fetchAll()
    notify('Niveau supprimé')
  }

  const addStudyBranch = async (levelId) => {
    const name = (branchDrafts[levelId] || '').trim()
    if (!name) return
    const { error } = await supabase.from('study_branches').insert({ level_id: levelId, name })
    if (error) return notify(error.message, 'error')
    setBranchDrafts((d) => ({ ...d, [levelId]: '' }))
    await fetchAll()
    notify('Filière ajoutée')
  }

  const deleteStudyBranch = async (id) => {
    if (!window.confirm('Supprimer cette filière ?')) return
    const { error } = await supabase.from('study_branches').delete().eq('id', id)
    if (error) return notify(error.message, 'error')
    await fetchAll()
    notify('Filière supprimée')
  }

  const saveAllTariffs = async () => {
    setTariffSaving(true)
    try {
      const existing = new Map(tariffs.map((t) => [`${t.level_id}::${t.subject_id}`, t]))
      const rows = []
      const toDelete = []
      for (const [key, raw] of Object.entries(tariffDrafts)) {
        const [level_id, subject_id] = key.split('::')
        const trimmed = String(raw).trim()
        if (trimmed !== '' && !Number.isNaN(Number(trimmed)) && Number(trimmed) > 0) {
          rows.push({ level_id, subject_id, price: Number(trimmed) })
        } else if (existing.has(key)) {
          toDelete.push({ level_id, subject_id })
        }
      }
      if (toDelete.length > 0) {
        for (const d of toDelete) {
          const { error } = await supabase.from('tariffs').delete().eq('level_id', d.level_id).eq('subject_id', d.subject_id)
          if (error) throw new Error(error.message)
        }
      }
      if (rows.length > 0) {
        const { error } = await supabase.from('tariffs').upsert(rows, { onConflict: 'level_id,subject_id' })
        if (error) throw new Error(error.message)
      }
      applyData(await loadAcademicData(), { resetTariffDrafts: true })
      notify('Grille tarifaire enregistrée')
    } catch (err) {
      notify(err.message || 'Une erreur est survenue', 'error')
    } finally {
      setTariffSaving(false)
    }
  }

  const saveRegistrationFee = async () => {
    const amount = Number(registrationFeeDraft)
    if (!Number.isFinite(amount) || amount < 0) {
      notify('Le montant des frais d’inscription est invalide', 'error')
      return
    }
    try {
      await saveAppSettings({ registrationFee: amount })
      setAppSettings((current) => ({ ...current, registrationFee: amount }))
      notify('Frais d’inscription enregistrés')
    } catch (err) {
      notify(err.message || 'Une erreur est survenue', 'error')
    }
  }

  const applySchoolYearChange = async () => {
    try {
      await saveAppSettings({ activeSchoolYear: schoolYearDraft })
      setAppSettings((current) => ({ ...current, activeSchoolYear: schoolYearDraft }))
      setModal(null)
      notify(`Année scolaire active : ${schoolYearDraft}`)
    } catch (err) {
      notify(err.message || 'Une erreur est survenue', 'error')
    }
  }

  const handleGlobalStudentsAction = async () => {
    const mode = studentSummary.active > 0 ? 'deactivate' : 'reactivate'
    const confirmationText = confirmationTexts[mode]

    try {
      if (mode === 'deactivate') {
        await deactivateAllStudents()
      } else {
        await reactivateAllStudents()
      }

      const { error } = await supabase.from('activity_logs').insert({
        user_id: user?.id,
        action: mode === 'deactivate' ? 'students_deactivated_all' : 'students_reactivated_all',
        message: mode === 'deactivate'
          ? 'Tous les élèves actifs ont été désactivés.'
          : 'Tous les élèves ont été réactivés.',
        confirmation_text: confirmationText,
        created_at: new Date().toISOString(),
      })

      if (error) throw new Error(error.message)

      setModal(null)
      await refreshStudentSummary()
      notify(mode === 'deactivate' ? 'Tous les élèves ont été désactivés.' : 'Tous les élèves ont été réactivés.')
    } catch (err) {
      notify(err.message || 'Une erreur est survenue', 'error')
      throw err
    }
  }

  if (loading) {
    return (
      <div className="settings-page">
        <main className="settings-content" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
          <p>Chargement de la configuration...</p>
        </main>
      </div>
    )
  }

  return (
    <div className="settings-page">
      <Header />

      <main className="settings-content">
        <h1>Paramètres</h1>
        <p>Configuration générale de la plateforme.</p>

        <nav className="settings-tabs">
          {[['general', '▦ Général'], ['academic', '≡ Structure académique'], ['pricing', '⛓ Grille tarifaire'], ['whatsapp', '□ Template WhatsApp']].map(([id, label]) => (
            <button className={tab === id ? 'active' : ''} onClick={() => setTab(id)} key={id}>{label}</button>
          ))}
        </nav>

        {tab === 'general' && (
          <>
            <form className="settings-card settings-general" onSubmit={saveCenterSettings}>
              <div>
                <label>Nom du centre<input value={centerForm.center_name} onChange={(e) => setCenterForm((f) => ({ ...f, center_name: e.target.value }))} /></label>
                <label>Adresse principale<input value={centerForm.address} onChange={(e) => setCenterForm((f) => ({ ...f, address: e.target.value }))} /></label>
                <div className="settings-two">
                  <label>
                    Téléphone
                    <input
                      type="tel"
                      inputMode="numeric"
                      value={centerForm.phone}
                      onChange={(e) => setCenterPhone(e.target.value)}
                      onBlur={validateCenterPhone}
                    />
                    {centerPhoneError && <small className="phone-error">{centerPhoneError}</small>}
                  </label>
                  <label>Email<input value={centerForm.contact_info} onChange={(e) => setCenterForm((f) => ({ ...f, contact_info: e.target.value }))} /></label>
                </div>
              </div>
              <div className="settings-logo-col">
                <label className="settings-logo"><Icon name="upload" /><span>Importer un logo</span><input type="file" hidden /></label>
                <label>URL du logo<input value={centerForm.logo_url} onChange={(e) => setCenterForm((f) => ({ ...f, logo_url: e.target.value }))} placeholder="https://..." /></label>
              </div>
              <button className="settings-save" disabled={generalSaving}>{generalSaving ? 'Enregistrement...' : (<><Icon name="save" /> Enregistrer</>)}</button>
            </form>

            <section className="settings-card settings-global-actions">
              <header className="settings-card-head">
                <div>
                  <strong>Actions globales</strong>
                  <p>Opérations critiques sur l'ensemble des élèves de la plateforme.</p>
                </div>
              </header>

              <div className="settings-global-actions__body">
                <div>
                  <p>
                    {studentSummary.loading
                      ? 'Chargement de l’état des élèves...'
                      : studentSummary.active > 0
                        ? `${studentSummary.active} élève(s) actif(s) sur ${studentSummary.total}.`
                        : `${studentSummary.total} élève(s) actuellement désactivé(s).`}
                  </p>
                  <small>La confirmation exigera une saisie exacte et la validation du mot de passe de votre compte.</small>
                </div>
                <button
                  className="settings-outline settings-danger-action"
                  onClick={() => setModal({ kind: 'studentsAction', mode: studentSummary.active > 0 ? 'deactivate' : 'reactivate' })}
                  disabled={studentSummary.loading || studentSummary.total === 0}
                >
                  {studentSummary.active > 0 ? 'Désactiver tous les élèves' : 'Réactiver tous les élèves'}
                </button>
              </div>
            </section>
          </>
        )}

        {tab === 'academic' && (
          <section className="settings-card settings-academic">
            <header className="settings-card-head">
              <div><strong>Structure académique</strong><p>Cycles (collège, lycée...), niveaux et filières d'étude.</p></div>
              <button className="settings-outline" onClick={() => setModal({ kind: 'cycle' })}>＋　Ajouter un cycle</button>
            </header>

            {cycles.length === 0
              ? <div className="settings-empty">Aucun cycle. Commencez par créer un cycle.</div>
              : <div className="academic-list">
                {cycles.map((cycle) => (
                  <article className="academic-card" key={cycle.id}>
                    <header className="academic-card__head">
                      <div className="academic-card__title">
                        <strong>{cycle.name}</strong>
                        <span>{(levelsByCycle[cycle.id] || []).length} niveau(x) · {branchCountByCycle[cycle.id] || 0} filière(s)</span>
                      </div>
                      <div className="academic-card__fixed">
                        <span>Prix fixe</span>
                        <label className="settings-switch"><input type="checkbox" checked={Boolean(cycle.has_fixed_price)} onChange={(e) => toggleFixedPrice(cycle.id, e.target.checked)} /><i /></label>
                        <strong className={cycle.has_fixed_price ? 'academic-fixed-price' : 'academic-fixed-price is-none'}>{cycle.has_fixed_price ? `${cycle.fixed_price} DH` : '—'}</strong>
                      </div>
                      <div className="academic-card__actions">
                        <button className="settings-icon-btn" onClick={() => setModal({ kind: 'cycle', cycle })} aria-label="Modifier le cycle"><Pencil /></button>
                        <button className="settings-icon-btn is-danger" onClick={() => deleteCycle(cycle.id)} aria-label="Supprimer le cycle"><Trash /></button>
                      </div>
                    </header>

                    <div className="academic-levels">
                      {(levelsByCycle[cycle.id] || []).map((level) => (
                        <div className="level-row" key={level.id}>
                          <div className="level-row__head">
                            <strong>{level.name}</strong>
                            <button className="settings-icon-btn is-danger" onClick={() => deleteLevel(level.id)} aria-label={`Supprimer le niveau ${level.name}`}><Trash /></button>
                          </div>
                          <div className="branch-chips">
                            {(branchesByLevel[level.id] || []).map((b) => (
                              <span className="branch-chip" key={b.id}>{b.name}<button onClick={() => deleteStudyBranch(b.id)} aria-label={`Supprimer la filière ${b.name}`}>×</button></span>
                            ))}
                            {(branchesByLevel[level.id] || []).length === 0 && <span className="branch-empty">Aucune filière</span>}
                            <span className="branch-add">
                              <input placeholder="Nouvelle filière" value={branchDrafts[level.id] || ''} onChange={(e) => setBranchDrafts((d) => ({ ...d, [level.id]: e.target.value }))} onKeyDown={(e) => { if (e.key === 'Enter') addStudyBranch(level.id) }} />
                              <button onClick={() => addStudyBranch(level.id)} aria-label="Ajouter la filière">＋</button>
                            </span>
                          </div>
                        </div>
                      ))}
                      {(levelsByCycle[cycle.id] || []).length === 0 && <div className="settings-empty">Aucun niveau pour ce cycle.</div>}
                      <button className="settings-outline settings-level-add" onClick={() => setModal({ kind: 'academicLevel', cycleId: cycle.id })}>＋　Ajouter un niveau</button>
                    </div>
                  </article>
                ))}
              </div>}
          </section>
        )}

        {tab === 'pricing' && (
          <>
          <section className="settings-card settings-registration-fee">
            <header className="settings-card-head">
              <div>
                <strong>Frais d'inscription</strong>
                <p>Montant unique payé une fois par élève et par année scolaire, distinct des frais mensuels.</p>
              </div>
            </header>
            {!isSuperAdmin && (
              <p className="registration-fee-locked">Seul un Super Admin peut modifier ces réglages.</p>
            )}
            <div className="registration-fee-fields">
              <label>
                Frais d'inscription (DH)
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={registrationFeeDraft}
                  disabled={!isSuperAdmin}
                  onChange={(e) => setRegistrationFeeDraft(e.target.value)}
                />
              </label>
              <label>
                Année scolaire active
                <select
                  value={schoolYearDraft}
                  disabled={!isSuperAdmin}
                  onChange={(e) => setSchoolYearDraft(e.target.value)}
                >
                  {schoolYearChoices.map((year) => <option key={year} value={year}>{year}</option>)}
                </select>
              </label>
            </div>
            <footer className="registration-fee-footer">
              <button
                className="settings-save"
                disabled={!isSuperAdmin || !feeChanged}
                onClick={saveRegistrationFee}
              >
                <Icon name="save" /> Enregistrer le montant
              </button>
              <button
                className="settings-save"
                disabled={!isSuperAdmin || !schoolYearChanged}
                onClick={() => setModal({ kind: 'schoolYear' })}
              >
                Changer l'année active
              </button>
            </footer>
          </section>

          <section className="settings-card settings-pricing">
            <header className="settings-card-head">
              <div><strong>Grille tarifaire (DH / mois)</strong><p>Prix par matière et par niveau. Modifiez les tarifs puis enregistrez.</p></div>
              <button className="settings-outline" onClick={() => setModal({ kind: 'level' })}>＋　Ajouter un niveau</button>
            </header>

            {levels.length === 0 || subjects.length === 0
              ? <div className="settings-empty">{levels.length === 0 ? 'Aucun niveau. Ajoutez un niveau pour commencer.' : 'Aucune matière. Ajoutez une matière pour commencer.'}</div>
              : (
                <div className="pricing-matrix">
                  <table>
                    <thead>
                      <tr>
                        <th className="pricing-level-col">Niveau</th>
                        {subjects.map((subject) => <th key={subject.id}>{subject.name}</th>)}
                        <th className="pricing-add-col">Matière</th>
                      </tr>
                    </thead>
                    <tbody>
                      {levels.map((level) => {
                        const cycle = cycleMap[level.cycle_id]
                        return (
                          <tr key={level.id}>
                            <td className="pricing-level-cell">
                              <strong>{level.name}</strong>
                              {cycle && <span>{cycle.name}</span>}
                            </td>
                            {subjects.map((subject) => {
                              const key = `${level.id}::${subject.id}`
                              const value = tariffDrafts[key] || ''
                              return (
                                <td key={subject.id}>
                                  <div className="pricing-cell">
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={value}
                                      placeholder="—"
                                      aria-label={`Tarif ${subject.name} pour ${level.name}`}
                                      onChange={(e) => setPricingValue(level.id, subject.id, e.target.value)}
                                    />
                                    {value !== '' && (
                                      <button className="pricing-cell-trash" onClick={() => setPricingValue(level.id, subject.id, '')} aria-label={`Supprimer le tarif ${subject.name} pour ${level.name}`}><Trash /></button>
                                    )}
                                  </div>
                                </td>
                              )
                            })}
                            <td className="pricing-add-col">
                              <button className="pricing-add-subject" onClick={() => setModal({ kind: 'subject' })}>＋　Matière</button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}

            <footer className="pricing-footer">
              <button className="settings-save" onClick={saveAllTariffs} disabled={tariffSaving}>{tariffSaving ? 'Enregistrement...' : (<><Icon name="save" /> Enregistrer</>)}</button>
            </footer>
          </section>
          </>
        )}

        {tab === 'whatsapp' && (
          <section className="settings-card settings-whatsapp">
            <TemplateEditor
              label="Rappel de paiement"
              value={templateDrafts.payment_reminder}
              placeholders={['{nom_eleve}', '{montant_du}', '{mois}', '{succursale}']}
              onChange={(v) => setTemplateDrafts((d) => ({ ...d, payment_reminder: v }))}
              saving={templateSaving === 'payment_reminder'}
              onSave={() => saveTemplate('payment_reminder')}
              renderPreview={templatePreview}
            />
            <TemplateEditor
              label="Bulletin de salaire"
              value={templateDrafts.salary_bulletin}
              placeholders={['{nom_prof}', '{montant}', '{mois}', '{succursale}']}
              onChange={(v) => setTemplateDrafts((d) => ({ ...d, salary_bulletin: v }))}
              saving={templateSaving === 'salary_bulletin'}
              onSave={() => saveTemplate('salary_bulletin')}
              renderPreview={templatePreview}
            />
          </section>
        )}
      </main>

      {modal?.kind === 'cycle' && <CycleModal cycle={modal.cycle} onClose={() => setModal(null)} onSave={saveCycle} />}
      {modal?.kind === 'academicLevel' && <NameModal title="Ajouter un niveau" label="Nom du niveau" placeholder="ex : 1ère année" onClose={() => setModal(null)} onSave={(name) => saveLevel(name, modal.cycleId)} />}
      {modal?.kind === 'level' && <LevelModal cycles={cycles} onClose={() => setModal(null)} onSave={saveLevel} />}
      {modal?.kind === 'subject' && <NameModal title="Ajouter une matière" label="Nom de la matière" placeholder="ex : Philosophie" onClose={() => setModal(null)} onSave={saveSubject} />}
      {modal?.kind === 'schoolYear' && (
        <SchoolYearChangeModal
          year={schoolYearDraft}
          onClose={() => setModal(null)}
          onConfirm={applySchoolYearChange}
        />
      )}
      {modal?.kind === 'studentsAction' && (
        <GlobalStudentsActionModal
          key={modal.mode}
          mode={modal.mode}
          email={user?.email || profile?.email || ''}
          onClose={() => setModal(null)}
          onConfirm={handleGlobalStudentsAction}
        />
      )}

      <Toast notice={notice} />
    </div>
  )
}

