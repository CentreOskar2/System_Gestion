export function calculateSalary(teacher, groups) {
  if (teacher.paymentType === 'fixe') {
    return Number(teacher.fixed_salary) || Number(teacher.remuneration_amount) || 0
  }
  let total = 0
  for (const group of groups) {
    const rate = teacher.cycle_rates?.[group.cycleId] || 0
    total += group.studentsCount * group.price * (rate / 100)
  }
  return Math.round(total)
}
