import { Link, Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { firstAllowedPath } from '../permissionRoutes'

export default function ProtectedRoute({ allowedRoles, requiredPerm, children }) {
  const { user, role, permissions, loading } = useAuth()

  if (loading) {
    return <div>Loading...</div>
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    return <AccessDenied permissions={permissions} />
  }

  if (requiredPerm) {
    const requiredPerms = Array.isArray(requiredPerm) ? requiredPerm : [requiredPerm]
    if (!requiredPerms.some((perm) => permissions.includes(perm))) {
      return <AccessDenied permissions={permissions} />
    }
  }

  return children || <Outlet />
}

function AccessDenied({ permissions }) {
  return (
    <div className="access-denied">
      <div>
        <h1>Accès refusé</h1>
        <p>Votre rôle ne vous permet pas de consulter cette page.</p>
        <Link to={firstAllowedPath(permissions)}>← Retour</Link>
      </div>
    </div>
  )
}
