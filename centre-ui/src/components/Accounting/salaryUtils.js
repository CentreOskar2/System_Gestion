export function calculateSalary(teacher, groups) {
  if (teacher.paymentType === 'fixe') {
    return Number(teacher.fixed_salary) || Number(teacher.remuneration_amount) || 0
  }
  let total = 0
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
