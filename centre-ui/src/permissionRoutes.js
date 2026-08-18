// Ordered list of permission -> landing route. Order defines priority when picking
// where to send a user after login (or when they hit an unknown/unauthorized path).
export const PERMISSION_ROUTES = [
  { perm: 'dashboard', path: '/dashboard' },
  { perm: 'students', path: '/students' },
  { perm: 'groups', path: '/groups' },
  { perm: 'teachers', path: '/teachers' },
  { perm: 'tuition', path: '/accounting/fees' },
  { perm: 'late_payments', path: '/accounting/delinquencies' },
  { perm: 'teacher_salaries', path: '/accounting/salaries' },
  { perm: 'expenses', path: '/accounting/expenses' },
  { perm: 'net_profit', path: '/accounting/profit' },
  { perm: 'settings', path: '/settings' },
  { perm: 'administration', path: '/users' },
]

export function firstAllowedPath(permissions) {
  const match = PERMISSION_ROUTES.find((route) => permissions?.includes(route.perm))
  return match?.path || '/no-access'
}
