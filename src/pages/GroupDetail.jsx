import React, { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useGroups, isGroupAdmin } from '../context/GroupsContext'
import { useAuth } from '../context/AuthContext'
import { API_URL, SUPABASE_ANON_KEY } from '../config'

export default function GroupDetail() {
  const { id } = useParams()
  const { data, deleteGroup, removeMember, addMember, editMember } = useGroups()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [ejectTarget, setEjectTarget] = useState(null)

  const [newMemberName, setNewMemberName] = useState('')
  const [newMemberEmail, setNewMemberEmail] = useState('')

  const [editTargetId, setEditTargetId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [copiedInviteCode, setCopiedInviteCode] = useState(false)
  const [newMemberAccess, setNewMemberAccess] = useState(null)
  const [minutes, setMinutes] = useState([])

  useEffect(() => {
    let cancelled = false
    async function fetchMinutes() {
      try {
        const res = await fetch(`${API_URL}/minutes/?group=${id}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('flux_access_token')}`,
            apikey: SUPABASE_ANON_KEY,
          },
        })
        if (res.ok && !cancelled) setMinutes(await res.json())
      } catch (e) {
        console.error('Failed to fetch meeting minutes', e)
      }
    }
    fetchMinutes()
    return () => { cancelled = true }
  }, [id])

  const group = data.groups.find((g) => g.id === id)
  const groupIsAdmin = isGroupAdmin(group, user)

  if (!group) return (
    <div className="page">
      <div className="empty-state">
        <div className="empty-icon">◌</div>
        <div className="empty-title">Group not found</div>
        <Link to="/groups" className="btn">Back to Groups</Link>
      </div>
    </div>
  )

  const pendingRequests = (group.requests || []).filter((r) => r.status === 'pending' || r.status === 'pending_secretary' || r.status === 'pending_treasury' || r.status === 'pending_audit' || r.status === 'pending_chair')
  const totalCollected = (group.records || []).reduce((sum, r) => sum + r.amount, 0)
  const myRole = group.members.find((m) => m.id === user?.id)?.role

  function handleDelete() {
    deleteGroup(id)
    navigate('/groups')
  }

  function handleEject(memberId) {
    removeMember(id, memberId)
    setEjectTarget(null)
  }

  async function handleAddMember(e) {
    e.preventDefault()
    if (!newMemberName || !newMemberEmail) return
    const result = await addMember(id, { name: newMemberName, email: newMemberEmail })
    if (result?.success && result.default_password) {
      setNewMemberAccess({ email: result.data.email, default_password: result.default_password })
    }
    setNewMemberName('')
    setNewMemberEmail('')
  }

  function handleEditSave(memberId) {
    if (!editName || !editEmail) return
    editMember(id, memberId, editName, editEmail)
    setEditTargetId(null)
  }

  function startEdit(member) {
    setEditTargetId(member.id)
    setEditName(member.name)
    setEditEmail(member.email)
  }

  async function copyInviteCode() {
    try {
      await navigator.clipboard.writeText(group.invite_code)
      setCopiedInviteCode(true)
      setTimeout(() => setCopiedInviteCode(false), 2000)
    } catch {
      setCopiedInviteCode(false)
    }
  }

  return (
    <div className="page group-detail-page">
      {/* Hero */}
      <div className="detail-hero">
        <div className="detail-hero-left">
          <div className="detail-icon">👥</div>
          <div>
            <div className="page-kicker">Savings Group</div>
            <h2 className="detail-name">{group.name}</h2>
            {group.description && <p className="subcopy">{group.description}</p>}
          </div>
        </div>
        <div className="detail-hero-right">
          <span className={`pill ${group.cycle === 'ACTIVE' ? 'success' : 'info'} lg`}>{group.cycle}</span>
          {groupIsAdmin && (
            <button
              className="btn danger outlined"
              onClick={() => setShowDeleteConfirm(true)}
            >
              🗑 Delete Group
            </button>
          )}
        </div>
      </div>

      <div className="section-block">
        <div className="section-heading">
          <span>Joining Code</span>
        </div>
        <div className="card-box" style={{ display: 'flex', gap: '12px', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div className="muted" style={{ fontSize: '0.85rem', marginBottom: '0.25rem' }}>Share this code so people can join the group</div>
            <strong style={{ fontSize: '1.2rem', letterSpacing: '0.12em' }}>{group.invite_code}</strong>
          </div>
          <button className="btn secondary" type="button" onClick={copyInviteCode}>
            {copiedInviteCode ? 'Copied' : 'Copy Code'}
          </button>
        </div>
      </div>

      {/* Metrics */}
      <div className="metrics-grid">
        <div className="metric-card teal">
          <div className="metric-label">Contribution</div>
          <div className="metric-value">UGX {group.contribution.toLocaleString()}</div>
          <div className="metric-sub">{group.frequency}</div>
        </div>
        <div className="metric-card gold">
          <div className="metric-label">Total Collected</div>
          <div className="metric-value">UGX {totalCollected.toLocaleString()}</div>
          <div className="metric-sub">{group.records.length} records</div>
        </div>
        <div className="metric-card green">
          <div className="metric-label">Members</div>
          <div className="metric-value">{group.members.length}</div>
          <div className="metric-sub">Active</div>
        </div>
        {groupIsAdmin && (
          <div className={`metric-card ${pendingRequests.length > 0 ? 'red' : 'surface'}`}>
            <div className="metric-label">Pending</div>
            <div className="metric-value">{pendingRequests.length}</div>
            <div className="metric-sub">Requests</div>
          </div>
        )}
      </div>



      {/* Action buttons — role-aware */}
      {groupIsAdmin ? (
        <div className="action-grid">
          <Link to={`/groups/${id}/record`} className="action-btn teal">
            <span className="action-icon">✏</span>
            <span>Record Contribution</span>
          </Link>
          <Link to={`/groups/${id}/requests`} className="action-btn gold">
            <span className="action-icon">⏳</span>
            <span>
              Review Requests
              {pendingRequests.length > 0 && <span className="inline-badge">{pendingRequests.length}</span>}
            </span>
          </Link>
          <Link to={`/groups/${id}/records`} className="action-btn surface">
            <span className="action-icon">▤</span>
            <span>View Records</span>
          </Link>
          <Link to={`/groups/${id}/settings`} className="action-btn surface">
            <span className="action-icon">⚙</span>
            <span>Group Settings</span>
          </Link>
        </div>
      ) : (
        <div className="action-grid member-actions">
          <Link to={`/groups/${id}/submit`} className="action-btn teal full">
            <span className="action-icon">↑</span>
            <span>Submit Contribution Request</span>
          </Link>
          <Link to={`/groups/${id}/records`} className="action-btn surface">
            <span className="action-icon">▤</span>
            <span>View Records</span>
          </Link>
        </div>
      )}

      {/* My requests (member only) */}
      {!groupIsAdmin && (() => {
        const myRequests = (group.requests || []).filter((r) => r.requesterId === user?.id)
        return myRequests.length > 0 ? (
          <div className="section-block">
            <div className="section-heading"><span>My Requests</span></div>
            <div className="request-list">
              {myRequests.slice(-5).reverse().map((r) => (
                <div key={r.id} className="request-card">
                  <div className="request-left">
                    <div className="request-amount">UGX {Number(r.amount).toLocaleString()}</div>
                    <div className="request-meta">{r.method} · {new Date(r.createdAt).toLocaleDateString()}</div>
                    {r.note && <div className="request-note">{r.note}</div>}
                  </div>
                  <span className={`pill ${r.status === 'approved' ? 'success' : r.status === 'rejected' ? 'danger' : 'warning'}`}>
                    {r.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null
      })()}

      {/* Members */}
      <div className="section-block">
        <div className="section-heading">
          <span>Members ({group.members.length})</span>
        </div>

        {groupIsAdmin && (
          <form onSubmit={handleAddMember} className="add-member-form" style={{ marginBottom: '16px', display: 'flex', gap: '12px' }}>
            <input 
              placeholder="Member Name" 
              value={newMemberName} 
              onChange={(e) => setNewMemberName(e.target.value)}
              style={{ flex: 1 }}
              required
            />
            <input 
              placeholder="Email Address" 
              type="email"
              value={newMemberEmail} 
              onChange={(e) => setNewMemberEmail(e.target.value)}
              style={{ flex: 1 }}
              required
            />
            <button type="submit" className="btn" disabled={!newMemberName || !newMemberEmail}>
              + Add Member
            </button>
          </form>
        )}

        <div className="member-list">
          {group.members.map((m) => (
            <div key={m.id} className="member-card">
              <div className="member-avatar">{m.avatar || m.name?.slice(0, 2).toUpperCase()}</div>
              
              {editTargetId === m.id ? (
                <div className="member-info" style={{ display: 'flex', gap: '8px', flex: 1 }}>
                  <input value={editName} onChange={e => setEditName(e.target.value)} style={{ flex: 1, padding: '4px' }} />
                  <input value={editEmail} onChange={e => setEditEmail(e.target.value)} style={{ flex: 1, padding: '4px' }} />
                </div>
              ) : (
                <div className="member-info">
                  <div className="member-name">{m.name}</div>
                  <div className="member-email">{m.email}</div>
                </div>
              )}

              <span className={`badge ${m.role}`}>{m.role}</span>
              
              {groupIsAdmin && m.role !== 'admin' && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  {editTargetId === m.id ? (
                    <>
                      <button className="btn" onClick={() => handleEditSave(m.id)}>Save</button>
                      <button className="btn secondary" onClick={() => setEditTargetId(null)}>Cancel</button>
                    </>
                  ) : (
                    <button className="btn secondary sm" onClick={() => startEdit(m)}>Edit</button>
                  )}
                  <button
                    className="btn danger-sm"
                    onClick={() => setEjectTarget(m)}
                    title={`Eject ${m.name}`}
                  >
                    Eject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Meeting Minutes */}
      {minutes.length > 0 && (
        <div className="section-block">
          <div className="section-heading"><span>Meeting Minutes</span></div>
          <div className="list-group">
            {minutes.slice(0, 5).map((m) => (
              <div key={m.id} className="list-item">
                <div className="list-icon" style={{ background: 'var(--blue)', color: 'white' }}>📝</div>
                <div className="list-text">
                  <div><strong>{m.title}</strong></div>
                  <small className="text-muted">{m.meetingDate ? new Date(m.meetingDate).toLocaleDateString() : ''} - logged by {m.author}</small>
                  {m.content && <div className="text-sm" style={{ marginTop: '4px' }}>{m.content}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rules */}
      <div className="section-block">
        <div className="section-heading"><span>Group Rules</span></div>
        <div className="rules-card">
          <div className="rule-row"><span className="muted">Rotation Order</span><strong>{group.rules.rotation}</strong></div>
          <div className="rule-row"><span className="muted">Late Payment Grace</span><strong>{group.rules.grace} days</strong></div>
          <div className="rule-row"><span className="muted">Late Interest Rate</span><strong>{group.rules.interest}</strong></div>
        </div>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-icon danger">🗑</div>
            <h3 className="modal-title">Delete Group</h3>
            <p className="modal-body">
              Are you sure you want to delete <strong>{group.name}</strong>? This action cannot be undone.
              All records, requests, and member data will be permanently removed.
            </p>
            <div className="modal-actions">
              <button className="btn secondary" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
              <button className="btn danger" onClick={handleDelete}>Yes, Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Eject confirmation modal */}
      {ejectTarget && (
        <div className="modal-overlay" onClick={() => setEjectTarget(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-icon warning">⚠</div>
            <h3 className="modal-title">Eject Member</h3>
            <p className="modal-body">
              Remove <strong>{ejectTarget.name}</strong> from this group?
              They will lose access immediately and need a new invite to rejoin.
            </p>
            <div className="modal-actions">
              <button className="btn secondary" onClick={() => setEjectTarget(null)}>Cancel</button>
              <button className="btn danger" onClick={() => handleEject(ejectTarget.id)}>Eject Member</button>
            </div>
          </div>
        </div>
      )}

      {newMemberAccess && (
        <div className="modal-overlay" onClick={() => setNewMemberAccess(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-icon success">✅</div>
            <h3 className="modal-title">Member Added</h3>
            <p className="modal-body">
              Share these credentials with <strong>{newMemberAccess.email}</strong>. They will be prompted to change
              the password after logging in.
            </p>
            <div className="modal-body" style={{ marginTop: '1rem' }}>
              <div><span className="muted">Email</span><br /><strong>{newMemberAccess.email}</strong></div>
              <div style={{ marginTop: '0.75rem' }}><span className="muted">Temporary Password</span><br /><strong>{newMemberAccess.default_password}</strong></div>
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={() => setNewMemberAccess(null)}>Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
