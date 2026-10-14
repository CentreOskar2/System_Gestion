import Icon from '../../../Icon'

const PAYMENT_DAYS = Array.from({ length: 31 }, (_, index) => index + 1)

// "2026-09-20" -> "20"
const dayOf = (date) => {
  const day = Number(String(date || '').slice(8, 10))
  return day ? String(day) : ''
}

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
            onChange={(e) => {
              set('registrationDate', e.target.value)
              // Tant que le jour de paiement suit la date d'inscription, il la suit
              // encore ; une fois choisi à la main, il n'est plus touché.
              if (form.paymentDay === dayOf(form.registrationDate) && dayOf(e.target.value)) {
                set('paymentDay', dayOf(e.target.value))
              }
            }}
            required
          />
          <small className="field-hint">Première inscription de l'élève au centre.</small>
        </label>
        <label>
          Jour de paiement (chaque mois) *
          <select
            value={form.paymentDay}
            onChange={(e) => set('paymentDay', e.target.value)}
            required
          >
            <option value="">Choisir le jour…</option>
            {PAYMENT_DAYS.map((day) => (
              <option key={day} value={String(day)}>
                Le {day} de chaque mois
              </option>
            ))}
          </select>
          <small className="field-hint">
            {form.paymentDay
              ? `Ex. : le mois d'octobre est dû le ${form.paymentDay.padStart(2, '0')}/10.`
              : "Jour où l'élève doit régler chaque mois."}
          </small>
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
