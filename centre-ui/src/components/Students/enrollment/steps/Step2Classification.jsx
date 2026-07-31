import { levelsByCycle, branchesByLevel } from '../../data/mockStudents'

export default function Step2Classification({ form, set }) {
  const handleCycleChange = (e) => {
    const newCycle = e.target.value
    // Reset level and track when cycle changes
    set('cycle', newCycle)
    set('level', '')
    set('track', '')
  }

  const handleLevelChange = (e) => {
    const newLevel = e.target.value
    // Reset track when level changes
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
            {Object.keys(levelsByCycle).map((cycle) => (
              <option key={cycle}>{cycle}</option>
            ))}
          </select>
        </label>
        <label>
          Niveau *
          <select value={form.level} onChange={handleLevelChange} required>
            <option value="">— Sélectionner niveau —</option>
            {(levelsByCycle[form.cycle] || []).map((level) => (
              <option key={level}>{level}</option>
            ))}
          </select>
        </label>
        {branchesByLevel[form.level] && (
          <label>
            Filière *
            <select
              value={form.track}
              onChange={(e) => set('track', e.target.value)}
              required
            >
              <option value="">— Sélectionner filière —</option>
              {(branchesByLevel[form.level] || []).map((branch) => (
                <option key={branch}>{branch}</option>
              ))}
            </select>
          </label>
        )}
      </div>
    </>
  )
}
