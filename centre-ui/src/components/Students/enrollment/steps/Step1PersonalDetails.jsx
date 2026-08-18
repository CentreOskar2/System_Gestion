import Icon from '../../../Icon'

export default function Step1PersonalDetails({ form, set, setPhoneField, errors = {}, onPhoneBlur }) {
  const previewUrl = form.photoFile ? URL.createObjectURL(form.photoFile) : form.photoUrl

  return (
    <>
      <h2>Détails personnels</h2>
      <p>Renseignez les informations de l'élève.</p>
      <label>
        N° d'inscription
        <input value={form.code} readOnly />
      </label>
      <label className="enrollment-photo">
        {previewUrl ? (
          <img className="enrollment-photo-preview" src={previewUrl} alt="Photo de l'élève" />
        ) : (
          <>
            <Icon name="upload" />
            <span>Cliquer ou glisser une photo</span>
          </>
        )}
        <input
          type="file"
          accept="image/*"
          onChange={(e) => set('photoFile', e.target.files?.[0] || null)}
        />
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
            inputMode="numeric"
            value={form.phone}
            onChange={(e) => (setPhoneField ? setPhoneField('phone', e.target.value) : set('phone', e.target.value.replace(/\D/g, '')))}
            onBlur={() => onPhoneBlur?.('phone')}
            required
          />
          {errors.phone && <small className="field-error">{errors.phone}</small>}
        </label>
        <label>
          Téléphone 2 (optionnel)
          <input
            type="tel"
            inputMode="numeric"
            value={form.phone2}
            onChange={(e) => (setPhoneField ? setPhoneField('phone2', e.target.value) : set('phone2', e.target.value.replace(/\D/g, '')))}
            onBlur={() => onPhoneBlur?.('phone2')}
          />
          {errors.phone2 && <small className="field-error">{errors.phone2}</small>}
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
