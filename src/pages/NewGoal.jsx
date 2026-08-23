import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFinance } from '../context/FinanceContext'
import { useAuth } from '../context/AuthContext'
import { useGroups } from '../context/GroupsContext'

export default function NewGoal() {
  const navigate = useNavigate()
  const { addGoal } = useFinance()
  const { user, isAdmin } = useAuth()
  const { data: groupData } = useGroups()

  const [presetTitle, setPresetTitle] = useState('')
  const [customTitle, setCustomTitle] = useState('')
  const [targetAmount, setTargetAmount] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [linkedGroupId, setLinkedGroupId] = useState('')
  const [notes, setNotes] = useState('')
  const [targetMemberId, setTargetMemberId] = useState(user?.id || '')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const myGroups = groupData.groups.filter((g) => g.members.some((m) => m.id === user?.id))
  const selectedGroup = groupData.groups.find((g) => g.id === linkedGroupId)

  const GOAL_PRESETS = [
    'Emergency Fund',
    'School Fees',
    'Business Capital',
    'House Rent / Land',
    'Asset Purchase',
    'Other'
  ]

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    const finalTitle = presetTitle === 'Other' ? customTitle : presetTitle
    if (!finalTitle) {
      setError('Please specify a goal title.')
      return
    }
    if (!linkedGroupId) {
      setError('Please select a group.')
      return
    }

    setLoading(true)
    const result = await addGoal({
      id: `goal-${Date.now().toString(36)}`,
      title: finalTitle,
      targetAmount: Number(targetAmount),
      savedAmount: 0,
      targetDate,
      linkedGroupId,
      notes,
      userId: isAdmin ? targetMemberId : undefined,
    })
    setLoading(false)
    if (result?.success) {
      navigate('/goals')
    } else {
      setError(result?.error || 'Failed to create goal')
    }
  }

  return (
    <div className="page new-goal-page">
      <div className="form-page-header">
        <div className="form-page-icon gold">◎</div>
        <div>
          <div className="page-kicker">Create goal</div>
          <h2>New Saving Goal</h2>
          <p className="subcopy">Set a target amount and track your progress. You can optionally link this to a savings group.</p>
        </div>
      </div>

      {error && <div className="alert alert-danger"><span>⚠</span> {error}</div>}

      <form className="form-card" onSubmit={handleSubmit}>
        <div className="form-section-label">Goal Details</div>

        <div className="field-group">
          <label htmlFor="linkedGroup">Select Group *</label>
          <select
            id="linkedGroup"
            value={linkedGroupId}
            onChange={(e) => setLinkedGroupId(e.target.value)}
            required
          >
            <option value="">Select a group...</option>
            {myGroups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
          <span className="field-hint">Your goal must be approved by the group admin.</span>
        </div>

        {isAdmin && selectedGroup && (
          <div className="field-group">
            <label htmlFor="targetMember">Member (Setting on behalf of) *</label>
            <select
              id="targetMember"
              value={targetMemberId}
              onChange={(e) => setTargetMemberId(e.target.value)}
              required
            >
              <option value="">Select a member...</option>
              {selectedGroup.members.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
        )}

        <div className="field-group">
          <label htmlFor="presetTitle">Goal Purpose *</label>
          <select
            id="presetTitle"
            value={presetTitle}
            onChange={(e) => setPresetTitle(e.target.value)}
            required
          >
            <option value="">Select a goal type...</option>
            {GOAL_PRESETS.map((preset) => (
              <option key={preset} value={preset}>{preset}</option>
            ))}
          </select>
        </div>

        {presetTitle === 'Other' && (
          <div className="field-group">
            <label htmlFor="customTitle">Custom Goal Title *</label>
            <input
              id="customTitle"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder="e.g. New Laptop"
              required
            />
          </div>
        )}

        <div className="field-row-2">
          <div className="field-group">
            <label htmlFor="targetAmount">Target Amount (UGX) *</label>
            <input
              id="targetAmount"
              type="number"
              min="1"
              value={targetAmount}
              onChange={(e) => setTargetAmount(e.target.value)}
              placeholder="e.g. 3000000"
              required
            />
          </div>
          <div className="field-group">
            <label htmlFor="targetDate">Target Date *</label>
            <input
              id="targetDate"
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="field-group">
          <label htmlFor="notes">Notes</label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any notes about this goal..."
            rows={3}
          />
        </div>

        <div className="form-actions" style={{ marginTop: '32px' }}>
          <button type="button" className="btn secondary" onClick={() => navigate('/goals')}>Cancel</button>
          <button type="submit" className="btn gold" disabled={loading}>
            {loading ? <span className="spinner" /> : 'Create Goal'}
          </button>
        </div>
      </form>
    </div>
  )
}
