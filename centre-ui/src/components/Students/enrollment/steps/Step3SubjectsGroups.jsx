import { getPrice } from '../enrollmentApi'

export default function Step3SubjectsGroups({ form, set, catalog, toggleGroup, toggleGroupSubject, setSubjectDetails, resetGroups }) {
  const cycles = catalog.cycles || []
  const levels = (catalog.levelsByCycle && catalog.levelsByCycle[form.cycle]) || []
  const groups = form.level
    ? (catalog.groupsByLevel?.[form.level] || [])
        .filter((g) => g.status === 'active')
    : []

  const handleCycleChange = (e) => {
    set('cycle', e.target.value)
    set('level', '')
    set('track', '')
    resetGroups()
  }

  const handleLevelChange = (e) => {
    set('level', e.target.value)
    set('track', '')
    resetGroups()
  }

  const selection = form.groupSelections || []

  return (
    <>
      <h2>Matières &amp; groupes</h2>
      <p>Sélectionnez les groupes de l'élève et les matières suivies dans chaque groupe. La filière renseignée à l'étape précédente reste une information de l'élève.</p>
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
      </div>

      <div className="enrollment-groups">
        {groups.map((group) => {
          const sel = selection.find((s) => s.groupId === group.id)
          const selected = Boolean(sel)
          const free = group.capacity != null ? Math.max(0, group.capacity - (group.student_count || 0)) : null
          return (
            <article key={group.id} className={selected ? 'checked' : ''}>
              <label className="subject-toggle">
                <input type="checkbox" checked={selected} onChange={() => toggleGroup(group)} />
                <span>
                  <b>{group.name}</b>
                  <small>
                    {group.capacity != null ? `${free} place${free !== 1 ? 's' : ''} libre${free !== 1 ? 's' : ''}` : 'Groupe'}
                    {(group.student_count || 0) > 0 ? ` · ${group.student_count} élève${group.student_count > 1 ? 's' : ''}` : ''}
                  </small>
                </span>
              </label>
              {selected && (
                <div className="group-subject-picker">
                  <strong>Matières suivies dans ce groupe</strong>
                  <div className="group-subject-grid">
                    {(catalog.subjects || []).map((subject) => {
                      const checked = sel.subjectNames.includes(subject.name)
                      const standardPrice = getPrice(catalog, form.level, subject.name)
                      return (
                        <label key={subject.id} className={checked ? 'checked' : ''}>
                          <input type="checkbox" checked={checked} onChange={() => toggleGroupSubject(group, subject)} />
                          <span><b>{subject.name}</b><small>{standardPrice} DH/mois</small></span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              )}
            </article>
          )
        })}
      </div>

      {selection.length > 0 && form.chosen.length > 0 && (
        <fieldset className="enrollment-pricing">
          <legend>Tarification des matières</legend>
          <div className="group-subject-grid">
            {form.chosen.map((name) => {
              const standardPrice = getPrice(catalog, form.level, name)
              const details = form.subjectDetails?.[name] || {}
              return (
                <div className="pricing-option-wrap" key={name}>
                  <b className="pricing-subject-name">{name}</b>
                  <label className={details.priceType !== 'manual' ? 'pricing-option active' : 'pricing-option'}>
                    <input type="radio" name={`${name}-pricing`} checked={details.priceType !== 'manual'} onChange={() => setSubjectDetails(name, { priceType: 'standard' })} />
                    <span><b>Prix standard</b><small>{standardPrice} DH/mois</small></span>
                  </label>
                  <label className={details.priceType === 'manual' ? 'pricing-option active' : 'pricing-option'}>
                    <input type="radio" name={`${name}-pricing`} checked={details.priceType === 'manual'} onChange={() => setSubjectDetails(name, { priceType: 'manual' })} />
                    <span><b>Prix manuel</b><input type="number" min="0" placeholder="Montant DH" disabled={details.priceType !== 'manual'} value={details.manualPrice || ''} onChange={(e) => setSubjectDetails(name, { manualPrice: e.target.value })} /></span>
                  </label>
                </div>
              )
            })}
          </div>
        </fieldset>
      )}
    </>
  )
}
