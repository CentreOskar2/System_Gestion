export default function Step2Classification({ form, set, catalog }) {
  const cycles = catalog.cycles || []
  const levels = (catalog.levelsByCycle && catalog.levelsByCycle[form.cycle]) || []
  const filieres = (catalog.branchesByLevel && catalog.branchesByLevel[form.level]) || []

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
      <div className="enrollment-grid">
        <label>
          Cycle *
          <select value={form.cycle} onChange={handleCycleChange} required>
            <option value="">— Sélectionner cycle —</option>
            {cycles.map((cycle) => (
              <option key={cycle.id} value={cycle.name}>{cycle.name}</option>
            ))}
          </select>
        </label>
        <label>
          Niveau *
          <select value={form.level} onChange={handleLevelChange} required>
            <option value="">— Sélectionner niveau —</option>
            {levels.map((level) => (
              <option key={level} value={level}>{level}</option>
            ))}
          </select>
        </label>
        {filieres.length > 0 && (
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
