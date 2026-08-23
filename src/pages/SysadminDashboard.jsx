import React, { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { API_URL } from '../config'

const ROLES = ['member', 'mobilizer', 'audit', 'secretary', 'treasury', 'chair', 'sysadmin']

export default function SysadminDashboard() {
  const { createUser, user: currentUser } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [roleDrafts, setRoleDrafts] = useState({})

  // Add Member modal state
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', role: 'member' })
  const [formError, setFormError] = useState('')
  const [formLoading, setFormLoading] = useState(false)
  const [createdUser, setCreatedUser] = useState(null) // holds {email, default_password}

  const fetchUsers = async () => {
    const token = localStorage.getItem('flux_access_token')
    try {
      const res = await fetch(`${API_URL}/users/`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) setUsers(await res.json())
    } catch (e) {
      console.error('Failed to fetch users', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchUsers() }, [])

  const handleFieldChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }))
  }

  const handleRoleChange = (userId, role) => {
    setRoleDrafts((drafts) => ({ ...drafts, [userId]: role }))
  }

  const handleSaveRole = async (user) => {
    const token = localStorage.getItem('flux_access_token')
    const nextRole = roleDrafts[user.id] ?? user.role

    try {
      const res = await fetch(`${API_URL}/users/${user.id}/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role: nextRole }),
      })

      if (res.ok) {
        const updated = await res.json()
        setUsers((current) => current.map((item) => (item.id === user.id ? updated : item)))
        setRoleDrafts((drafts) => ({ ...drafts, [user.id]: updated.role }))
      } else {
        const body = await res.json().catch(() => ({}))
        alert(body.error || 'Failed to update role.')
      }
    } catch (error) {
      alert(error.message)
    }
  }

  const handleToggleActive = async (user) => {
    const token = localStorage.getItem('flux_access_token')
    const nextActiveState = !user.is_active

    try {
      const res = await fetch(`${API_URL}/users/${user.id}/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ is_active: nextActiveState }),
      })

      if (res.ok) {
        const updated = await res.json()
        setUsers((current) => current.map((item) => (item.id === user.id ? updated : item)))
      } else {
        const body = await res.json().catch(() => ({}))
        alert(body.error || 'Failed to update user status.')
      }
    } catch (error) {
      alert(error.message)
    }
  }

  const handleDeleteUser = async (user) => {
    const confirmed = window.confirm(`Delete ${user.fullName || user.email}? This cannot be undone.`)
    if (!confirmed) return

    const token = localStorage.getItem('flux_access_token')

    try {
      const res = await fetch(`${API_URL}/users/${user.id}/`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })

      if (res.ok || res.status === 204) {
        setUsers((current) => current.filter((item) => item.id !== user.id))
        setRoleDrafts((drafts) => {
          const next = { ...drafts }
          delete next[user.id]
          return next
        })
      } else {
        const body = await res.json().catch(() => ({}))
        alert(body.error || 'Failed to delete user.')
      }
    } catch (error) {
      alert(error.message)
    }
  }

  const handleAddMember = async (e) => {
    e.preventDefault()
    setFormError('')
    setFormLoading(true)
    const result = await createUser(form)
    setFormLoading(false)
    if (result.success) {
      setCreatedUser({ email: result.data.email, default_password: result.data.default_password })
      setForm({ fullName: '', email: '', phone: '', role: 'member' })
      fetchUsers() // Refresh list
    } else {
      setFormError(result.error || 'Failed to create user.')
    }
  }

  const closeModal = () => {
    setShowModal(false)
    setCreatedUser(null)
    setFormError('')
  }

  if (loading) return <div className="page dashboard-page">Loading...</div>

  return (
    <div className="page dashboard-page">
      <header className="page-header">
        <h1>Sysadmin Panel</h1>
        <p>User account management, role assignment, system health, and configurations. No fund access.</p>
      </header>

      <div className="dashboard-grid">

        {/* Account Overview */}
        <div className="section-block">
          <div className="section-heading"><span>Account Overview</span></div>
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))' }}>
            <div className="stat-tile green">
              <div className="stat-value">{users.length}</div>
              <div className="stat-label">Total Accounts</div>
            </div>
            <div className="stat-tile teal">
              <div className="stat-value">{users.filter((u) => u.is_active).length}</div>
              <div className="stat-label">Active</div>
            </div>
            <div className="stat-tile blue">
              <div className="stat-value">{users.filter((u) => u.must_change_password).length}</div>
              <div className="stat-label">Pending First Login</div>
            </div>
          </div>
        </div>

        {/* User Accounts & Roles */}
        <div className="section-block" style={{ gridColumn: '1 / -1' }}>
          <div className="section-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Global User Accounts & Roles</span>
            <button
              id="add-member-btn"
              className="btn gold small"
              onClick={() => setShowModal(true)}
            >
              + Add Member
            </button>
          </div>

          <div className="card-box" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  <th style={{ padding: '0.5rem' }}>Name</th>
                  <th style={{ padding: '0.5rem' }}>Email</th>
                  <th style={{ padding: '0.5rem' }}>Role</th>
                  <th style={{ padding: '0.5rem' }}>Status</th>
                  <th style={{ padding: '0.5rem' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.75rem 0.5rem' }}><strong>{u.fullName}</strong></td>
                    <td style={{ padding: '0.75rem 0.5rem' }}>{u.email}</td>
                    <td style={{ padding: '0.75rem 0.5rem' }}>
                      <select
                        value={roleDrafts[u.id] ?? u.role}
                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        disabled={u.id === currentUser?.id}
                        style={{ minWidth: '140px' }}
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r.charAt(0).toUpperCase() + r.slice(1)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem' }}>
                      {u.must_change_password
                        ? <span style={{ color: 'var(--warning, #f59e0b)', fontSize: '0.8rem' }}>⚠ Pending Setup</span>
                        : <span style={{ color: 'var(--success, #10b981)', fontSize: '0.8rem' }}>✓ Active</span>}
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem', display: 'flex', gap: '0.5rem' }}>
                      <button className="btn secondary small" onClick={() => handleSaveRole(u)} disabled={u.id === currentUser?.id}>
                        Save Role
                      </button>
                      <button
                        className="btn secondary small"
                        onClick={() => handleToggleActive(u)}
                        disabled={u.id === currentUser?.id}
                      >
                        {u.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button className="btn danger small" onClick={() => handleDeleteUser(u)} disabled={u.id === currentUser?.id}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Add Member Modal */}
      {showModal && (
        <div
          id="add-member-modal"
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
            zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '1rem',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) closeModal() }}
        >
          <div style={{
            background: 'var(--bg-card, #fff)', borderRadius: '1rem',
            padding: '2rem', width: '100%', maxWidth: '480px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }}>
            {createdUser ? (
              /* ── Success State ── */
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>✅</div>
                <h2 style={{ marginBottom: '0.5rem' }}>Member Added!</h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                  Share these credentials with <strong>{createdUser.email}</strong>. They will be prompted
                  to change their password on first login.
                </p>
                <div style={{
                  background: 'var(--bg-secondary, #f5f5f5)', borderRadius: '0.5rem',
                  padding: '1rem', marginBottom: '1.5rem', textAlign: 'left',
                }}>
                  <div style={{ marginBottom: '0.5rem' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>EMAIL</span><br />
                    <strong>{createdUser.email}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>TEMPORARY PASSWORD</span><br />
                    <strong style={{ fontFamily: 'monospace', fontSize: '1.1rem', color: 'var(--accent, #d97706)' }}>
                      {createdUser.default_password}
                    </strong>
                  </div>
                </div>
                <button className="btn gold full" onClick={closeModal}>Done</button>
              </div>
            ) : (
              /* ── Form State ── */
              <>
                <h2 style={{ marginBottom: '0.25rem' }}>Add New Member</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
                  A temporary password will be generated. Share it with the member.
                </p>

                {formError && (
                  <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>
                    <span>⚠</span> {formError}
                  </div>
                )}

                <form onSubmit={handleAddMember}>
                  <div className="field-group" style={{ marginBottom: '1rem' }}>
                    <label>Full Name *</label>
                    <input
                      name="fullName" value={form.fullName}
                      onChange={handleFieldChange}
                      placeholder="e.g. Jane Doe" required
                    />
                  </div>
                  <div className="field-group" style={{ marginBottom: '1rem' }}>
                    <label>Gmail Address *</label>
                    <input
                      name="email" type="email" value={form.email}
                      onChange={handleFieldChange}
                      placeholder="member@gmail.com" required
                    />
                  </div>
                  <div className="field-group" style={{ marginBottom: '1rem' }}>
                    <label>Phone</label>
                    <input
                      name="phone" type="tel" value={form.phone}
                      onChange={handleFieldChange}
                      placeholder="+256 700 000000"
                    />
                  </div>
                  <div className="field-group" style={{ marginBottom: '1.5rem' }}>
                    <label>Role *</label>
                    <select name="role" value={form.role} onChange={handleFieldChange}>
                      {ROLES.map(r => (
                        <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button type="button" className="btn secondary full" onClick={closeModal}>
                      Cancel
                    </button>
                    <button type="submit" className="btn gold full" disabled={formLoading}>
                      {formLoading ? <span className="spinner" /> : 'Create Member'}
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
