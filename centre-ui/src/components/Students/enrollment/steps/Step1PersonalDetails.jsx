export default function Step1PersonalDetails({ form, set }) {
  return (
    <>
      <h2>Détails personnels</h2>
      <p>Renseignez les informations de l'élève.</p>
      <label>
        N° d'inscription
        <input value={form.code} readOnly />
      </label>
      <label className="enrollment-photo">
        ⇧<span>Cliquer ou glisser une photo</span>
        <input type="file" />
      </label>
      <div className="enrollment-grid">
        <label>
          Prénom *
          <input
            value={form.firstName}
            onChange={(e) => set('firstName', e.target.value)}
            required
          />
        </label>
        <label>
          Nom *
          <input
            value={form.lastName}
            onChange={(e) => set('lastName', e.target.value)}
            required
          />
        </label>
        <label>
          Date d'inscription *
          <input
            type="date"
            value={form.registrationDate}
            onChange={(e) => set('registrationDate', e.target.value)}
            required
          />
        </label>
        <label>
          Téléphone 1 (WhatsApp) *
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => set('phone', e.target.value)}
            required
          />
        </label>
        <label>
          Téléphone 2 (optionnel)
          <input
            type="tel"
            value={form.phone2}
            onChange={(e) => set('phone2', e.target.value)}
          />
        </label>
        <label>
          Adresse
          <input
            value={form.address}
            onChange={(e) => set('address', e.target.value)}
          />
        </label>
        <label>
          École de provenance
          <input
            value={form.school}
            onChange={(e) => set('school', e.target.value)}
          />
        </label>
        <label>
          Classe (dans l'école)
          <input
            value={form.schoolClass}
            onChange={(e) => set('schoolClass', e.target.value)}
          />
        </label>
      </div>
      <label>
        Alertes médicales ou remarques
        <textarea
          value={form.alerts}
          onChange={(e) => set('alerts', e.target.value)}
          placeholder="Allergies, traitement médical, remarques importantes..."
        />
      </label>
    </>
  )
}
