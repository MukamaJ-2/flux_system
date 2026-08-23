import React, { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { API_URL, SUPABASE_ANON_KEY } from '../config'

const ROLES = ['chair', 'treasurer', 'secretary', 'mobilizer', 'auditor']

export default function Members() {
  const { session, profile } = useAuth()
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteForm, setInviteForm] = useState({ fullName: '', email: '', phone: '' })
  const [inviteError, setInviteError] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [invited, setInvited] = useState(null)
  const [linkCopied, setLinkCopied] = useState(false)

  function authHeaders() {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      apikey: SUPABASE_ANON_KEY,
    }
  }

  const fetchMembers = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/members/`, { headers: authHeaders() })
      if (res.ok) setMembers(await res.json())
    } catch (e) {
      console.error('Failed to fetch members', e)
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session])

  useEffect(() => {
    fetchMembers()
  }, [fetchMembers])

  async function handleInvite(e) {
    e.preventDefault()
    setInviteError('')
    setInviteLoading(true)
    try {
      const res = await fetch(`${API_URL}/members/invite/`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(inviteForm),
      })
      const body = await res.json()
      if (res.ok) {
        setInvited(body)
        setInviteForm({ fullName: '', email: '', phone: '' })
        fetchMembers()
      } else {
        setInviteError(body.error || 'Failed to invite member.')
      }
    } catch (e) {
      setInviteError(e.message)
    }
    setInviteLoading(false)
  }

  async function toggleRole(memberId, role, hasIt) {
    const res = await fetch(`${API_URL}/members/${memberId}/roles/`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ role, grant: !hasIt }),
    })
    if (res.ok) {
      const body = await res.json()
      setMembers((prev) => prev.map((m) => (m.id === memberId ? { ...m, roles: body.roles } : m)))
    }
  }

  async function toggleActive(member) {
    const res = await fetch(`${API_URL}/members/${member.id}/active/`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ isActive: !member.isActive }),
    })
    if (res.ok) {
      const updated = await res.json()
      setMembers((prev) => prev.map((m) => (m.id === member.id ? updated : m)))
    }
  }

  const closeInviteModal = () => {
    setShowInvite(false)
    setInvited(null)
    setInviteError('')
    setLinkCopied(false)
  }

  if (loading) return <div className="page">Loading…</div>

  return (
    <div className="page">
      <div className="page-intro">
        <div className="page-intro-icon teal">◔</div>
        <div>
          <div className="page-kicker">Chair</div>
          <h2>Members</h2>
          <p className="subcopy">Invite members and assign roles. Every member has the base member permissions; roles add responsibilities on top.</p>
        </div>
      </div>

      <div className="page-top-row">
        <button className="btn" onClick={() => setShowInvite(true)}>+ Invite Member</button>
      </div>

      <div className="table-wrap" style={{ overflowX: 'auto', marginTop: '16px' }}>
        <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)' }}>
              <th style={{ padding: '0.5rem' }}>Name</th>
              <th style={{ padding: '0.5rem' }}>Status</th>
              {ROLES.map((r) => (
                <th key={r} style={{ padding: '0.5rem' }}>{r.charAt(0).toUpperCase() + r.slice(1)}</th>
              ))}
              <th style={{ padding: '0.5rem' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '0.75rem 0.5rem' }}><strong>{m.fullName || m.id}</strong></td>
                <td style={{ padding: '0.75rem 0.5rem' }}>
                  {m.isActive ? <span className="pill success">Active</span> : <span className="pill danger">Inactive</span>}
                </td>
                {ROLES.map((r) => {
                  const hasIt = m.roles?.includes(r)
                  return (
                    <td key={r} style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={!!hasIt}
                        onChange={() => toggleRole(m.id, r, hasIt)}
                        disabled={m.id === profile?.id}
                      />
                    </td>
                  )
                })}
                <td style={{ padding: '0.75rem 0.5rem' }}>
                  <button
                    className="btn secondary small"
                    onClick={() => toggleActive(m)}
                    disabled={m.id === profile?.id}
                  >
                    {m.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showInvite && (
        <div className="modal-overlay" onClick={closeInviteModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            {invited ? (
              <>
                <div className="modal-icon success">✅</div>
                <h3 className="modal-title">Member Created</h3>
                <p className="modal-body">
                  Share this link with <strong>{invited.email}</strong> directly — it lets them set
                  their own password. (Sent by hand, not email, so it works even when email delivery
                  is rate-limited.)
                </p>
                <div className="card-box" style={{ wordBreak: 'break-all', fontSize: '0.85rem', marginTop: '0.75rem' }}>
                  {invited.link}
                </div>
                <div className="modal-actions">
                  <button
                    className="btn secondary"
                    onClick={() => { navigator.clipboard.writeText(invited.link); setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000) }}
                  >
                    {linkCopied ? 'Copied' : 'Copy Link'}
                  </button>
                  <button className="btn" onClick={closeInviteModal}>Done</button>
                </div>
              </>
            ) : (
              <>
                <h3 className="modal-title">Invite Member</h3>
                {inviteError && <div className="alert alert-danger"><span>⚠</span> {inviteError}</div>}
                <form onSubmit={handleInvite} className="flux-form">
                  <div className="field-group">
                    <label>Full Name</label>
                    <input
                      value={inviteForm.fullName}
                      onChange={(e) => setInviteForm({ ...inviteForm, fullName: e.target.value })}
                      placeholder="e.g. Jane Doe"
                      required
                    />
                  </div>
                  <div className="field-group">
                    <label>Email</label>
                    <input
                      type="email"
                      value={inviteForm.email}
                      onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                      placeholder="member@example.com"
                      required
                    />
                  </div>
                  <div className="field-group">
                    <label>Phone</label>
                    <input
                      type="tel"
                      value={inviteForm.phone}
                      onChange={(e) => setInviteForm({ ...inviteForm, phone: e.target.value })}
                      placeholder="+256 700 000000"
                    />
                  </div>
                  <div className="modal-actions">
                    <button type="button" className="btn secondary" onClick={closeInviteModal}>Cancel</button>
                    <button type="submit" className="btn" disabled={inviteLoading}>
                      {inviteLoading ? <span className="spinner" /> : 'Send Invite'}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
