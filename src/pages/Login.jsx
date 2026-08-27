import React, { useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const location = useLocation()
  const { session, signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [reveal, setReveal] = useState(false)

  const from = location.state?.from?.pathname || '/'

  // Already signed in — /login has no guard of its own (it has to be public
  // so a signed-out visitor can reach it), so without this check a valid
  // session landing here renders the login form *underneath* the app shell
  // instead of just going to the dashboard.
  if (session) {
    return <Navigate to={from} replace />
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setLoading(true)
    const result = await signIn({ email, password })
    setLoading(false)
    // No explicit navigate() here — a successful sign-in updates `session`
    // via AuthContext's onAuthStateChange listener, which re-renders this
    // component straight into the redirect check above.
    if (!result.success) {
      setError(result.error)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <div className="auth-logo">
              <div className="auth-logo-mark">F</div>
              <span className="auth-logo-name">FLUX</span>
            </div>
            <h1 className="auth-title">Welcome back</h1>
            <p className="auth-subtitle">Sign in to your FLUX account to manage your savings group.</p>
          </div>

          {error && (
            <div className="alert alert-danger">
              <span>⚠</span> {error}
            </div>
          )}

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="field-group">
              <label htmlFor="email">Email address</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>
            <div className="field-group">
              <label htmlFor="password">Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="password"
                  type={reveal ? 'text' : 'password'}
                  style={{ paddingRight: '44px' }}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setReveal((v) => !v)}
                  aria-label={reveal ? 'Hide password' : 'Show password'}
                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', padding: '4px' }}
                >
                  {reveal ? '🙈' : '👁'}
                </button>
              </div>
            </div>
            <button type="submit" className="btn full" disabled={loading}>
              {loading ? <span className="spinner" /> : 'Sign In'}
            </button>
          </form>

          <p className="text-sm text-muted" style={{ marginTop: '16px', textAlign: 'center' }}>
            Forgot your password? Ask your Adminstrator to assist you.
          </p>
        </div>

        <div className="auth-hero">
          <div className="auth-hero-content">
            <div className="auth-hero-icon">💎</div>
            <h2>Group savings, made simple.</h2>
            <p>Manage contributions, track loans, and keep every member aligned — all from one place.</p>
            <div className="auth-features">
              <div className="auth-feature"><span>✓</span> Role-based responsibilities</div>
              <div className="auth-feature"><span>✓</span> Dual-approval on every loan</div>
              <div className="auth-feature"><span>✓</span> A transparent, tamper-evident ledger</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
