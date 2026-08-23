import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useGroups, isGroupAdmin } from '../context/GroupsContext'
import { useAuth } from '../context/AuthContext'
import { hasPermission } from '../utils/permissions'

export default function Groups() {
  const { data, joinGroup } = useGroups()
  const { user } = useAuth()
  const canCreate = hasPermission(user, 'create_group')

  const [inviteCode, setInviteCode] = useState('')
  const [joinError, setJoinError] = useState('')
  const [joinLoading, setJoinLoading] = useState(false)
  const [joinSuccess, setJoinSuccess] = useState(false)

  const myGroups = data.groups.filter((g) =>
    g.members.some((m) => m.id === user?.id),
  )

  async function handleJoin(e) {
    e.preventDefault()
    setJoinError('')
    setJoinSuccess(false)
    if (!inviteCode.trim()) {
      setJoinError('Please enter an invite code.')
      return
    }
    setJoinLoading(true)
    const result = await joinGroup(inviteCode.trim())
    setJoinLoading(false)
    if (result?.success) {
      setJoinSuccess(true)
      setInviteCode('')
      setTimeout(() => setJoinSuccess(false), 4000)
    } else {
      setJoinError(result?.error || 'Failed to join group.')
    }
  }

  return (
    <div className="page groups-page">
      <div className="page-top-row">
        <div>
          <div className="page-kicker">Savings communities</div>
          <h2>My Groups</h2>
        </div>
        {canCreate && <Link to="/groups/new" className="btn">+ New Group</Link>}
      </div>

      <div className="section-block">
        <div className="section-heading"><span>Join a Group</span></div>
        <div className="card-box">
          <p className="subcopy" style={{ marginBottom: '1rem' }}>
            Have an invite code from a group admin? Enter it below to join their savings group.
          </p>
          <form onSubmit={handleJoin} className="flux-form" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ flex: '1 1 220px', margin: 0 }}>
              <label htmlFor="inviteCode">Invite Code</label>
              <input
                id="inviteCode"
                type="text"
                className="form-input"
                placeholder="e.g. AB3XYZ9K"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                style={{ textTransform: 'uppercase', letterSpacing: '2px' }}
                disabled={joinLoading}
              />
            </div>
            <button type="submit" className="btn primary" disabled={joinLoading || !inviteCode.trim()}>
              {joinLoading ? <span className="spinner" /> : 'Join Group'}
            </button>
          </form>
          {joinError && <div className="alert alert-danger" style={{ marginTop: '0.75rem' }}><span>⚠</span> {joinError}</div>}
          {joinSuccess && <div className="alert alert-success" style={{ marginTop: '0.75rem' }}>✓ Successfully joined the group!</div>}
        </div>
      </div>

      {myGroups.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">◌</div>
          <div className="empty-title">No Groups Yet</div>
          <p className="empty-copy">
            {canCreate
              ? 'Create your first savings group or join one with an invite code above.'
              : 'Enter an invite code above to join a group, or ask your group admin for a code.'}
          </p>
        </div>
      ) : (
        <div className="group-cards">
          {myGroups.map((g) => {
            const pendingCount = (g.requests || []).filter((r) => r.status === 'pending' || r.status === 'pending_treasury').length
            const collected = (g.records || []).reduce((sum, r) => sum + r.amount, 0)
            return (
              <div key={g.id} className="group-card-full">
                <div className="group-card-top">
                  <div className="group-icon-lg">👥</div>
                  <div className="group-card-info">
                    <div className="group-name-lg">{g.name}</div>
                    {g.description && <div className="group-desc">{g.description}</div>}
                    <div className="group-meta-row">
                      <span>UGX {g.contribution.toLocaleString()} / {g.frequency}</span>
                      <span>·</span>
                      <span>{g.members.length} members</span>
                    </div>
                  </div>
                  <div className="group-card-badges">
                    <span className={`pill ${g.cycle === 'ACTIVE' ? 'success' : 'info'}`}>{g.cycle}</span>
                    {isGroupAdmin(g, user) && pendingCount > 0 && (
                      <span className="pill warning">{pendingCount} pending</span>
                    )}
                  </div>
                </div>

                <div className="group-card-stats">
                  <div className="gcs-item">
                    <div className="gcs-val">UGX {collected.toLocaleString()}</div>
                    <div className="gcs-lbl">Collected</div>
                  </div>
                  <div className="gcs-item">
                    <div className="gcs-val">{(g.records || []).length}</div>
                    <div className="gcs-lbl">Records</div>
                  </div>
                  <div className="gcs-item">
                    <div className="gcs-val">{g.members.length}</div>
                    <div className="gcs-lbl">Members</div>
                  </div>
                </div>

                <div className="group-card-actions">
                  <Link to={`/groups/${g.id}`} className="btn">Open Group</Link>
                  {isGroupAdmin(g, user) && pendingCount > 0 && (
                    <Link to={`/groups/${g.id}/requests`} className="btn gold">
                      Review {pendingCount} Request{pendingCount > 1 ? 's' : ''}
                    </Link>
                  )}
                  {!isGroupAdmin(g, user) && (
                    <Link to={`/groups/${g.id}/submit`} className="btn secondary">Submit Contribution</Link>
                  )}
                  {isGroupAdmin(g, user) && (
                    <Link to={`/groups/${g.id}/settings`} className="btn secondary">⚙ Settings</Link>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
