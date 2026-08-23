import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { API_URL, SUPABASE_ANON_KEY } from '../config'

const AuthContext = createContext({
  session: null,
  profile: null,
  loading: true,
  mustSetPassword: false,
  hasRole: () => false,
  hasAnyRole: () => false,
  signIn: async () => {},
  signOut: () => {},
  updateProfile: async () => {},
})

// Supabase appends `type=invite` or `type=recovery` to the redirect URL
// hash when a member follows their invite/password-reset email. That's how
// we know to route them to /set-password instead of the normal dashboard —
// there's no `must_change_password` flag in the new schema; the session
// itself carries this.
function detectMustSetPassword() {
  const hash = window.location.hash || ''
  return hash.includes('type=invite') || hash.includes('type=recovery')
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [mustSetPassword, setMustSetPassword] = useState(detectMustSetPassword)

  async function fetchProfile(accessToken) {
    try {
      const res = await fetch(`${API_URL}/me/`, {
        headers: { Authorization: `Bearer ${accessToken}`, apikey: SUPABASE_ANON_KEY },
      })
      if (res.ok) setProfile(await res.json())
      else setProfile(null)
    } catch {
      setProfile(null)
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session)
      if (data.session) await fetchProfile(data.session.access_token)
      setLoading(false)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      setSession(newSession)
      if (event === "PASSWORD_RECOVERY") setMustSetPassword(true)
      if (newSession) await fetchProfile(newSession.access_token)
      else setProfile(null)
    })

    return () => subscription.subscription.unsubscribe()
  }, [])

  const value = useMemo(
    () => ({
      session,
      profile,
      loading,
      mustSetPassword,

      hasRole: (role) => !!profile?.roles?.includes(role),
      hasAnyRole: (...roles) => roles.some((r) => profile?.roles?.includes(r)),

      signIn: async ({ email, password }) => {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) return { success: false, error: error.message === 'Invalid login credentials' ? 'Invalid email or password' : error.message }
        await fetchProfile(data.session.access_token)
        return { success: true }
      },

      signOut: async () => {
        await supabase.auth.signOut()
        setProfile(null)
      },

      setPassword: async (newPassword) => {
        const { error } = await supabase.auth.updateUser({ password: newPassword })
        if (error) return { success: false, error: error.message }
        setMustSetPassword(false)
        return { success: true }
      },

      updateProfile: async (patch) => {
        if (!session) return { success: false, error: 'Not signed in' }
        try {
          const res = await fetch(`${API_URL}/me/`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
              apikey: SUPABASE_ANON_KEY,
            },
            body: JSON.stringify(patch),
          })
          if (res.ok) {
            const updated = await res.json()
            setProfile(updated)
            return { success: true, profile: updated }
          }
          const err = await res.json().catch(() => ({}))
          return { success: false, error: err.error || 'Failed to update profile' }
        } catch (e) {
          return { success: false, error: e.message }
        }
      },
    }),
    [session, profile, loading, mustSetPassword],
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
