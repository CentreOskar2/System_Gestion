import { useEffect, useState } from 'react'
import { fetchFormationCatalog } from './formationsApi'

// Sélection des formations à l'inscription. Indépendant du parcours scolaire :
// on peut cocher une formation avec ou sans cycle, et le prix retenu vient du
// NIVEAU de formation, sauf prix manuel accordé à cet élève.
export default function FormationPicker({ rows, onChange, required = false }) {
  const [catalog, setCatalog] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let active = true
    fetchFormationCatalog()
      .then((data) => {
        if (active) setCatalog(data)
      })
      .catch((err) => {
        console.error(err)
        if (active) setLoadError(err.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const selected = rows || []
  const rowFor = (levelId) => selected.find((row) => row.formationLevelId === levelId)

  const toggleLevel = (level) => {
    if (rowFor(level.id)) {
      onChange(selected.filter((row) => row.formationLevelId !== level.id))
      return
    }
    // On fige le prix et les libellés du niveau dans la ligne : le formulaire
    // d'inscription peut ainsi calculer un total et afficher un récapitulatif
    // sans avoir à recharger le catalogue de son côté.
    onChange([
      ...selected,
      {
        formationLevelId: level.id,
        formationName: level.formationName,
        levelName: level.name,
        standardPrice: Number(level.price || 0),
        groupId: '',
        teacherId: '',
        priceType: 'standard',
        manualPrice: '',
      },
    ])
  }

  const patchRow = (levelId, patch) => {
    onChange(selected.map((row) => (row.formationLevelId === levelId ? { ...row, ...patch } : row)))
  }

  if (loading) return <p className="enrollment-package-notice"><span>Chargement des formations...</span></p>
  if (loadError) {
    return (
      <p className="enrollment-package-notice">
        <b>Formations indisponibles</b>
        <span>{loadError} — la migration 031_formations.sql a-t-elle été exécutée ?</span>
      </p>
    )
  }

  const formations = (catalog?.formations || []).filter((formation) => formation.status !== 'inactive')

  if (formations.length === 0) {
    return (
      <p className="enrollment-package-notice">
        <b>Aucune formation</b>
        <span>Créez-les dans Paramètres &gt; Formations, puis leurs groupes dans la page Groupes.</span>
      </p>
    )
  }

  return (
    <>
      <h2>Formations{required ? ' *' : ''}</h2>
      <p>
        {required
          ? "Cet élève est inscrit en formation seule : sélectionnez au moins un niveau de formation."
          : "Optionnel — une formation se suit en plus du parcours scolaire et se facture séparément."}
      </p>

      {formations.map((formation) => {
        const levels = catalog.levelsByFormation[formation.id] || []
        if (levels.length === 0) return null
        return (
          <section className="enrollment-formation" key={formation.id}>
            <h3>{formation.name}</h3>
            <div className="enrollment-groups">
              {levels.map((level) => {
                const row = rowFor(level.id)
                const groups = (catalog.groupsByLevel[level.id] || []).filter((g) => g.status !== 'inactive')
                return (
                  <article key={level.id} className={row ? 'checked' : ''}>
                    <label className="subject-toggle">
                      <input type="checkbox" checked={Boolean(row)} onChange={() => toggleLevel(level)} />
                      <span>
                        <b>{level.name}</b>
                        <small>{Number(level.price || 0).toLocaleString('fr-FR')} DH/mois</small>
                      </span>
                    </label>

                    {row && (
                      <div className="group-subject-picker">
                        <label className="formation-group-select">
                          <strong>Groupe</strong>
                          <select value={row.groupId || ''} onChange={(e) => patchRow(level.id, { groupId: e.target.value })}>
                            <option value="">— Aucun groupe —</option>
                            {groups.map((group) => (
                              <option key={group.id} value={group.id}>
                                {group.name}
                                {group.capacity != null ? ` (capacité ${group.capacity})` : ''}
                              </option>
                            ))}
                          </select>
                          {groups.length === 0 && (
                            <small>Aucun groupe pour ce niveau — créez-le dans la page Groupes.</small>
                          )}
                        </label>

                        <div className="pricing-option-wrap">
                          <b className="pricing-subject-name">Tarification</b>
                          <label className={row.priceType !== 'manual' ? 'pricing-option active' : 'pricing-option'}>
                            <input
                              type="radio"
                              name={`formation-${level.id}-pricing`}
                              checked={row.priceType !== 'manual'}
                              onChange={() => patchRow(level.id, { priceType: 'standard' })}
                            />
                            <span><b>Prix standard</b><small>{Number(level.price || 0)} DH/mois</small></span>
                          </label>
                          <label className={row.priceType === 'manual' ? 'pricing-option active' : 'pricing-option'}>
                            <input
                              type="radio"
                              name={`formation-${level.id}-pricing`}
                              checked={row.priceType === 'manual'}
                              onChange={() => patchRow(level.id, { priceType: 'manual' })}
                            />
                            <span>
                              <b>Prix manuel</b>
                              <input
                                type="number"
                                min="0"
                                placeholder="Montant DH"
                                disabled={row.priceType !== 'manual'}
                                value={row.manualPrice || ''}
                                onChange={(e) => patchRow(level.id, { manualPrice: e.target.value })}
                              />
                            </span>
                          </label>
                        </div>
                      </div>
                    )}
                  </article>
                )
              })}
            </div>
          </section>
        )
      })}
    </>
  )
}

