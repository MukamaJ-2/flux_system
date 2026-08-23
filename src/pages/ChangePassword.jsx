import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ChangePassword() {
  const navigate = useNavigate()
  const { changePassword, user } = useAuth()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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
    const result = await changePassword({ newPassword, confirmPassword })
    if (result.success) {
      navigate('/')
    } else {
      setError(result.error || 'Failed to update password.')
    }
    setLoading(false)
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
              Welcome, <strong>{user?.first_name || user?.email}</strong>! Your account was created by
              an admin. Please set a new password before continuing.
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
              <input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min. 8 characters"
                required
                autoFocus
              />
            </div>

            <div className="field-group">
              <label htmlFor="confirmPassword">Confirm Password *</label>
              <input
                id="confirmPassword"
                type="password"
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
            🔒 You must set a new password before accessing the system. This is a one-time step.
          </div>
        </div>
      </div>
    </div>
  )
}
