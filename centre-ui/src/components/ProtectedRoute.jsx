import { Navigate, Outlet } from 'react-router-dom'
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
    return <Navigate to="/dashboard" replace />
  }

  if (requiredPerm && !permissions.includes(requiredPerm)) {
    return <Navigate to="/dashboard" replace />
  }

  return children || <Outlet />
}
