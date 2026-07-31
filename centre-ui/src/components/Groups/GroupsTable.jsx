import Icon from '../Icon'

export default function GroupsTable({ groups, onEdit, onToggleStatus }) {
  return (
    <div className="groups-table-wrap">
      <table className="groups-table">
        <thead>
          <tr>
            <th>Groupe</th>
            <th>Matière</th>
            <th>Niveau</th>
            <th>Professeur</th>
            <th>Succursale</th>
            <th>Élèves</th>
            <th>Statut</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <tr key={group.id}>
              <td>
                <strong>{group.name}</strong>
              </td>
              <td>
                <span className="group-subject">{group.subject}</span>
              </td>
              <td>{group.level}</td>
              <td>{group.teacher}</td>
              <td>{group.branch}</td>
              <td>
                <span className="group-count">♧ {group.studentIds.length}</span>
              </td>
              <td>
                <span className={`group-status ${group.active ? 'active' : ''}`}>
                  {group.active ? 'Actif' : 'Inactif'}
                </span>
              </td>
              <td>
                <div className="group-actions">
                  <button onClick={() => onEdit(group)}>
                    <Icon name="pencil" />
                  </button>
                  <button
                    onClick={() => onToggleStatus(group.id)}
                    className={group.active ? '' : 'off'}
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
