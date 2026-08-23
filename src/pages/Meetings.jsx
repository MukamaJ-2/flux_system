import React, { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { API_URL, SUPABASE_ANON_KEY } from '../config'

export default function Meetings() {
  const { session, hasAnyRole } = useAuth()
  const canLogMeetings = hasAnyRole('secretary', 'chair')
  const canNotify = hasAnyRole('mobilizer', 'secretary', 'chair')

  const [meetings, setMeetings] = useState([])
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showMeetingForm, setShowMeetingForm] = useState(false)
  const [meetingForm, setMeetingForm] = useState({ meetingDate: new Date().toISOString().split('T')[0], minutes: '' })
  const [attendanceFor, setAttendanceFor] = useState(null)
  const [attendanceChecked, setAttendanceChecked] = useState({})
  const [showNoticeForm, setShowNoticeForm] = useState(false)
  const [noticeMessage, setNoticeMessage] = useState('')
  const [noticeType, setNoticeType] = useState('meeting_reminder')
  const [noticeSent, setNoticeSent] = useState(false)

  function authHeaders() {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      apikey: SUPABASE_ANON_KEY,
    }
  }

  const fetchAll = useCallback(async () => {
    try {
      const [meetingsRes, membersRes] = await Promise.all([
        fetch(`${API_URL}/meetings/`, { headers: authHeaders() }),
        fetch(`${API_URL}/members/`, { headers: authHeaders() }),
      ])
      if (meetingsRes.ok) setMeetings(await meetingsRes.json())
      if (membersRes.ok) setMembers(await membersRes.json())
    } catch (e) {
      console.error('Failed to fetch meetings/members', e)
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  async function handleLogMeeting(e) {
    e.preventDefault()
    const res = await fetch(`${API_URL}/meetings/`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(meetingForm),
    })
    if (res.ok) {
      setMeetingForm({ meetingDate: new Date().toISOString().split('T')[0], minutes: '' })
      setShowMeetingForm(false)
      fetchAll()
    }
  }

  function openAttendance(meetingId) {
    setAttendanceFor(meetingId)
    setAttendanceChecked({})
  }

  async function saveAttendance() {
    const memberIds = Object.keys(attendanceChecked).filter((id) => attendanceChecked[id])
    await fetch(`${API_URL}/meetings/${attendanceFor}/attendance/`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ memberIds }),
    })
    setAttendanceFor(null)
  }

  async function handleSendNotice(e) {
    e.preventDefault()
    const res = await fetch(`${API_URL}/notifications/`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ type: noticeType, message: noticeMessage }),
    })
    if (res.ok) {
      setNoticeMessage('')
      setShowNoticeForm(false)
      setNoticeSent(true)
      setTimeout(() => setNoticeSent(false), 3000)
    }
  }

  if (loading) return <div className="page">Loading…</div>

  return (
    <div className="page">
      <div className="page-intro">
        <div className="page-intro-icon teal">📋</div>
        <div>
          <div className="page-kicker">Meetings</div>
          <h2>Minutes & Attendance</h2>
        </div>
      </div>

      {canNotify && (
        <div className="section-block">
          <div className="section-heading"><span>Send a Notice</span></div>
          <div className="card-box">
            {!showNoticeForm ? (
              <button className="btn secondary full" onClick={() => setShowNoticeForm(true)}>Compose Notice</button>
            ) : (
              <form onSubmit={handleSendNotice} className="flux-form">
                <div className="field-group">
                  <label>Type</label>
                  <select value={noticeType} onChange={(e) => setNoticeType(e.target.value)}>
                    <option value="meeting_reminder">Meeting Reminder</option>
                    <option value="deadline_reminder">Contribution Deadline</option>
                    <option value="general">General Announcement</option>
                  </select>
                </div>
                <div className="field-group">
                  <label>Message</label>
                  <textarea rows={3} required value={noticeMessage} onChange={(e) => setNoticeMessage(e.target.value)} placeholder="e.g. Meeting this Saturday at 3pm, group hall." />
                </div>
                <div className="req-actions">
                  <button type="button" className="btn secondary" onClick={() => setShowNoticeForm(false)}>Cancel</button>
                  <button type="submit" className="btn primary">Send to All Members</button>
                </div>
              </form>
            )}
            {noticeSent && <div className="text-success mt-1">Notice sent to all members.</div>}
          </div>
        </div>
      )}

      {canLogMeetings && (
        <div className="page-top-row">
          <button className="btn" onClick={() => setShowMeetingForm((s) => !s)}>
            {showMeetingForm ? 'Cancel' : '+ Log Meeting'}
          </button>
        </div>
      )}

      {showMeetingForm && (
        <div className="card-box" style={{ marginTop: '16px' }}>
          <form onSubmit={handleLogMeeting} className="flux-form">
            <div className="field-group">
              <label>Meeting Date</label>
              <input type="date" required value={meetingForm.meetingDate} onChange={(e) => setMeetingForm({ ...meetingForm, meetingDate: e.target.value })} />
            </div>
            <div className="field-group">
              <label>Minutes</label>
              <textarea rows={5} required placeholder="Attendance, agenda, decisions, action points..." value={meetingForm.minutes} onChange={(e) => setMeetingForm({ ...meetingForm, minutes: e.target.value })} />
            </div>
            <button type="submit" className="btn primary">Save Minutes</button>
          </form>
        </div>
      )}

      <div className="section-block">
        <div className="section-heading"><span>Past Meetings</span></div>
        {meetings.length === 0 ? (
          <div className="empty-state"><p>No meetings logged yet.</p></div>
        ) : (
          <div className="list-group">
            {meetings.map((m) => (
              <div key={m.id} className="list-item" style={{ alignItems: 'flex-start' }}>
                <div className="list-icon" style={{ background: 'var(--blue)', color: 'white' }}>📝</div>
                <div className="list-text">
                  <div><strong>{new Date(m.meetingDate).toLocaleDateString()}</strong></div>
                  <div className="text-sm">{m.minutes}</div>
                </div>
                {canLogMeetings && (
                  <button className="btn secondary small" onClick={() => openAttendance(m.id)}>Mark Attendance</button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {attendanceFor && (
        <div className="modal-overlay" onClick={() => setAttendanceFor(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Mark Attendance</h3>
            <div className="modal-body" style={{ maxHeight: '300px', overflowY: 'auto' }}>
              {members.map((m) => (
                <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0' }}>
                  <input
                    type="checkbox"
                    checked={!!attendanceChecked[m.id]}
                    onChange={(e) => setAttendanceChecked({ ...attendanceChecked, [m.id]: e.target.checked })}
                  />
                  {m.fullName || m.id}
                </label>
              ))}
            </div>
            <div className="modal-actions">
              <button className="btn secondary" onClick={() => setAttendanceFor(null)}>Cancel</button>
              <button className="btn primary" onClick={saveAttendance}>Save Attendance</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
