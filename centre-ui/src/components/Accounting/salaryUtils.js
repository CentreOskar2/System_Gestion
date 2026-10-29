// Taux d'un professeur au pourcentage sur une formation (English, Français…).
// Une formation n'a pas de cycle scolaire : son taux est rangé dans
// cycle_rates, à côté des taux par cycle, sous cette clé. Un groupe de
// formation porte la même clé comme cycleId (voir salariesApi).
export const formationRateKey = (formationId) => `formation:${formationId}`

// Prime des professeurs (Paramètres > Tarifs) : dans chaque groupe d'un cycle
// concerné, un montant pour chaque élève qui a payé le mois au-delà du seuil.
// 25 élèves payés, seuil 20, 10 DH : (25 − 20) × 10 = 50 DH. Groupe par groupe :
// 22 et 18 élèves donnent 20 DH, pas (40 − 20) × 10.
export function groupPrimeOf(paidCount, prime) {
  const threshold = Number(prime?.threshold)
  const perStudent = Number(prime?.amountPerStudent)
  if (!Number.isFinite(threshold) || !Number.isFinite(perStudent) || perStudent <= 0) return { students: 0, amount: 0 }
  const students = Math.max(0, (Number(paidCount) || 0) - threshold)
  return { students, amount: students * perStudent }
}

// Cycles où la prime s'applique : ceux cochés dans Paramètres ; tant que rien
// n'y a été enregistré, le cycle préscolaire (maternelle), reconnu à son nom
// — « Primaire » n'y correspond pas.
const PRESCHOOL_NAME = /pr[ée][\s-]?scolaire|maternelle|روض|تمهيدي|التعليم الأولي/i

export function primeCycleIdsOf(prime, cycles) {
  if (Array.isArray(prime?.cycleIds)) return new Set(prime.cycleIds)
  return new Set((cycles || []).filter((cycle) => PRESCHOOL_NAME.test(cycle.name || '')).map((cycle) => cycle.id))
}

// Salaire mensuel d'un professeur au fixe, hors prime.
export function fixedSalaryOf(teacher) {
  return Number(teacher?.fixed_salary) || Number(teacher?.remuneration_amount) || 0
}

export function calculateSalary(teacher, groups) {
  // La prime s'ajoute au salaire, fixe ou au pourcentage.
  const primes = groups.reduce((sum, group) => sum + (Number(group.prime) || 0), 0)
  if (teacher.paymentType === 'fixe') {
    return fixedSalaryOf(teacher) + primes
  }
  let total = primes
  for (const group of groups) {
    const rate = teacher.cycle_rates?.[group.cycleId] || 0
    // `revenue` est la somme des prix réellement facturés aux élèves du groupe :
    // un prix manuel (une remise) s'y reflète, ce que « effectif × tarif » ne
    // faisait pas. Repli sur l'ancien calcul pour les appelants qui ne le
    // fournissent pas encore.
    const base = Number.isFinite(group.revenue)
      ? group.revenue
      : group.studentsCount * group.price
    total += base * (rate / 100)
  }
  return Math.round(total)
}

// Ce qu'il reste à verser au professeur pour le mois : le salaire calculé,
// moins les avances déjà remises sur ce mois. Peut être négatif si les avances
// dépassent le salaire (le professeur doit alors la différence au centre).
export function netToPay(teacher) {
  return (Number(teacher?.amount) || 0) - (Number(teacher?.advancesTotal) || 0)
}
