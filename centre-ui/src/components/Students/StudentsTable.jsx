import Icon from '../Icon'

export default function StudentsTable({
  students,
  onOpenSheet,
  onEditStudent,
  onToggleStatus,
  onOpenAttendance,
}) {
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
              className={student.active ? '' : 'deactivated'}
            >
              <td>
                <button
                  className="student-name-button"
                  type="button"
                  onClick={() => onOpenSheet(student)}
                >
                  {student.name}
                </button>
              </td>
              <td>{student.code}</td>
              <td>
                <b>{student.cycle}</b>, {student.level}
              </td>
              <td>{student.branch}</td>
              <td>{student.subjects || 'N/A'}</td>
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
                    onClick={() => onEditStudent(student)}
                  >
                    <Icon name="pencil" />
                  </button>
                  <button
                    title={student.active ? 'Désactiver' : 'Activer'}
                    type="button"
                    aria-label={`${student.active ? 'Désactiver' : 'Activer'} ${student.name}`}
                    onClick={() => onToggleStatus(student.id)}
                  >
                    <Icon name="power" />
                  </button>
                  <button
                    className="attendance-action"
                    type="button"
                    title="Enregistrer un pointage"
                    aria-label={`Enregistrer un pointage pour ${student.name}`}
                    onClick={() => onOpenAttendance(student)}
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
