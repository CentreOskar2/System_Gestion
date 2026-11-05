import Icon from '../Icon'

export default function StudentsTable({
  students,
  catalog,
  onOpenSheet,
  onEditStudent,
  onToggleStatus,
  onOpenAttendance,
  canDeleteStudent = () => false,
  onDeleteStudent,
}) {
  const subjectLabel = (student) => {
    // Au forfait l'élève suit tout le niveau : lister ses matières n'a pas de sens.
    const cycle = catalog?.cycleByName?.[student.cycle]
    if (cycle?.has_fixed_price) return 'Toutes'
    return student.chosen?.length ? student.chosen.join(', ') : '—'
  }
  // Parcours scolaire, puis les formations suivies en dessous : un élève peut
  // suivre un cycle et une formation, ou une formation seule.
  const trackCell = (student) => {
    const track = [student.cycle, student.level].filter(Boolean).join(' · ')
    const formations = student.formations || []
    if (!track && formations.length === 0) return '—'
    return (
      <>
        {track && <b>{track}</b>}
        {formations.length > 0 && (
          <div className="student-formation-tags">
            {formations.map((formation) => {
              const groupName = catalog?.groupsById?.[formation.groupId]?.name
              return (
                <span key={formation.formationLevelId} className="student-formation-tag">
                  {[formation.formationName, formation.levelName].filter(Boolean).join(' · ') || 'Formation'}
                  {groupName && <small>· {groupName}</small>}
                </span>
              )
            })}
          </div>
        )}
      </>
    )
  }
  return (
    <div className="students-table-wrapper">
      <table className="students-table">
        <thead>
          <tr>
            <th>Nom</th>
            <th>Matricule</th>
            <th>Parcours</th>
            <th>Matières</th>
            <th>Paiement</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {students.map((student) => (
            <tr
              key={student.id}
              className={`student-table-row ${student.active ? '' : 'deactivated'}`}
              tabIndex={0}
              onClick={() => onOpenSheet(student)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onOpenSheet(student)
                }
              }}
            >
              <td>
                <div className="student-name-cell">
                  {student.photoUrl ? (
                    <img className="student-table-avatar" src={student.photoUrl} alt="" />
                  ) : (
                    <span className="student-table-avatar">{student.name.charAt(0).toUpperCase()}</span>
                  )}
                  <span className="student-name-button">{student.name}</span>
                </div>
              </td>
              <td>{student.code}</td>
              <td>{trackCell(student)}</td>
              <td>{subjectLabel(student)}</td>
              <td>
                <span className={`payment-status ${student.payment?.toLowerCase()}`}>
                  {student.payment || 'N/A'}
                </span>
              </td>
              <td>
                <div className="student-actions">
                  <button
                    title="Modifier"
                    type="button"
                    aria-label={`Modifier ${student.name}`}
                    onClick={(event) => { event.stopPropagation(); onEditStudent(student) }}
                  >
                    <Icon name="pencil" />
                  </button>
                  <button
                    title={student.active ? 'Désactiver' : 'Activer'}
                    type="button"
                    aria-label={`${student.active ? 'Désactiver' : 'Activer'} ${student.name}`}
                    onClick={(event) => { event.stopPropagation(); onToggleStatus(student.id) }}
                  >
                    <Icon name="power" />
                  </button>
                  <button
                    className="attendance-action"
                    type="button"
                    title="Enregistrer un pointage"
                    aria-label={`Enregistrer un pointage pour ${student.name}`}
                    onClick={(event) => { event.stopPropagation(); onOpenAttendance(student) }}
                  >
                    <Icon name="calendar" />
                  </button>
                  {canDeleteStudent(student) && (
                    <button
                      className="student-delete-action"
                      type="button"
                      title="Supprimer définitivement"
                      aria-label={`Supprimer définitivement ${student.name}`}
                      onClick={(event) => { event.stopPropagation(); onDeleteStudent(student) }}
                    >
                      <Icon name="delete" />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
