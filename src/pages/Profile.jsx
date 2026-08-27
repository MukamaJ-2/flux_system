import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Profile() {
  const { profile, signOut, updateProfile, setPassword } = useAuth()
  const navigate = useNavigate()
  const [showLogout, setShowLogout] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({ fullName: profile?.fullName || '', phone: profile?.phone || '' })
  const [editMsg, setEditMsg] = useState('')

  const [changingPassword, setChangingPassword] = useState(false)
  const [passwordForm, setPasswordForm] = useState({ newPassword: '', confirmPassword: '' })
  const [passwordMsg, setPasswordMsg] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [revealPasswords, setRevealPasswords] = useState(false)

  function handleSignOut() {
    signOut()
    navigate('/login')
  }

  const handleSaveEdit = async (e) => {
    e.preventDefault()
    setEditMsg('')
    const result = await updateProfile({ fullName: editForm.fullName, phone: editForm.phone })
    if (result?.success) {
      setEditing(false)
      setEditMsg('Profile updated successfully.')
      setTimeout(() => setEditMsg(''), 3000)
    } else {
      setEditMsg(result?.error || 'Failed to update profile.')
    }
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    setPasswordError('')
    if (passwordForm.newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters.')
      return
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('Passwords do not match.')
      return
    }
    setPasswordSaving(true)
    try {
      const result = await setPassword(passwordForm.newPassword)
      if (result.success) {
        setChangingPassword(false)
        setPasswordForm({ newPassword: '', confirmPassword: '' })
        setPasswordMsg('Password changed successfully.')
        setTimeout(() => setPasswordMsg(''), 3000)
      } else {
        setPasswordError(result.error || 'Failed to change password.')
      }
    } catch (err) {
      setPasswordError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setPasswordSaving(false)
    }
  }

  return (
    <div className="page profile-page">
      <div className="profile-hero">
        <div className="profile-avatar-lg">{profile?.avatar || profile?.fullName?.slice(0, 2).toUpperCase()}</div>
        <div className="profile-info">
          <h2 className="profile-name">{profile?.fullName}</h2>
          <div className="profile-email">{profile?.email}</div>
          {profile?.phone && <div className="profile-phone">{profile?.phone}</div>}
          {(profile?.roles || []).map((r) => (
            <span key={r} className="role-badge member" style={{ marginRight: '6px' }}>{r.toUpperCase()}</span>
          ))}
        </div>
        {!editing ? (
          <button className="btn secondary" onClick={() => { setEditing(true); setEditForm({ fullName: profile?.fullName || '', phone: profile?.phone || '' }) }} style={{ alignSelf: 'flex-start', marginTop: '1rem' }}>
            Edit Contact Info
          </button>
        ) : (
          <form onSubmit={handleSaveEdit} className="flux-form" style={{ alignSelf: 'flex-start', marginTop: '1rem', minWidth: '250px' }}>
            <div className="form-group">
              <label>Full Name</label>
              <input className="form-input" value={editForm.fullName} onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Phone</label>
              <input className="form-input" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
            </div>
            <div className="req-actions">
              <button type="button" className="btn secondary" onClick={() => setEditing(false)}>Cancel</button>
              <button type="submit" className="btn primary">Save</button>
            </div>
          </form>
        )}
      </div>

      {editMsg && <div className="alert alert-success" style={{ marginTop: '1rem' }}>{editMsg}</div>}

      <div className="section-block">
        <div className="section-heading"><span>Account Details</span></div>
        <div className="info-card">
          <div className="info-row"><span className="muted">Full Name</span><strong>{profile?.fullName}</strong></div>
          <div className="info-row"><span className="muted">Email</span><strong>{profile?.email}</strong></div>
          {profile?.phone && <div className="info-row"><span className="muted">Phone</span><strong>{profile?.phone}</strong></div>}
          <div className="info-row"><span className="muted">Roles</span><strong>{(profile?.roles || []).join(', ') || 'Member'}</strong></div>
        </div>
      </div>

      <div className="section-block">
        <div className="section-heading"><span>Password</span></div>
        <div className="card-box">
          {passwordMsg && <div className="alert alert-success">{passwordMsg}</div>}
          {!changingPassword ? (
            <button className="btn secondary" onClick={() => { setChangingPassword(true); setPasswordError('') }}>
              Change Password
            </button>
          ) : (
            <form onSubmit={handleChangePassword} className="flux-form">
              {passwordError && <div className="alert alert-danger"><span>⚠</span> {passwordError}</div>}
              <div className="form-group">
                <label>New Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={revealPasswords ? 'text' : 'password'}
                    className="form-input"
                    style={{ paddingRight: '44px' }}
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                    placeholder="Min. 8 characters"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setRevealPasswords((v) => !v)}
                    aria-label={revealPasswords ? 'Hide passwords' : 'Show passwords'}
                    style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', padding: '4px' }}
                  >
                    {revealPasswords ? '🙈' : '👁'}
                  </button>
                </div>
              </div>
              <div className="form-group">
                <label>Confirm New Password</label>
                <input
                  type={revealPasswords ? 'text' : 'password'}
                  className="form-input"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  placeholder="Repeat your new password"
                />
              </div>
              <div className="req-actions">
                <button type="button" className="btn secondary" onClick={() => { setChangingPassword(false); setPasswordForm({ newPassword: '', confirmPassword: '' }); setPasswordError('') }}>
                  Cancel
                </button>
                <button type="submit" className="btn primary" disabled={passwordSaving}>
                  {passwordSaving ? <span className="spinner sm" /> : 'Save New Password'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      <div className="section-block" style={{ marginTop: '2rem' }}>
        <button
          className="btn danger full"
          onClick={() => setShowLogout(true)}
        >
          Sign Out
        </button>
      </div>

      {showLogout && (
        <div className="modal-overlay" onClick={() => setShowLogout(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-icon warning">⏏</div>
            <h3 className="modal-title">Sign Out</h3>
            <p className="modal-body">Are you sure you want to sign out of FLUX?</p>
            <div className="modal-actions">
              <button className="btn secondary" onClick={() => setShowLogout(false)}>Stay</button>
              <button className="btn danger" onClick={handleSignOut}>Sign Out</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
