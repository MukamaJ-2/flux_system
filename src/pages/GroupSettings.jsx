import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useGroups } from '../context/GroupsContext'
import { useAuth } from '../context/AuthContext'

export default function GroupSettings() {
  const { id } = useParams()
  const { data, updateGroup, deleteGroup, removeMember, addMember, editMember } = useGroups()
  const { user } = useAuth()
  const navigate = useNavigate()
  const group = data.groups.find((g) => g.id === id)

  const [editing, setEditing] = useState(false)
  const [contribution, setContribution] = useState(group?.contribution || 0)
  const [frequency, setFrequency] = useState(group?.frequency || 'Monthly')
  const [rotation, setRotation] = useState(group?.rules?.rotation || 'Sequential')
  const [grace, setGrace] = useState(group?.rules?.grace || 3)
  const [interest, setInterest] = useState(group?.rules?.interest || '3% (Flat)')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [ejectTarget, setEjectTarget] = useState(null)
  const [saved, setSaved] = useState(false)
  
  const [newMemberName, setNewMemberName] = useState('')
  const [newMemberEmail, setNewMemberEmail] = useState('')
  
  const [editTargetId, setEditTargetId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [copiedInviteCode, setCopiedInviteCode] = useState(false)
  const [newMemberAccess, setNewMemberAccess] = useState(null)

  if (!group) return <div className="page"><div className="empty-title">Group not found</div></div>

  // Members not in group — not needed when adding by email via API

  function handleSave(e) {
    e.preventDefault()
    updateGroup(id, {
      contribution: Number(contribution),
      frequency,
      rules: { rotation, grace: Number(grace), interest },
    })
    setSaved(true)
    setEditing(false)
    setTimeout(() => setSaved(false), 3000)
  }

  function startCycle() {
    updateGroup(id, { cycle: group.cycle === 'ACTIVE' ? 'OPEN' : 'ACTIVE' })
  }

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
    <div className="page settings-page">
      <div className="page-intro">
        <div className="page-intro-icon teal">⚙</div>
        <div>
          <div className="page-kicker">Admin · {group.name}</div>
          <h2>Group Settings</h2>
          <p className="subcopy">Manage group rules, members, cycle status, and more.</p>
        </div>
      </div>

      <div className="settings-card">
        <div className="settings-card-header">
          <h3>Joining Code</h3>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <div>
            <div className="subcopy" style={{ marginBottom: '0.25rem' }}>Share this code with new members so they can join the group.</div>
            <strong style={{ fontSize: '1.2rem', letterSpacing: '0.12em' }}>{group.invite_code}</strong>
          </div>
          <button type="button" className="btn secondary sm" onClick={copyInviteCode}>
            {copiedInviteCode ? 'Copied' : 'Copy Code'}
          </button>
        </div>
      </div>

      {saved && (
        <div className="alert alert-success">
          <span>✓</span> Settings saved successfully.
        </div>
      )}

      {/* Cycle control */}
      <div className="settings-card">
        <div className="settings-card-header">
          <h3>Cycle Status</h3>
          <span className={`pill ${group.cycle === 'ACTIVE' ? 'success' : 'info'}`}>{group.cycle}</span>
        </div>
        <p className="subcopy">{group.cycle === 'ACTIVE' ? 'The cycle is currently active. Click to pause it.' : 'Click to start a new contribution cycle.'}</p>
        <button className="btn gold" onClick={startCycle}>
          {group.cycle === 'ACTIVE' ? '⏸ Pause Cycle' : '▶ Start New Cycle'}
        </button>
      </div>

      {/* Group Rules */}
      <div className="settings-card">
        <div className="settings-card-header">
          <h3>Group Rules</h3>
          <button type="button" className="btn secondary sm" onClick={() => setEditing(!editing)}>
            {editing ? 'Cancel' : '✏ Edit'}
          </button>
        </div>
        {editing ? (
          <form onSubmit={handleSave} className="settings-form">
            <div className="field-row-2">
              <div className="field-group">
                <label>Contribution Amount (UGX)</label>
                <input type="number" value={contribution} onChange={(e) => setContribution(e.target.value)} min={1} />
              </div>
              <div className="field-group">
                <label>Frequency</label>
                <select value={frequency} onChange={(e) => setFrequency(e.target.value)}>
                  <option>Monthly</option>
                  <option>Weekly</option>
                  <option>Daily</option>
                </select>
              </div>
            </div>
            <div className="field-row-2">
              <div className="field-group">
                <label>Rotation Order</label>
                <select value={rotation} onChange={(e) => setRotation(e.target.value)}>
                  <option>Sequential</option>
                  <option>Random</option>
                </select>
              </div>
              <div className="field-group">
                <label>Grace Period (days)</label>
                <input type="number" value={grace} onChange={(e) => setGrace(e.target.value)} min={0} max={30} />
              </div>
            </div>
            <div className="field-group">
              <label>Late Interest Rate</label>
              <input value={interest} onChange={(e) => setInterest(e.target.value)} placeholder="e.g. 3% (Flat)" />
            </div>
            <div className="form-actions">
              <button type="submit" className="btn">Save Changes</button>
            </div>
          </form>
        ) : (
          <div className="rules-list">
            <div className="rule-row"><span className="muted">Contribution</span><strong>UGX {group.contribution.toLocaleString()}</strong></div>
            <div className="rule-row"><span className="muted">Frequency</span><strong>{group.frequency}</strong></div>
            <div className="rule-row"><span className="muted">Rotation Order</span><strong>{group.rules.rotation}</strong></div>
            <div className="rule-row"><span className="muted">Grace Period</span><strong>{group.rules.grace} days</strong></div>
            <div className="rule-row"><span className="muted">Late Interest</span><strong>{group.rules.interest}</strong></div>
          </div>
        )}
      </div>

      {/* Members */}
      <div className="settings-card">
        <div className="settings-card-header">
          <h3>Members ({group.members.length})</h3>
        </div>

        <form onSubmit={handleAddMember} className="add-member-form" style={{ marginBottom: '24px', display: 'flex', gap: '12px' }}>
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
              
              {m.role !== 'admin' && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  {editTargetId === m.id ? (
                    <>
                      <button className="btn" onClick={() => handleEditSave(m.id)}>Save</button>
                      <button className="btn secondary" onClick={() => setEditTargetId(null)}>Cancel</button>
                    </>
                  ) : (
                    <button className="btn secondary sm" onClick={() => startEdit(m)}>Edit</button>
                  )}
                  <button className="btn danger-sm" onClick={() => setEjectTarget(m)}>Eject</button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Danger Zone */}
      <div className="settings-card danger-zone">
        <div className="settings-card-header">
          <h3>⚠ Danger Zone</h3>
        </div>
        <p className="subcopy">Deleting a group is permanent and cannot be undone. All records, requests, and member data will be lost.</p>
        <button className="btn danger" onClick={() => setShowDeleteConfirm(true)}>
          🗑 Delete This Group
        </button>
      </div>

      {/* Delete confirm modal */}
      {showDeleteConfirm && (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-icon danger">🗑</div>
            <h3 className="modal-title">Delete Group</h3>
            <p className="modal-body">
              Are you sure you want to permanently delete <strong>{group.name}</strong>?
              This will remove all members, records, and request history.
            </p>
            <div className="modal-actions">
              <button className="btn secondary" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
              <button className="btn danger" onClick={handleDelete}>Delete Forever</button>
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

      {/* Eject confirm modal */}
      {ejectTarget && (
        <div className="modal-overlay" onClick={() => setEjectTarget(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-icon warning">⚠</div>
            <h3 className="modal-title">Eject Member</h3>
            <p className="modal-body">Remove <strong>{ejectTarget.name}</strong> from <strong>{group.name}</strong>?</p>
            <div className="modal-actions">
              <button className="btn secondary" onClick={() => setEjectTarget(null)}>Cancel</button>
              <button className="btn danger" onClick={() => handleEject(ejectTarget.id)}>Eject Member</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
