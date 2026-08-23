import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { canAccessRoute } from '../utils/permissions'

export default function ProtectedRoute({ children, allowedRoles, requiredPermission }) {
  const { user, mustChangePassword, hasPermission } = useAuth()
  const location = useLocation()

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />
  }

  if (allowedRoles && allowedRoles.length > 0 && !canAccessRoute(user, allowedRoles)) {
    return <Navigate to="/" replace />
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return <Navigate to="/" replace />
  }

  return children
}
