import { useRef, useState } from 'react'
import Icon from '../../Icon'
import { exportToPdf, safeFilename } from '../../../utils/exportToPdf'
import './AttendanceSheet.css'
import './AttendancePdf.css'

const roster = ['Qadiri Salma', 'Tazi Anas', 'Chraibi Malak', 'Fassi Youssef', 'Idrissi Kenza', 'Lahlou Hamza', 'Ouazzani Rim', 'Riad Bilal']
const sessions = Array.from({ length: 18 }, (_, index) => `S${index + 1}`)

function AttendanceSheet({ values, close }) {
  const sheetRef = useRef(null)
  const [isExporting, setIsExporting] = useState(false)
  const downloadPdf = async () => {
    setIsExporting(true)
    try { await exportToPdf(sheetRef.current, `fiche-absence-${safeFilename(values.teacher)}-${safeFilename(values.subject)}-${safeFilename(values.group)}.pdf`) } finally { setIsExporting(false) }
  }
  return <main className="absence-sheet-page"><div className="absence-sheet-actions"><button onClick={close}>← Retour aux étudiants</button><button className="absence-print" disabled={isExporting} onClick={downloadPdf}>{isExporting ? 'Génération du PDF…' : '▣  Télécharger le PDF'}</button></div><article ref={sheetRef} className="absence-sheet"><header className="absence-sheet-header"><div className="absence-brand"><img src="/oskar-logo.png" alt="Centre Oskar" /><div><strong>Centre Oskar</strong><span>Fiche de présence —</span></div></div><div><strong>Fiche d'absence</strong><span>Année scolaire 2026 – 2027</span></div></header><section className="absence-details"><div><small>PROFESSEUR</small><b>{values.teacher}</b></div><div><small>MATIÈRE</small><b>{values.subject}</b></div><div><small>NIVEAU</small><b>{values.level}</b></div><div><small>GROUPE</small><b>{values.group}</b></div></section><table className="absence-table"><thead><tr><th>#</th><th>Élève</th><th>Note°1</th><th>Note°2</th>{sessions.map(session => <th key={session}>{session}</th>)}</tr></thead><tbody>{roster.map((name, index) => <tr key={name}><td>{index + 1}</td><td>{name}</td><td /><td />{sessions.map(session => <td key={session} />)}</tr>)}</tbody></table><p className="absence-help">Cocher <b>P</b> pour présent, <b>A</b> pour absent, <b>R</b> pour retard.</p><footer className="absence-signatures"><span>Signature du professeur</span><span>Signature de l'administration</span></footer></article></main>
}

export default function AbsenceSheetModal({ close }) {
  const [values, setValues] = useState({ teacher: '', subject: '', level: '', group: '' })
  const [generated, setGenerated] = useState(false)
  const update = (field) => (event) => setValues((current) => ({ ...current, [field]: event.target.value }))
  if (generated) return <AttendanceSheet values={values} close={close} />
  const ready = Object.values(values).every(Boolean)
  return <div className="student-overlay" onMouseDown={close}><section className="absence-modal" onMouseDown={(event) => event.stopPropagation()}><button className="student-close" onClick={close}><Icon name="close" /></button><h2>Fiche d'absence vierge</h2><p>Sélectionnez les paramètres pour générer la fiche imprimable.</p><label>Professeur<select value={values.teacher} onChange={update('teacher')}><option value="">—</option><option>Youssef Tazi</option><option>Karim El Amrani</option><option>Salma Bennani</option></select></label><label>Matière<select value={values.subject} onChange={update('subject')}><option value="">—</option><option>Anglais</option><option>Mathématiques</option><option>Physique-Chimie</option><option>Français</option></select></label><label>Niveau<select value={values.level} onChange={update('level')}><option value="">—</option><option>Tronc commun</option><option>9ème (3AC)</option><option>2ème Bac</option></select></label><label>Groupe<select value={values.group} onChange={update('group')}><option value="">—</option><option>Anglais — Tronc commun · G1</option><option>Groupe A</option><option>Groupe B</option></select></label><footer><button onClick={close}>Annuler</button><button disabled={!ready} onClick={() => setGenerated(true)}>▣ &nbsp; Générer la fiche</button></footer></section></div>
}
