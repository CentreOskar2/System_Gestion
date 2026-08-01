import { getPrice } from '../enrollmentApi'

export default function Step3SubjectsGroups({ form, toggleSubject, setSubjectDetails, catalog }) {
  const subjects = catalog.subjects || []
  const level = catalog.levelByName[form.level]

  const groupsFor = (subject) => {
    return (catalog.groupsBySubject?.[subject.name] || []).filter(
      (g) => g.status === 'active' && (!g.level_id || !level || g.level_id === level.id)
    )
  }

  const teachersFor = (subject) => {
    const mappedIds = catalog.teachersBySubject?.[subject.id] || []
    const available = catalog.teachers.filter((t) => mappedIds.length === 0 || mappedIds.includes(t.id))
    return available.map((t) => t.name)
  }

  const teacherNameOf = (groupId) => {
    const teacher = groupId ? catalog.teachersById[groupId] : null
    return teacher ? `${teacher.first_name} ${teacher.last_name}` : ''
  }

  const handleGroupChange = (subjectName, groupName, groups) => {
    if (!groupName) {
      setSubjectDetails(subjectName, { group: '', teacher: '' })
      return
    }
    const group = groups.find((g) => g.name === groupName)
    setSubjectDetails(subjectName, { group: groupName, teacher: teacherNameOf(group?.teacher_id) })
  }

  const groupLabel = (group) => {
    const teacher = teacherNameOf(group.teacher_id)
    const teacherStr = teacher ? ` — ${teacher}` : ''
    const free = group.capacity != null ? Math.max(0, group.capacity - (group.student_count || 0)) : null
    const capacityStr = free !== null ? ` · ${free} place${free !== 1 ? 's' : ''}` : ''
    return `${group.name}${teacherStr}${capacityStr}`
  }

  return (
    <>
      <h2>Matières &amp; groupes</h2>
      <p>Cochez les matières souhaitées, puis affectez le groupe et le tarif.</p>
      <div className="enrollment-subjects">
        {subjects.map((subject) => {
          const selected = form.chosen.includes(subject.name)
          const details = form.subjectDetails[subject.name] || {}
          const standardPrice = getPrice(catalog, form.level, subject.name)
          const groups = groupsFor(subject)
          const selectedGroup = groups.find((g) => g.name === details.group)

          return (
            <article key={subject.id} className={selected ? 'checked' : ''}>
              <label className="subject-toggle">
                <input type="checkbox" checked={selected} onChange={() => toggleSubject(subject.name)} />
                <span><b>{subject.name}</b><small>{standardPrice} DH/mois</small></span>
              </label>
              {selected && (
                <div className="subject-configuration">
                  {groups.length > 0 ? (
                    <>
                      <label>Groupe
                        <select
                          value={details.group || ''}
                          onChange={(e) => handleGroupChange(subject.name, e.target.value, groups)}
                        >
                          <option value="">Choisir un groupe</option>
                          {groups.map((group) => (
                            <option key={group.id} value={group.name}>
                              {groupLabel(group)}
                            </option>
                          ))}
                        </select>
                      </label>
                      {details.group && (
                        <div className="subject-group-details">
                          <div><span>Professeur</span><b>{details.teacher || '—'}</b></div>
                          <div><span>Élèves ({selectedGroup?.students?.length || 0})</span>
                            <b>{(selectedGroup?.students?.length || 0) > 0 ? selectedGroup.students.join(', ') : 'Aucun élève inscrit'}</b>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <label>Professeur
                      <select
                        value={details.teacher || ''}
                        onChange={(e) => setSubjectDetails(subject.name, { teacher: e.target.value })}
                      >
                        <option value="">Choisir un professeur</option>
                        {teachersFor(subject).map((name) => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                      </select>
                      <small className="subject-teacher-hint">Aucun groupe disponible pour ce niveau.</small>
                    </label>
                  )}
                  <fieldset><legend>Tarification</legend>
                    <label className={details.priceType !== 'manual' ? 'pricing-option active' : 'pricing-option'}>
                      <input type="radio" name={`${subject.name}-pricing`} checked={details.priceType !== 'manual'} onChange={() => setSubjectDetails(subject.name, { priceType: 'standard' })} />
                      <span><b>Prix standard</b><small>{standardPrice} DH/mois</small></span>
                    </label>
                    <label className={details.priceType === 'manual' ? 'pricing-option active' : 'pricing-option'}>
                      <input type="radio" name={`${subject.name}-pricing`} checked={details.priceType === 'manual'} onChange={() => setSubjectDetails(subject.name, { priceType: 'manual' })} />
                      <span><b>Prix manuel</b><input type="number" min="0" placeholder="Montant DH" disabled={details.priceType !== 'manual'} value={details.manualPrice || ''} onChange={(e) => setSubjectDetails(subject.name, { manualPrice: e.target.value })} /></span>
                    </label>
                  </fieldset>
                </div>
              )}
            </article>
          )
        })}
      </div>
    </>
  )
}
