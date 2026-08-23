import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { getDashboardPathForRole, useAuth } from '../context/AuthContext'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const from = location.state?.from?.pathname || '/'

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setLoading(true)
    const result = await signIn({ email, password })
    setLoading(false)
    if (result.success) {
      const nextPath = from === '/' ? getDashboardPathForRole(result.user?.role) : from
      navigate(nextPath, { replace: true })
    } else {
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
            <p className="auth-subtitle">Sign in to your FLUX account to manage your savings groups.</p>
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
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
            <button type="submit" className="btn full" disabled={loading}>
              {loading ? <span className="spinner" /> : 'Sign In'}
            </button>
          </form>

          {/* Demo credentials removed - use real accounts */}

        </div>

        <div className="auth-hero">
          <div className="auth-hero-content">
            <div className="auth-hero-icon">💎</div>
            <h2>Group savings, made simple.</h2>
            <p>Manage contributions, track payouts, and keep every member aligned — all from one place.</p>
            <div className="auth-features">
              <div className="auth-feature"><span>✓</span> Admin-controlled groups</div>
              <div className="auth-feature"><span>✓</span> Member contribution requests</div>
              <div className="auth-feature"><span>✓</span> Transparent audit trail</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
