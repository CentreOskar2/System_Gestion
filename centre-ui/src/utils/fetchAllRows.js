// Supabase (PostgREST) plafonne chaque lecture à 1000 lignes, sans erreur :
// au-delà, les lignes les plus récentes disparaissent en silence (élèves
// absents des groupes, du journal de salaire, totaux faux...). On lit donc
// la table page par page jusqu'à la dernière.
//
// `buildQuery` doit renvoyer une requête NEUVE à chaque appel (un builder
// Supabase ne se relance pas) et triée sur une clé unique : sans tri stable,
// deux pages peuvent se chevaucher ou sauter des lignes.
//
// Renvoie { data, error } comme une requête Supabase, pour se glisser tel
// quel dans un Promise.all existant.
const PAGE_SIZE = 1000

export async function fetchAllRows(buildQuery) {
  const rows = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await buildQuery().range(from, from + PAGE_SIZE - 1)
    if (error) return { data: null, error }
    rows.push(...(data || []))
    if (!data || data.length < PAGE_SIZE) return { data: rows, error: null }
  }
}
