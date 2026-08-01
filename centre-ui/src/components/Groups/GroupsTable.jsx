import Icon from '../Icon'

export default function GroupsTable({ groups, onView, onEdit, onToggleStatus }) {
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
          {groups.length === 0 && (
            <tr>
              <td colSpan="8" className="groups-empty">Aucun groupe enregistré.</td>
            </tr>
          )}
          {groups.map((group) => (
            <tr key={group.id}>
              <td>
                <button className="group-name-btn" onClick={() => onView(group)}>
                  <strong>{group.name}</strong>
                </button>
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
                  <button onClick={() => onView(group)} aria-label="Voir les détails">
                    <Icon name="eye" />
                  </button>
                  <button onClick={() => onEdit(group)} aria-label="Modifier">
                    <Icon name="pencil" />
                  </button>
                  <button
                    onClick={() => onToggleStatus(group.id)}
                    className={group.active ? '' : 'off'}
                    aria-label={group.active ? 'Désactiver' : 'Activer'}
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
