import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGroups } from '../context/GroupsContext'
import { useAuth } from '../context/AuthContext'

export default function CreateGroup() {
  const { createGroup } = useGroups()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [contribution, setContribution] = useState(20000)
  const [frequency, setFrequency] = useState('Monthly')
  const [rotation, setRotation] = useState('Sequential')
  const [grace, setGrace] = useState(3)
  const [interest, setInterest] = useState('3% (Flat)')
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) { setError('Group name is required'); return }
    const id = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '-' + Date.now().toString(36)
    const inviteCode = (name.slice(0, 4) + Math.random().toString(36).slice(2, 6)).toUpperCase()
    
    const result = await createGroup({
      id,
      name: name.trim(),
      description: description.trim(),
      contribution: Number(contribution),
      frequency,
      cycle: 'OPEN',
      invite_code: inviteCode,
      rules: { rotation, grace: Number(grace), interest },
    })
    
    if (result && result.success) {
      navigate(`/groups/${result.id}`)
    } else {
      setError(result?.error || 'Failed to create group')
    }
  }

  return (
    <div className="page">
      <div className="form-page-header">
        <div className="form-page-icon teal">👥</div>
        <div>
          <div className="page-kicker">Admin</div>
          <h2>Create New Group</h2>
          <p className="subcopy">Set up a savings group. You'll be the admin and can invite members using the generated invite code.</p>
        </div>
      </div>

      {error && <div className="alert alert-danger"><span>⚠</span> {error}</div>}

      <form className="form-card" onSubmit={handleSubmit}>
        <div className="form-section-label">Basic Info</div>

        <div className="field-group">
          <label htmlFor="name">Group Name *</label>
          <input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Family Savings Circle"
            required
          />
        </div>

        <div className="field-group">
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description of the group's purpose..."
            rows={2}
          />
        </div>

        <div className="form-section-label">Contribution Rules</div>

        <div className="field-row-2">
          <div className="field-group">
            <label htmlFor="contribution">Contribution Amount (UGX) *</label>
            <input
              id="contribution"
              type="number"
              value={contribution}
              min={1}
              onChange={(e) => setContribution(e.target.value)}
              required
            />
          </div>
          <div className="field-group">
            <label htmlFor="frequency">Frequency</label>
            <select id="frequency" value={frequency} onChange={(e) => setFrequency(e.target.value)}>
              <option>Monthly</option>
              <option>Weekly</option>
              <option>Daily</option>
            </select>
          </div>
        </div>

        <div className="field-row-2">
          <div className="field-group">
            <label htmlFor="rotation">Rotation Order</label>
            <select id="rotation" value={rotation} onChange={(e) => setRotation(e.target.value)}>
              <option>Sequential</option>
              <option>Random</option>
            </select>
          </div>
          <div className="field-group">
            <label htmlFor="grace">Grace Period (days)</label>
            <input
              id="grace"
              type="number"
              value={grace}
              min={0}
              max={30}
              onChange={(e) => setGrace(e.target.value)}
            />
          </div>
        </div>

        <div className="field-group">
          <label htmlFor="interest">Late Interest Rate</label>
          <input
            id="interest"
            value={interest}
            onChange={(e) => setInterest(e.target.value)}
            placeholder="e.g. 3% (Flat) or 0%"
          />
        </div>

        <div className="info-notice">
          <span>ℹ</span>
          <p>An invite code will be auto-generated. Share it with members so they can join the group.</p>
        </div>

        <div className="form-actions">
          <button type="button" className="btn secondary" onClick={() => navigate('/groups')}>Cancel</button>
          <button type="submit" className="btn gold">Create Group</button>
        </div>
      </form>
    </div>
  )
}
