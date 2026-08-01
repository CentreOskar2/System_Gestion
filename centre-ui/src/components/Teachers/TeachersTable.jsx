import Icon from '../Icon'

export default function TeachersTable({ teachers, onEdit, onToggleStatus, onView }) {
  return (
    <div className="teachers-table-wrap">
      <table className="teachers-table">
        <thead>
          <tr>
            <th>Professeur</th>
            <th>Matière(s)</th>
            <th>Salaire</th>
            <th>Succursale(s)</th>
            <th>Statut</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {teachers.length === 0 && (
            <tr>
              <td colSpan="6" className="teachers-empty">Aucun professeur enregistré.</td>
            </tr>
          )}
          {teachers.map((teacher) => (
            <tr key={teacher.id} className="teacher-table-row" onClick={() => onView(teacher)}>
              <td>
                <div className="teacher-name">
                  <span>
                    {teacher.firstName[0]}
                    {teacher.lastName[0]}
                  </span>
                  <div>
                    <strong>
                      {teacher.firstName} {teacher.lastName}
                    </strong>
                    <small>{teacher.phone}</small>
                  </div>
                </div>
              </td>
              <td>
                {teacher.subjects.map((subject) => (
                  <i className="subject-tag" key={subject}>
                    {subject}
                  </i>
                ))}
              </td>
              <td>
                <span className={`pay-tag ${teacher.paymentType}`}>
                  {teacher.paymentType === 'fixe' ? 'Fixe' : 'Pourcentage'}
                </span>
              </td>
              <td>
                {teacher.branches.map((branch) => branch.replace('Succursale ', '')).join(', ')}
              </td>
              <td>
                <span className={`teacher-status ${teacher.active ? 'active' : ''}`}>
                  {teacher.active ? 'Actif' : 'Inactif'}
                </span>
              </td>
              <td>
                <div className="teacher-actions">
                  <button onClick={(event) => { event.stopPropagation(); onEdit(teacher) }} aria-label="Modifier">
                    <Icon name="pencil" />
                  </button>
                  <button
                    className={teacher.active ? '' : 'is-off'}
                    onClick={(event) => { event.stopPropagation(); onToggleStatus(teacher.id) }}
                    aria-label="Activer ou désactiver"
                  >
                    <Icon name="power" />
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
