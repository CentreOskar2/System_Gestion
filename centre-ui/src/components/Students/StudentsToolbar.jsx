export default function StudentsToolbar({ onAddStudent, onDeactivateAll, onOpenAbsenceSheet }) {
  return (
    <div className="students-heading">
      <div>
        <h1>Étudiants</h1>
        {/* The student count will be passed to another component or stay in the parent */}
      </div>
      <div className="actions">
        <button className="print-button" onClick={onOpenAbsenceSheet}>
          ▣ &nbsp; Imprimer fiche d'absence vierge
        </button>
        <button className="deactivate-all" onClick={onDeactivateAll}>
          ◔ &nbsp; Désactiver tous les élèves
        </button>
        <button className="student-add" onClick={onAddStudent}>
          ♧ &nbsp; Ajouter un élève
        </button>
      </div>
    </div>
  )
}
