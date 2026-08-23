import React, { useState, useEffect, useCallback } from 'react'
import { useGroups } from '../context/GroupsContext'
import { useAuth } from '../context/AuthContext'
import { API_URL, SUPABASE_ANON_KEY } from '../config'
import GroupSwitcher from '../components/GroupSwitcher'

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('flux_access_token')}`,
    apikey: SUPABASE_ANON_KEY,
  }
}

export default function SecretaryDashboard() {
  const { data, progressWorkflow } = useGroups()
  const { user } = useAuth()
  const [noticeSent, setNoticeSent] = useState(false)
  const [notices, setNotices] = useState([])
  const [noticeForm, setNoticeForm] = useState({ type: 'Meeting Reminder', message: '' })
  const [activeGroupId, setActiveGroupId] = useState(null)
  const [minutes, setMinutes] = useState([])
  const [showMinutesForm, setShowMinutesForm] = useState(false)
  const [minutesForm, setMinutesForm] = useState({ title: '', meetingDate: new Date().toISOString().split('T')[0], content: '' })
  const [minutesSaved, setMinutesSaved] = useState(false)

  const mainGroup = data.groups.find((g) => g.id === activeGroupId) || data.groups[0]

  const fetchNotices = useCallback(async () => {
    if (!mainGroup) return
    try {
      const res = await fetch(`${API_URL}/notices/?group=${mainGroup.id}`, { headers: authHeaders() })
      if (res.ok) setNotices(await res.json())
    } catch (e) {
      console.error('Failed to fetch notices', e)
    }
  }, [mainGroup?.id])

  const fetchMinutes = useCallback(async () => {
    if (!mainGroup) return
    try {
      const res = await fetch(`${API_URL}/minutes/?group=${mainGroup.id}`, { headers: authHeaders() })
      if (res.ok) setMinutes(await res.json())
    } catch (e) {
      console.error('Failed to fetch meeting minutes', e)
    }
  }, [mainGroup?.id])

  useEffect(() => {
    fetchNotices()
    fetchMinutes()
  }, [fetchNotices, fetchMinutes])

  if (!mainGroup) {
    return (
      <div className="page dashboard-page">
        <div className="empty-state"><p>Join or create a group to use the Secretary panel.</p></div>
      </div>
    )
  }

  const pendingIntake = (mainGroup.requests || []).filter((r) => r.type !== 'contribution' && r.status === 'pending_secretary')

  const handleApprove = (reqId) => {
    progressWorkflow(mainGroup.id, reqId, 'pending_treasury', user.fullName)
  }

  const handleReject = (reqId) => {
    progressWorkflow(mainGroup.id, reqId, 'rejected', user.fullName, false)
  }

  const handleLogMinutes = async (e) => {
    e.preventDefault()
    const res = await fetch(`${API_URL}/minutes/`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        groupId: mainGroup.id,
        title: minutesForm.title,
        meetingDate: minutesForm.meetingDate,
        content: minutesForm.content,
      }),
    })
    if (res.ok) {
      const created = await res.json()
      setMinutes((prev) => [created, ...prev])
      setMinutesForm({ title: '', meetingDate: new Date().toISOString().split('T')[0], content: '' })
      setShowMinutesForm(false)
      setMinutesSaved(true)
      setTimeout(() => setMinutesSaved(false), 3000)
    }
  }

  const handleSendNotice = async (e) => {
    e.preventDefault()
    const res = await fetch(`${API_URL}/notices/`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        groupId: mainGroup.id,
        type: noticeForm.type,
        message: noticeForm.message,
      }),
    })
    if (res.ok) {
      const created = await res.json()
      setNotices((prev) => [created, ...prev])
      setNoticeSent(true)
      setNoticeForm({ type: 'Meeting Reminder', message: '' })
      setTimeout(() => setNoticeSent(false), 3000)
    }
  }

  // Active-contributor rate: % of members who've contributed in the last
  // 90 days. There's no meeting check-in feature, so this is a proxy for
  // engagement, not literal meeting attendance — labeled accordingly below.
  const recentRecords = (mainGroup.records || []).filter(
    (r) => new Date(r.date) > new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
  )
  const activeContributorRate = mainGroup.members.length > 0
    ? Math.round((new Set(recentRecords.map((r) => r.memberId)).size / mainGroup.members.length) * 100)
    : 0

  return (
    <div className="page dashboard-page">
      <header className="page-header">
        <h1>Secretary Dashboard</h1>
        <p>Review new submissions, advance them to treasury, and send member notices.</p>
      </header>

      <GroupSwitcher groups={data.groups} activeGroupId={mainGroup.id} onChange={setActiveGroupId} />

      <div className="dashboard-grid">
        <div className="section-block">
          <div className="section-heading"><span>Loan Application Intake</span></div>
          {pendingIntake.length === 0 ? (
            <div className="empty-state">
              <p>No new loan applications waiting for review.</p>
            </div>
          ) : (
            <div className="request-list">
              {pendingIntake.map((req) => (
                <div key={req.id} className="request-card">
                  <div className="req-header">
                    <strong>{req.requesterName}</strong>
                    <span className="badge warning">Needs Review</span>
                  </div>
                  <div className="req-body">
                    <div>Amount: <strong>UGX {req.amount?.toLocaleString()}</strong></div>
                    <div>Note: {req.note}</div>
                    <div className="text-muted text-sm">Requested: {new Date(req.createdAt).toLocaleDateString()}</div>
                  </div>
                  <div className="req-actions">
                    <button className="btn success" onClick={() => handleApprove(req.id)}>Verify Completeness</button>
                    <button className="btn danger" onClick={() => handleReject(req.id)}>Reject</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="section-block">
          <div className="section-heading"><span>Send Group Notice</span></div>
          <div className="card-box">
            <form onSubmit={handleSendNotice} className="flux-form">
              <div className="form-group">
                <label>Notice Type</label>
                <select
                  className="form-input"
                  value={noticeForm.type}
                  onChange={(e) => setNoticeForm({ ...noticeForm, type: e.target.value })}
                >
                  <option>Meeting Reminder</option>
                  <option>Deadline Alert</option>
                  <option>General Announcement</option>
                </select>
              </div>
              <div className="form-group">
                <label>Message</label>
                <textarea
                  className="form-input"
                  rows="3"
                  required
                  placeholder="Type your message to the group..."
                  value={noticeForm.message}
                  onChange={(e) => setNoticeForm({ ...noticeForm, message: e.target.value })}
                ></textarea>
              </div>
              <button type="submit" className="btn full">Broadcast Notice</button>
              {noticeSent && <div className="text-success mt-1">Notice sent successfully to group members.</div>}
            </form>

            {notices.length > 0 && (
              <div className="list-group mt-1">
                {notices.slice(0, 5).map((n) => (
                  <div key={n.id} className="list-item">
                    <div className="list-icon" style={{ background: 'var(--teal)', color: 'white' }}>N</div>
                    <div className="list-text">
                      <div><strong>{n.type}</strong></div>
                      <small className="text-muted">{n.message}</small>
                      <small className="text-muted">By {n.author} - {new Date(n.createdAt).toLocaleDateString()}</small>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="section-block">
          <div className="section-heading"><span>Meeting Minutes</span></div>
          <div className="card-box">
            <p className="text-muted text-sm">Log the record of what was discussed and decided at a group meeting.</p>
            {!showMinutesForm ? (
              <button className="btn secondary full mt-1" onClick={() => setShowMinutesForm(true)}>Log Meeting Minutes</button>
            ) : (
              <form onSubmit={handleLogMinutes} className="flux-form mt-1">
                <div className="form-group">
                  <label>Meeting Title</label>
                  <input
                    type="text"
                    className="form-input"
                    required
                    value={minutesForm.title}
                    onChange={(e) => setMinutesForm({ ...minutesForm, title: e.target.value })}
                    placeholder="e.g. Monthly General Meeting"
                  />
                </div>
                <div className="form-group">
                  <label>Meeting Date</label>
                  <input
                    type="date"
                    className="form-input"
                    required
                    value={minutesForm.meetingDate}
                    onChange={(e) => setMinutesForm({ ...minutesForm, meetingDate: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Minutes</label>
                  <textarea
                    className="form-input"
                    rows="5"
                    required
                    placeholder="Attendance, agenda items, decisions made, action points..."
                    value={minutesForm.content}
                    onChange={(e) => setMinutesForm({ ...minutesForm, content: e.target.value })}
                  ></textarea>
                </div>
                <div className="req-actions">
                  <button type="button" className="btn secondary" onClick={() => setShowMinutesForm(false)}>Cancel</button>
                  <button type="submit" className="btn primary">Save Minutes</button>
                </div>
                {minutesSaved && <div className="text-success mt-1">Minutes saved to the group record.</div>}
              </form>
            )}

            {minutes.length > 0 && (
              <div className="list-group mt-1">
                {minutes.slice(0, 5).map((m) => (
                  <div key={m.id} className="list-item">
                    <div className="list-icon" style={{ background: 'var(--blue)', color: 'white' }}>📝</div>
                    <div className="list-text">
                      <div><strong>{m.title}</strong></div>
                      <small className="text-muted">{m.meetingDate ? new Date(m.meetingDate).toLocaleDateString() : ''} - logged by {m.author}</small>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="section-block">
          <div className="section-heading"><span>Engagement Overview</span></div>
          <div className="card-box">
            <div className="info-row">
              <span>Active Contributor Rate (last 90 days)</span>
              <strong>{activeContributorRate}%</strong>
            </div>
            <div className="info-row">
              <span>Active Members</span>
              <strong>{mainGroup.members.length}</strong>
            </div>
            <div className="info-row">
              <span>Contributions This Quarter</span>
              <strong>{recentRecords.length}</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
