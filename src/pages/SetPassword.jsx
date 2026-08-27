import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function SetPassword() {
  const navigate = useNavigate()
  const { setPassword, profile } = useAuth()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [reveal, setReveal] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      const result = await setPassword(newPassword)
      if (result.success) {
        navigate('/')
      } else {
        setError(result.error || 'Failed to set password.')
      }
    } catch (e) {
      // Belt-and-braces: an unexpected throw here must never leave the
      // button stuck spinning forever.
      setError(e.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
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
            <h1 className="auth-title">Set Your Password</h1>
            <p className="auth-subtitle">
              Welcome{profile?.fullName ? `, ${profile.fullName}` : ''}! Set a password to finish
              setting up your account.
            </p>
          </div>

          {error && (
            <div className="alert alert-danger">
              <span>⚠</span> {error}
            </div>
          )}

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="field-group">
              <label htmlFor="newPassword">New Password *</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="newPassword"
                  type={reveal ? 'text' : 'password'}
                  style={{ paddingRight: '44px' }}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  required
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setReveal((v) => !v)}
                  aria-label={reveal ? 'Hide passwords' : 'Show passwords'}
                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', padding: '4px' }}
                >
                  {reveal ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            <div className="field-group">
              <label htmlFor="confirmPassword">Confirm Password *</label>
              <input
                id="confirmPassword"
                type={reveal ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat your new password"
                required
              />
            </div>

            <button type="submit" className="btn gold full" disabled={loading}>
              {loading ? <span className="spinner" /> : 'Set Password & Continue'}
            </button>
          </form>

          <div
            style={{
              marginTop: '1.25rem',
              padding: '0.75rem 1rem',
              background: 'var(--bg-secondary, #f5f5f5)',
              borderRadius: '0.5rem',
              fontSize: '0.82rem',
              color: 'var(--text-secondary, #888)',
            }}
          >
            🔒 You must set a password before accessing the system. This is a one-time step.
          </div>
        </div>
      </div>
    </div>
  )
}
