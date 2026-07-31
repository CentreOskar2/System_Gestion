import { subjects } from '../../data/mockStudents'
import { price } from '../../utils/studentHelpers'

export default function Step3SubjectsGroups({ form, toggleSubject, setSubjectDetails }) {

  return (
    <>
      <h2>Matières &amp; groupes</h2>
      <p>Cochez les matières souhaitées, puis affectez le professeur, le groupe et le tarif.</p>
      <div className="enrollment-subjects">
        {subjects.map((subject) => {
          const selected = form.chosen.includes(subject)
          const details = form.subjectDetails[subject] || {}
          const standardPrice = price(subject)

          return (
            <article key={subject} className={selected ? 'checked' : ''}>
              <label className="subject-toggle">
                <input type="checkbox" checked={selected} onChange={() => toggleSubject(subject)} />
                <span><b>{subject}</b><small>{standardPrice} DH/mois</small></span>
              </label>
              {selected && (
                <div className="subject-configuration">
                  <label>Professeur
                    <select value={details.teacher || ''} onChange={(e) => setSubjectDetails(subject, { teacher: e.target.value })}>
                      <option value="">Choisir un professeur</option>
                      <option>Karim El Amrani</option><option>Salma Bennani</option>
                    </select>
                  </label>
                  <label>Groupe
                    <select value={details.group || ''} onChange={(e) => setSubjectDetails(subject, { group: e.target.value })}>
                      <option value="">Choisir un groupe</option>
                      <option>Groupe A</option><option>Groupe B</option><option>Groupe C</option>
                    </select>
                  </label>
                  <fieldset><legend>Tarification</legend>
                    <label className={details.priceType !== 'manual' ? 'pricing-option active' : 'pricing-option'}>
                      <input type="radio" name={`${subject}-pricing`} checked={details.priceType !== 'manual'} onChange={() => setSubjectDetails(subject, { priceType: 'standard' })} />
                      <span><b>Prix standard</b><small>{standardPrice} DH/mois</small></span>
                    </label>
                    <label className={details.priceType === 'manual' ? 'pricing-option active' : 'pricing-option'}>
                      <input type="radio" name={`${subject}-pricing`} checked={details.priceType === 'manual'} onChange={() => setSubjectDetails(subject, { priceType: 'manual' })} />
                      <span><b>Prix manuel</b><input type="number" min="0" placeholder="Montant DH" disabled={details.priceType !== 'manual'} value={details.manualPrice || ''} onChange={(e) => setSubjectDetails(subject, { manualPrice: e.target.value })} /></span>
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
