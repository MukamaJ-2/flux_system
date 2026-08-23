import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { API_URL, SUPABASE_ANON_KEY } from '../config'
import {
  getDashboardPathForRole,
  hasPermission,
  hasAnyRole,
  canManageGroup,
  getRole,
} from '../utils/permissions'

export { getDashboardPathForRole }

const AuthContext = createContext({
  user: null,
  loading: true,
  mustChangePassword: false,
  isSysadmin: false,
  isChair: false,
  isTreasury: false,
  isSecretary: false,
  isAudit: false,
  isMobilizer: false,
  isMember: false,
  isAdmin: false,
  signIn: async () => {},
  signOut: () => {},
  changePassword: async () => {},
  updateProfile: async () => {},
  createUser: async () => {},
})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Restore session on mount
  useEffect(() => {
    const fetchUser = async () => {
      const token = localStorage.getItem('flux_access_token')
      if (token) {
        try {
          const res = await fetch(`${API_URL}/users/me/`, {
            headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY },
          })
          if (res.ok) {
            setUser(await res.json())
          } else {
            localStorage.removeItem('flux_access_token')
            localStorage.removeItem('flux_refresh_token')
          }
        } catch {
          // network error — keep user logged out
        }
      }
      setLoading(false)
    }
    fetchUser()
  }, [])

  const value = useMemo(
    () => ({
      user,
      loading,
      mustChangePassword: user?.must_change_password === true,

      // Role helpers used across the app
      role: getRole(user),
      isSysadmin: user?.role === 'sysadmin',
      isChair: user?.role === 'chair',
      isTreasury: user?.role === 'treasury',
      isSecretary: user?.role === 'secretary',
      isAudit: user?.role === 'audit',
      isMobilizer: user?.role === 'mobilizer',
      isMember: user?.role === 'member',
      hasPermission: (permission) => hasPermission(user, permission),
      hasAnyRole: (...roles) => hasAnyRole(user, ...roles),
      canManageGroup: (group) => canManageGroup(user, group),
      // Legacy alias: chair/sysadmin or group admin
      isAdmin: user?.role === 'sysadmin' || user?.role === 'chair',

      // ── Sign In ───────────────────────────────────────────────────────────
      signIn: async ({ email, password }) => {
        try {
          const tokenRes = await fetch(`${API_URL}/token/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
            body: JSON.stringify({ email, password }),
          })
          if (!tokenRes.ok) return { success: false, error: 'Invalid email or password' }

          const tokens = await tokenRes.json()
          localStorage.setItem('flux_access_token', tokens.access)
          localStorage.setItem('flux_refresh_token', tokens.refresh)

          const userRes = await fetch(`${API_URL}/users/me/`, {
            headers: { Authorization: `Bearer ${tokens.access}`, apikey: SUPABASE_ANON_KEY },
          })
          if (userRes.ok) {
            const userData = await userRes.json()
            setUser(userData)
            return { success: true, user: userData }
          }
          return { success: false, error: 'Failed to fetch user profile' }
        } catch (e) {
          return { success: false, error: 'Network error. Is the backend running?' }
        }
      },

      // ── Sign Out ──────────────────────────────────────────────────────────
      signOut: () => {
        localStorage.removeItem('flux_access_token')
        localStorage.removeItem('flux_refresh_token')
        setUser(null)
      },

      // ── Change Password (forced on first login) ───────────────────────────
      changePassword: async ({ newPassword, confirmPassword }) => {
        try {
          const res = await fetch(`${API_URL}/users/change-password/`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${localStorage.getItem('flux_access_token')}`,
              apikey: SUPABASE_ANON_KEY,
            },
            body: JSON.stringify({
              new_password: newPassword,
              confirm_password: confirmPassword,
            }),
          })
          const body = await res.json()
          if (res.ok) {
            // Re-fetch the updated user profile (must_change_password = false)
            const userRes = await fetch(`${API_URL}/users/me/`, {
              headers: { Authorization: `Bearer ${localStorage.getItem('flux_access_token')}`, apikey: SUPABASE_ANON_KEY },
            })
            if (userRes.ok) setUser(await userRes.json())
            return { success: true }
          }
          return { success: false, error: body.error || 'Failed to change password.' }
        } catch (e) {
          return { success: false, error: 'Network error. Is the backend running?' }
        }
      },

      // ── Admin: Create a new user ──────────────────────────────────────────
      createUser: async ({ fullName, email, phone, role }) => {
        try {
          const res = await fetch(`${API_URL}/users/create/`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${localStorage.getItem('flux_access_token')}`,
              apikey: SUPABASE_ANON_KEY,
            },
            body: JSON.stringify({ fullName, email, phone, role }),
          })
          const body = await res.json()
          if (res.ok) return { success: true, data: body }
          return { success: false, error: body.error || 'Failed to create user.' }
        } catch (e) {
          return { success: false, error: 'Network error. Is the backend running?' }
        }
      },

      // ── Update own profile ────────────────────────────────────────────────
      updateProfile: async (patch) => {
        try {
          const res = await fetch(`${API_URL}/users/me/`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${localStorage.getItem('flux_access_token')}`,
              apikey: SUPABASE_ANON_KEY,
            },
            body: JSON.stringify(patch),
          })
          if (res.ok) {
            const updated = await res.json()
            setUser(updated)
            return { success: true, user: updated }
          }
          const err = await res.json().catch(() => ({}))
          return { success: false, error: err.error || 'Failed to update profile' }
        } catch (e) {
          return { success: false, error: e.message }
        }
      },
    }),
    [user, loading]
  )

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.1rem',
          color: 'var(--text-secondary, #666)',
        }}
      >
        Loading…
      </div>
    )
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
