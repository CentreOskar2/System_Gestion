import Icon from '../Icon'

export default function StudentsTable({
  students,
  catalog,
  onOpenSheet,
  onEditStudent,
  onToggleStatus,
  onOpenAttendance,
}) {
  const subjectLabel = (student) => {
    const cycle = catalog?.cycleByName?.[student.cycle]
    if (cycle?.has_fixed_price) {
      return `${Number(cycle.fixed_price || 0).toLocaleString('fr-FR')} DH`
    }
    return student.subjects
  }
  return (
    <div className="students-table-wrapper">
      <table className="students-table">
        <thead>
          <tr>
            <th>Nom</th>
            <th>Matricule</th>
            <th>Parcours</th>
            <th>Succursale</th>
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
                <span className="student-name-button">{student.name}</span>
              </td>
              <td>{student.code}</td>
              <td>
                <b>{[student.cycle, student.level].filter(Boolean).join(' · ')}</b>
              </td>
              <td>{student.branch}</td>
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
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
