import Icon from '../Icon'

export default function StudentsToolbar({ onAddStudent, onOpenAbsenceSheet }) {
  return (
    <div className="students-heading">
      <div>
        <h1>Étudiants</h1>
        {/* The student count will be passed to another component or stay in the parent */}
      </div>
      <div className="actions">
        <button className="print-button" onClick={onOpenAbsenceSheet}>
          <Icon name="printer" /> Imprimer fiche d'absence vierge
        </button>
        <button className="student-add" onClick={onAddStudent}>
          <Icon name="user-plus" /> Ajouter un élève
        </button>
      </div>
    </div>
  )
}
