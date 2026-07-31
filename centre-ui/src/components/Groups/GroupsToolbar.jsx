export default function GroupsToolbar({ count, onAddGroup }) {
  return (
    <div className="groups-heading">
      <div>
        <h1>Groupes</h1>
        <p>{count} groupe(s) affiché(s).</p>
      </div>
      <button className="group-add" onClick={onAddGroup}>
        ＋ Créer un groupe
      </button>
    </div>
  )
}
