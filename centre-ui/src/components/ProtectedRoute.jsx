import { Link, Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ allowedRoles, requiredPerm, children }) {
  const { user, role, permissions, loading } = useAuth()

  if (loading) {
    return <div>Loading...</div>
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    return <AccessDenied />
  }

  if (requiredPerm && !permissions.includes(requiredPerm)) {
    return <AccessDenied />
  }

  return children || <Outlet />
}

function AccessDenied() {
  return (
    <div className="access-denied">
      <div>
        <h1>Accès refusé</h1>
        <p>Votre rôle ne vous permet pas de consulter cette page.</p>
        <Link to="/dashboard">← Retour au tableau de bord</Link>
      </div>
    </div>
  )
}
