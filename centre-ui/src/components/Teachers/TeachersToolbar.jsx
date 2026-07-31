export default function TeachersToolbar({ count, onAdd }) {
  return (
    <div className="teachers-heading">
      <div>
        <h1>Professeurs</h1>
        <p>{count} professeurs enregistrés</p>
      </div>
      <button onClick={onAdd} className="teacher-add">
        ♙ <span>Ajouter un professeur</span>
      </button>
    </div>
  )
}
