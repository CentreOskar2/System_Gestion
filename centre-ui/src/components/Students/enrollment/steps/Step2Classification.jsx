export default function Step2Classification({ form, set, catalog }) {
  const cycles = catalog.cycles || []
  const levels = (catalog.levelsByCycle && catalog.levelsByCycle[form.cycle]) || []
  const filieres = (catalog.branchesByLevel && catalog.branchesByLevel[form.level]) || []
  const formationOnly = Boolean(form.formationOnly)

  // Bascule « formation seule » : l'élève n'a alors ni cycle, ni niveau, ni
  // filière. On vide ces champs pour ne pas enregistrer un parcours fantôme.
  const toggleFormationOnly = (checked) => {
    set('formationOnly', checked)
    if (checked) {
      set('cycle', '')
      set('level', '')
      set('track', '')
    }
  }

  const handleCycleChange = (e) => {
    const newCycle = e.target.value
    set('cycle', newCycle)
    set('level', '')
    set('track', '')
  }

  const handleLevelChange = (e) => {
    const newLevel = e.target.value
    set('level', newLevel)
    set('track', '')
  }

  return (
    <>
      <h2>Classification</h2>
      <p>Choisissez le parcours scolaire de l'élève.</p>

      <label className="enrollment-formation-only">
        <input
          type="checkbox"
          checked={formationOnly}
          onChange={(e) => toggleFormationOnly(e.target.checked)}
        />
        <span>
          <b>Formation seule</b>
          <small>L'élève ne suit aucun cycle scolaire — uniquement une ou plusieurs formations.</small>
        </span>
      </label>

      <div className="enrollment-grid">
        <label>
          Cycle {formationOnly ? '' : '*'}
          <select value={form.cycle} onChange={handleCycleChange} disabled={formationOnly} required={!formationOnly}>
            <option value="">— Sélectionner cycle —</option>
            {cycles.map((cycle) => (
              <option key={cycle.id} value={cycle.name}>{cycle.name}</option>
            ))}
          </select>
        </label>
        <label>
          Niveau {formationOnly ? '' : '*'}
          <select value={form.level} onChange={handleLevelChange} disabled={formationOnly} required={!formationOnly}>
            <option value="">— Sélectionner niveau —</option>
            {levels.map((level) => (
              <option key={level} value={level}>{level}</option>
            ))}
          </select>
        </label>
        {!formationOnly && filieres.length > 0 && (
          <label>
            Filière *
            <select
              value={form.track}
              onChange={(e) => set('track', e.target.value)}
              required
            >
              <option value="">— Sélectionner filière —</option>
              {filieres.map((filiere) => (
                <option key={filiere} value={filiere}>{filiere}</option>
              ))}
            </select>
          </label>
        )}
      </div>
    </>
  )
}
