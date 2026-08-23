import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useGroups } from '../context/GroupsContext'
import { useFinance } from '../context/FinanceContext'

export default function Profile() {
  const { user, signOut, updateProfile } = useAuth()
  const { data } = useGroups()
  const { finance } = useFinance()
  const navigate = useNavigate()
  const [showLogout, setShowLogout] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({ fullName: user?.fullName || '', phone: user?.phone || '' })
  const [editMsg, setEditMsg] = useState('')

  const myGroups = data.groups.filter((g) =>
    g.members.some((m) => m.id === user?.id),
  )

  const myRequestsCount = data.groups.reduce(
    (sum, g) => sum + (g.requests || []).filter((r) => r.requesterId === user?.id).length,
    0,
  )

  // Compute loan eligibility from real data
  const myLoans = finance.loans.filter((l) => l.requesterId === String(user?.id))
  const activeLoans = myLoans.filter((l) => l.status === 'approved' || l.status === 'pending_chair' || l.status === 'pending_treasury' || l.status === 'pending_audit' || l.status === 'pending_disbursal')
  const repaidLoans = myLoans.filter((l) => l.status === 'repaid')
  const myContributions = data.groups.reduce(
    (sum, g) => sum + (g.records || []).filter((r) => r.memberId === user?.id).reduce((s, r) => s + r.amount, 0),
    0,
  )
  const eligibilityScore = Math.min(850, 300 + myContributions / 10000 * 100 + repaidLoans.length * 50 - activeLoans.length * 20)

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

  const downloadStatement = () => {
    const myRecords = data.groups.flatMap((g) =>
      (g.records || []).filter((r) => r.memberId === user?.id).map((r) => ({ ...r, groupName: g.name }))
    )
    const headers = ['Date', 'Group', 'Amount', 'Method', 'Note']
    const rows = myRecords.map((r) => [
      new Date(r.date).toLocaleDateString(),
      r.groupName,
      r.amount,
      r.method,
      r.note || '',
    ])
    const csv = [headers, ...rows].map((row) => row.map((c) => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `my-statements-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="page profile-page">
      <div className="profile-hero">
        <div className="profile-avatar-lg">{user?.avatar || user?.fullName?.slice(0, 2).toUpperCase()}</div>
        <div className="profile-info">
          <h2 className="profile-name">{user?.fullName}</h2>
          <div className="profile-email">{user?.email}</div>
          {user?.phone && <div className="profile-phone">{user?.phone}</div>}
          <span className={`role-badge member`}>
            {user?.role.toUpperCase()}
          </span>
        </div>
        {!editing ? (
          <button className="btn secondary" onClick={() => { setEditing(true); setEditForm({ fullName: user?.fullName || '', phone: user?.phone || '' }) }} style={{ alignSelf: 'flex-start', marginTop: '1rem' }}>
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

      <div className="profile-stats">
        <div className="pstat">
          <div className="pstat-val">{Math.round(eligibilityScore)}</div>
          <div className="pstat-lbl">Loan Eligibility Score</div>
        </div>
        <div className="pstat">
          <div className="pstat-val">{myGroups.length}</div>
          <div className="pstat-lbl">Active Groups</div>
        </div>
        <div className="pstat">
          <div className="pstat-val">{myRequestsCount}</div>
          <div className="pstat-lbl">Transactions</div>
        </div>
      </div>

      <div className="section-block">
        <div className="section-heading"><span>Account Details</span></div>
        <div className="info-card">
          <div className="info-row"><span className="muted">Full Name</span><strong>{user?.fullName}</strong></div>
          <div className="info-row"><span className="muted">Email</span><strong>{user?.email}</strong></div>
          {user?.phone && <div className="info-row"><span className="muted">Phone</span><strong>{user?.phone}</strong></div>}
          <div className="info-row"><span className="muted">System Role</span><strong>{user?.role}</strong></div>
        </div>
      </div>

      <div className="section-block">
        <div className="section-heading"><span>Member Self-Service</span></div>
        <div className="quick-actions">
          <button className="quick-action-card blue" onClick={downloadStatement}>
            <span className="qa-icon">📄</span>
            <span>Download Statements</span>
          </button>
          <button className="quick-action-card green" onClick={downloadStatement}>
            <span className="qa-icon">🧾</span>
            <span>Transaction Receipts</span>
          </button>
          <button className="quick-action-card teal" onClick={() => navigate('/voting')}>
            <span className="qa-icon">🗳️</span>
            <span>Vote on Investments</span>
          </button>
        </div>
      </div>

      {myGroups.length > 0 && (
        <div className="section-block">
          <div className="section-heading"><span>My Groups</span></div>
          <div className="member-list">
            {myGroups.map((g) => (
              <div key={g.id} className="member-card">
                <div className="member-avatar">👥</div>
                <div className="member-info">
                  <div className="member-name">{g.name}</div>
                  <div className="member-email">UGX {g.contribution.toLocaleString()} / {g.frequency}</div>
                </div>
                <span className={`badge ${g.members.find((m) => m.id === user?.id)?.role}`}>
                  {g.members.find((m) => m.id === user?.id)?.role}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

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
