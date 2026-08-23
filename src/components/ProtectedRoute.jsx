import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children, allowedRoles }) {
  const { session, profile, mustSetPassword } = useAuth()
  const location = useLocation()

  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (mustSetPassword && location.pathname !== '/set-password') {
    return <Navigate to="/set-password" replace />
  }

  if (allowedRoles && allowedRoles.length > 0) {
    const allowed = (profile?.roles || []).some((r) => allowedRoles.includes(r))
    if (!allowed) return <Navigate to="/" replace />
  }

  return children
}
