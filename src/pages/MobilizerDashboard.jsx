import React, { useState, useEffect, useCallback } from 'react'
import { useGroups } from '../context/GroupsContext'
import { useAuth } from '../context/AuthContext'
import { API_URL, SUPABASE_ANON_KEY } from '../config'

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('flux_access_token')}`,
    apikey: SUPABASE_ANON_KEY,
  }
}

export default function MobilizerDashboard() {
  const { data, copyInviteCode } = useGroups()
  const { user } = useAuth()
  const [issues, setIssues] = useState([])
  const [showIssueForm, setShowIssueForm] = useState(false)
  const [issueForm, setIssueForm] = useState({ title: '', description: '', groupId: '' })
  const [reminded, setReminded] = useState({})
  const [reminding, setReminding] = useState({})
  const [copiedCode, setCopiedCode] = useState('')
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [inviteForm, setInviteForm] = useState({ groupId: '', message: '' })
  const [inviteSent, setInviteSent] = useState(false)
  const [invites, setInvites] = useState([])

  const myGroups = data.groups.filter((g) =>
    g.members.some((m) => m.id === user?.id),
  )

  const fetchIssues = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/issues/`, { headers: authHeaders() })
      if (res.ok) setIssues(await res.json())
    } catch (e) {
      console.error('Failed to fetch issues', e)
    }
  }, [])

  useEffect(() => {
    fetchIssues()
  }, [fetchIssues])

  const fetchInvites = useCallback(async (groupId) => {
    if (!groupId) return
    try {
      const res = await fetch(`${API_URL}/messages/?group=${groupId}`, { headers: authHeaders() })
      if (res.ok) {
        const all = await res.json()
        setInvites(all.filter((m) => m.type === 'meeting_invite'))
      }
    } catch (e) {
      console.error('Failed to fetch invitations', e)
    }
  }, [])

  useEffect(() => {
    const groupId = inviteForm.groupId || (myGroups[0] && myGroups[0].id)
    fetchInvites(groupId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inviteForm.groupId, myGroups[0]?.id])

  const handleRemind = async (member) => {
    setReminding((prev) => ({ ...prev, [member.id]: true }))
    try {
      const res = await fetch(`${API_URL}/messages/`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          groupId: member.groupId,
          type: 'reminder',
          recipientId: member.id,
          message: `Hi ${member.name}, this is a reminder that your UGX ${member.contribution?.toLocaleString()} contribution to ${member.groupName} is due. Please pay as soon as you can.`,
        }),
      })
      if (res.ok) {
        setReminded((prev) => ({ ...prev, [member.id]: true }))
        setTimeout(() => setReminded((prev) => ({ ...prev, [member.id]: false })), 3000)
      }
    } catch (e) {
      console.error('Failed to send reminder', e)
    }
    setReminding((prev) => ({ ...prev, [member.id]: false }))
  }

  const handleSendInvite = async (e) => {
    e.preventDefault()
    const groupId = inviteForm.groupId || (myGroups[0] && myGroups[0].id)
    if (!groupId || !inviteForm.message.trim()) return
    const res = await fetch(`${API_URL}/messages/`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        groupId,
        type: 'meeting_invite',
        message: inviteForm.message,
      }),
    })
    if (res.ok) {
      const created = await res.json()
      setInvites((prev) => [created, ...prev])
      setInviteForm({ groupId, message: '' })
      setInviteSent(true)
      setTimeout(() => setInviteSent(false), 3000)
    }
  }

  const handleLogIssue = async (e) => {
    e.preventDefault()
    const res = await fetch(`${API_URL}/issues/`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        title: issueForm.title,
        description: issueForm.description,
        groupId: issueForm.groupId || (myGroups[0] && myGroups[0].id),
      }),
    })
    if (res.ok) {
      const created = await res.json()
      setIssues((prev) => [created, ...prev])
      setIssueForm({ title: '', description: '', groupId: '' })
      setShowIssueForm(false)
    }
  }

  const handleResolveIssue = async (id) => {
    const res = await fetch(`${API_URL}/issues/${id}/`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ status: 'resolved' }),
    })
    if (res.ok) {
      const updated = await res.json()
      setIssues((prev) => prev.map((i) => (i.id === id ? updated : i)))
    }
  }

  const handleCopyCode = (code) => {
    navigator.clipboard.writeText(code).catch(() => {})
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(''), 2000)
  }

  // Compute real health metrics from group data
  const allMembers = myGroups.flatMap((g) => g.members)
  const allRecords = myGroups.flatMap((g) =>
    (g.records || []).map((r) => ({ ...r, groupName: g.name })),
  )

  const totalExpected = myGroups.reduce(
    (sum, g) => sum + (g.contribution || 0) * (g.members || []).length,
    0,
  )
  const totalCollected = allRecords.reduce((s, r) => s + (r.amount || 0), 0)
  const consistencyRate =
    totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 0

  // Defaulters: members who haven't contributed within THIS group's own
  // schedule (frequency + configured grace period) — a weekly group and a
  // monthly group shouldn't use the same fixed window.
  const FREQUENCY_DAYS = { Daily: 1, Weekly: 7, Monthly: 30 }
  const dueWindowDays = (g) => (FREQUENCY_DAYS[g.frequency] || 30) + (Number(g.rules?.grace) || 0)

  const defaulters = myGroups.flatMap((g) => {
    const windowStart = new Date()
    windowStart.setDate(windowStart.getDate() - dueWindowDays(g))
    const lastContributionByMember = {}
    for (const r of g.records || []) {
      const prev = lastContributionByMember[r.memberId]
      if (!prev || new Date(r.date) > new Date(prev)) lastContributionByMember[r.memberId] = r.date
    }
    return (g.members || [])
      .filter((m) => {
        const last = lastContributionByMember[String(m.id)]
        return !last || new Date(last) < windowStart
      })
      .map((m) => {
        const last = lastContributionByMember[String(m.id)]
        const daysOverdue = last ? Math.floor((Date.now() - new Date(last).getTime()) / (24 * 60 * 60 * 1000)) : null
        return { ...m, groupId: g.id, groupName: g.name, contribution: g.contribution, daysOverdue }
      })
  })

  const newMembersCount = allMembers.filter(
    (m) => m.joined_at && new Date(m.joined_at) > new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
  ).length

  return (
    <div className="page dashboard-page">
      <header className="page-header">
        <h1>Mobilizer Dashboard</h1>
        <p>Track defaulters, onboard members, and support member engagement.</p>
      </header>

      <div className="dashboard-grid">
        <div className="section-block">
          <div className="section-heading"><span>Group Health Score</span></div>
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))' }}>
            <div className="stat-tile green">
              <div className="stat-value">{consistencyRate}%</div>
              <div className="stat-label">Consistency</div>
            </div>
            <div className="stat-tile gold">
              <div className="stat-value">{allMembers.length}</div>
              <div className="stat-label">Total Members</div>
            </div>
            <div className="stat-tile blue">
              <div className="stat-value">{newMembersCount}</div>
              <div className="stat-label">New Members (YTD)</div>
            </div>
          </div>
        </div>

        <div className="section-block">
          <div className="section-heading"><span>Track Defaulters</span></div>
          <div className="card-box">
            {defaulters.length === 0 ? (
              <div className="empty-state"><p>All members are up to date. No defaulters.</p></div>
            ) : (
              <div className="list-group">
                {defaulters.map((d) => (
                  <div key={`${d.groupId}-${d.id}`} className="list-item">
                    <div className="list-icon" style={{ background: 'var(--red)', color: 'white' }}>!</div>
                    <div className="list-text">
                      <div><strong>{d.name}</strong></div>
                      <small className="text-muted">
                        {d.groupName} - UGX {d.contribution?.toLocaleString()} due
                        {d.daysOverdue != null ? ` - ${d.daysOverdue} days overdue` : ' - no contributions yet'}
                      </small>
                    </div>
                    <button
                      className={`btn ${reminded[d.id] ? 'success' : 'secondary'} small`}
                      disabled={!!reminding[d.id]}
                      onClick={() => handleRemind(d)}
                    >
                      {reminded[d.id] ? '✓ Sent' : reminding[d.id] ? 'Sending…' : 'Send Reminder'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="section-block">
          <div className="section-heading"><span>Recruitment Pipeline</span></div>
          <div className="card-box">
            <p className="text-muted text-sm">Share a group's joining code with prospects to onboard them.</p>
            {myGroups.length === 0 ? (
              <div className="empty-state"><p>You are not in any groups yet.</p></div>
            ) : (
              <div className="list-group">
                {myGroups.map((g) => (
                  <div key={g.id} className="list-item">
                    <div className="list-icon" style={{ background: 'var(--teal)', color: 'white' }}>+</div>
                    <div className="list-text">
                      <div><strong>{g.name}</strong></div>
                      <small className="text-muted">Joining Code: {g.invite_code}</small>
                    </div>
                    <button
                      className={`btn ${copiedCode === g.invite_code ? 'success' : 'primary'} small`}
                      onClick={() => handleCopyCode(g.invite_code)}
                    >
                      {copiedCode === g.invite_code ? '✓ Copied' : 'Copy Invite Code'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="section-block">
          <div className="section-heading"><span>Meeting Invitations</span></div>
          <div className="card-box">
            <p className="text-muted text-sm">Broadcast a meeting invitation to every member of a group.</p>
            {!showInviteForm ? (
              <button className="btn secondary full mt-1" onClick={() => setShowInviteForm(true)}>Send Meeting Invitation</button>
            ) : (
              <form onSubmit={handleSendInvite} className="flux-form mt-1">
                {myGroups.length > 1 && (
                  <div className="form-group">
                    <label>Group</label>
                    <select
                      className="form-input"
                      value={inviteForm.groupId || myGroups[0]?.id || ''}
                      onChange={(e) => setInviteForm({ ...inviteForm, groupId: e.target.value })}
                    >
                      {myGroups.map((g) => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="form-group">
                  <label>Invitation Message</label>
                  <textarea
                    className="form-input"
                    rows="3"
                    required
                    value={inviteForm.message}
                    onChange={(e) => setInviteForm({ ...inviteForm, message: e.target.value })}
                    placeholder="e.g. Meeting this Saturday at 3pm, group hall. Please bring your contribution book."
                  />
                </div>
                <div className="req-actions">
                  <button type="button" className="btn secondary" onClick={() => setShowInviteForm(false)}>Cancel</button>
                  <button type="submit" className="btn primary">Send to All Members</button>
                </div>
                {inviteSent && <div className="text-success mt-1">Invitation sent to all group members.</div>}
              </form>
            )}

            {invites.length > 0 && (
              <div className="list-group mt-1">
                {invites.slice(0, 5).map((inv) => (
                  <div key={inv.id} className="list-item">
                    <div className="list-icon" style={{ background: 'var(--gold)', color: 'white' }}>📅</div>
                    <div className="list-text">
                      <div>{inv.message}</div>
                      <small className="text-muted">By {inv.sender} - {new Date(inv.createdAt).toLocaleDateString()}</small>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="section-block">
          <div className="section-heading"><span>Issue Recognition</span></div>
          <div className="card-box">
            <p className="text-muted text-sm">Log member disputes, complaints, or engagement issues to be escalated to the Chair.</p>
            {!showIssueForm ? (
              <button className="btn secondary full mt-1" onClick={() => setShowIssueForm(true)}>Log New Issue</button>
            ) : (
              <form onSubmit={handleLogIssue} className="flux-form mt-1">
                {myGroups.length > 1 && (
                  <div className="form-group">
                    <label>Group</label>
                    <select
                      className="form-input"
                      value={issueForm.groupId}
                      onChange={(e) => setIssueForm({ ...issueForm, groupId: e.target.value })}
                    >
                      {myGroups.map((g) => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="form-group">
                  <label>Issue Title</label>
                  <input
                    type="text"
                    className="form-input"
                    required
                    value={issueForm.title}
                    onChange={(e) => setIssueForm({ ...issueForm, title: e.target.value })}
                    placeholder="Brief description of the issue"
                  />
                </div>
                <div className="form-group">
                  <label>Details</label>
                  <textarea
                    className="form-input"
                    rows="3"
                    required
                    value={issueForm.description}
                    onChange={(e) => setIssueForm({ ...issueForm, description: e.target.value })}
                    placeholder="Describe the issue in detail..."
                  />
                </div>
                <div className="req-actions">
                  <button type="button" className="btn secondary" onClick={() => setShowIssueForm(false)}>Cancel</button>
                  <button type="submit" className="btn primary">Submit Issue</button>
                </div>
              </form>
            )}

            {issues.length > 0 && (
              <div className="list-group mt-1">
                {issues.map((iss) => (
                  <div key={iss.id} className="list-item">
                    <div className="list-icon" style={{ background: iss.status === 'resolved' ? 'var(--green)' : 'var(--gold)', color: 'white' }}>
                      {iss.status === 'resolved' ? '✓' : '!'}
                    </div>
                    <div className="list-text">
                      <div><strong>{iss.title}</strong></div>
                      <small className="text-muted">{iss.groupName} - {iss.description}</small>
                    </div>
                    {iss.status !== 'resolved' && (
                      <button className="btn success small" onClick={() => handleResolveIssue(iss.id)}>
                        Resolve
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
