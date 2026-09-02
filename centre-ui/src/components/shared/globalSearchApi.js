import { supabase } from '../../supabaseClient'

/** Nombre de lignes ramenées par table avant l'affinage local. */
const FETCH_LIMIT = 40
/** Nombre de résultats affichés par section du menu déroulant. */
export const MAX_PER_SECTION = 5

/**
 * Neutralise les caractères qui ont un sens dans le mini-langage de filtre
 * PostgREST (`or=(a.ilike.%x%,b.ilike.%x%)`) : sans cela une virgule ou une
 * parenthèse tapée dans la barre casse la requête au lieu d'être cherchée.
 */
function tokenize(term) {
  return String(term || '')
    .replace(/[,()%\\"*]/g, ' ')
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
}

/** `or=` PostgREST : n'importe quel mot tapé dans n'importe quelle colonne. */
function orFilter(fields, tokens) {
  return fields.flatMap((field) => tokens.map((token) => `${field}.ilike.%${token}%`)).join(',')
}

/**
 * Le `or` ci-dessus est volontairement large (un seul mot suffit) pour rester
 * indexable côté base ; c'est ici qu'on exige la présence de *tous* les mots,
 * en cherchant dans le nom complet — « ahmed ait » trouve donc une ligne dont
 * le prénom et le nom sont dans deux colonnes distinctes.
 */
function matchesAllTokens(haystack, tokens) {
  const text = haystack.toLowerCase()
  return tokens.every((token) => text.includes(token))
}

function branchScoped(query, branchId) {
  if (!branchId || branchId === 'all') return query
  return query.eq('branch_id', branchId)
}

async function searchStudents(tokens, branchId) {
  const { data, error } = await branchScoped(
    supabase
      .from('students')
      .select('id, first_name, last_name, registration_number, phone1, photo_url, status, levels(name)')
      .or(orFilter(['first_name', 'last_name', 'registration_number', 'phone1'], tokens))
      .limit(FETCH_LIMIT),
    branchId
  )
  if (error) throw new Error(error.message)
  return (data || [])
    .map((row) => ({
      type: 'student',
      id: row.id,
      name: `${row.first_name || ''} ${row.last_name || ''}`.trim(),
      code: row.registration_number || '',
      phone: row.phone1 || '',
      photoUrl: row.photo_url || '',
      subtitle: [row.levels?.name, row.registration_number].filter(Boolean).join(' · '),
      inactive: row.status !== 'active',
    }))
    .filter((item) => matchesAllTokens(`${item.name} ${item.code} ${item.phone}`, tokens))
    .slice(0, MAX_PER_SECTION)
}

async function searchTeachers(tokens, branchId) {
  const { data, error } = await branchScoped(
    supabase
      .from('teachers')
      .select('id, first_name, last_name, phone, cin, photo_url, status')
      .or(orFilter(['first_name', 'last_name', 'phone', 'cin'], tokens))
      .limit(FETCH_LIMIT),
    branchId
  )
  if (error) throw new Error(error.message)
  return (data || [])
    .map((row) => ({
      type: 'teacher',
      id: row.id,
      name: `${row.first_name || ''} ${row.last_name || ''}`.trim(),
      photoUrl: row.photo_url || '',
      subtitle: [row.phone, row.cin].filter(Boolean).join(' · ') || 'Professeur',
      inactive: row.status !== 'active',
    }))
    .filter((item) => matchesAllTokens(`${item.name} ${item.subtitle}`, tokens))
    .slice(0, MAX_PER_SECTION)
}

/** Les groupes sont partagés entre succursales (migration 020) : pas de filtre succursale ici. */
async function searchGroups(tokens) {
  const { data, error } = await supabase
    .from('groups')
    .select('id, name, level_id')
    .or(orFilter(['name'], tokens))
    .limit(FETCH_LIMIT)
  if (error) throw new Error(error.message)

  const matched = (data || [])
    .filter((row) => matchesAllTokens(row.name || '', tokens))
    .slice(0, MAX_PER_SECTION)
  if (!matched.length) return []

  // Niveau résolu en second appel plutôt qu'en jointure imbriquée : la table
  // `groups` n'expose pas de relation nommée fiable côté PostgREST.
  const levelIds = [...new Set(matched.map((row) => row.level_id).filter(Boolean))]
  const levelNames = {}
  if (levelIds.length) {
    const { data: levels } = await supabase.from('levels').select('id, name').in('id', levelIds)
    for (const level of levels || []) levelNames[level.id] = level.name
  }

  return matched.map((row) => ({
    type: 'group',
    id: row.id,
    name: row.name || '',
    subtitle: levelNames[row.level_id] || 'Groupe',
  }))
}

/**
 * Recherche globale du bandeau supérieur.
 * `scopes` reflète les permissions de l'utilisateur : on n'interroge que les
 * tables auxquelles il a droit, pour ne pas proposer un résultat qu'il ne
 * pourrait pas ouvrir.
 */
export async function searchEverything(term, { branchId = null, scopes = {} } = {}) {
  const tokens = tokenize(term)
  if (!tokens.length) return { students: [], teachers: [], groups: [] }

  const [students, teachers, groups] = await Promise.all([
    scopes.students ? searchStudents(tokens, branchId) : [],
    scopes.teachers ? searchTeachers(tokens, branchId) : [],
    scopes.groups ? searchGroups(tokens) : [],
  ])
  return { students, teachers, groups }
}
