import { useEffect, useState } from 'react'
import Icon from '../../Icon'
import { supabase } from '../../../supabaseClient'
import { initials } from '../../Students/utils/studentHelpers'

const formatDate = (date) => {
  if (!date) return '—'
  return new Intl.DateTimeFormat('fr-MA').format(new Date(date))
}

export default function GroupDetailsModal({ group, close, onManage }) {
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      if (!group || (group.studentIds || []).length === 0) {
        setStudents([])
        setLoading(false)
        return
      }
      const { data, error } = await supabase
        .from('students')
        .select('id, first_name, last_name, registration_number, phone1, registration_date')
        .in('id', group.studentIds)
      if (cancelled) return
      if (error) {
        setStudents([])
      } else {
        setStudents(data || [])
      }
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [group])

  const occupied = (group.studentIds || []).length
  const free = group.capacity != null ? Math.max(0, group.capacity - occupied) : null

  const filtered = students.filter((student) =>
    `${student.first_name} ${student.last_name}`.toLowerCase().includes(query.toLowerCase())
  )

  const meta = [
    { label: 'Matière', value: group.subject || '—' },
    { label: 'Niveau', value: group.level || '—' },
    { label: 'Professeur', value: group.teacher || '—' },
    { label: 'Succursale', value: group.branch || '—' },
  ]

  return (
    <div className="group-details-bg" onMouseDown={close}>
      <aside
        className="group-details"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <header className="group-details-header">
          <div>
            <small>Détails du groupe</small>
            <h2>{group.name}</h2>
          </div>
          <button className="group-close" onClick={close} type="button" aria-label="Fermer">
            <Icon name="close" />
          </button>
        </header>

        <div className="group-details-meta">
          {meta.map((item) => (
            <div className="group-details-meta-item" key={item.label}>
              <span>{item.label}</span>
              <b>{item.value}</b>
            </div>
          ))}
          <div className="group-details-meta-item">
            <span>Capacité</span>
            <b>{free !== null ? `${occupied} / ${group.capacity} places` : `${occupied} élève${occupied > 1 ? 's' : ''}`}</b>
          </div>
          <div className="group-details-meta-item">
            <span>Statut</span>
            <span className={`group-status ${group.active ? 'active' : ''}`}>
              {group.active ? 'Actif' : 'Inactif'}
            </span>
          </div>
        </div>

        {free !== null && (
          <div className="group-capacity-bar">
            <div style={{ width: `${group.capacity ? Math.min(100, (occupied / group.capacity) * 100) : 0}%` }} />
          </div>
        )}

        <div className="group-details-students">
          <div className="group-details-students-head">
            <strong>Élèves ({filtered.length})</strong>
            <button type="button" onClick={onManage}>
              <Icon name="pencil" />
              Gérer les élèves
            </button>
          </div>
          {!loading && students.length > 0 && (
            <label className="group-details-search">
              <Icon name="search" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher un élève par nom..."
              />
            </label>
          )}
          {loading ? (
            <p className="group-students-loading">Chargement des élèves...</p>
          ) : students.length === 0 ? (
            <p className="group-students-empty">Aucun élève inscrit dans ce groupe.</p>
          ) : filtered.length === 0 ? (
            <p className="group-students-empty">Aucun élève trouvé pour « {query} ».</p>
          ) : (
            <div className="group-details-students-list">
              <div className="group-details-student-row group-details-student-row--head">
                <span>Élève</span>
                <span>Matricule</span>
                <span>Téléphone</span>
                <span>Inscription</span>
              </div>
              {filtered.map((student) => (
                <div className="group-details-student-row" key={student.id}>
                  <span className="group-details-student-name">
                    <i>{initials(`${student.first_name} ${student.last_name}`)}</i>
                    <b>{`${student.first_name} ${student.last_name}`}</b>
                  </span>
                  <span>{student.registration_number || '—'}</span>
                  <span>{student.phone1 || '—'}</span>
                  <span>{formatDate(student.registration_date)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>
    </div>
  )
}
