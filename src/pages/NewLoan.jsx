import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFinance } from '../context/FinanceContext'
import { useAuth } from '../context/AuthContext'
import { useGroups } from '../context/GroupsContext'

export default function NewLoan() {
  const navigate = useNavigate()
  const { addLoan } = useFinance()
  const { user, isAdmin } = useAuth()
  const { data: groupData } = useGroups()

  const myGroups = groupData.groups.filter((g) => g.members.some((m) => m.id === user?.id))

  const [presetTitle, setPresetTitle] = useState('')
  const [customTitle, setCustomTitle] = useState('')
  const [groupId, setGroupId] = useState(myGroups[0]?.id || '')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [installments, setInstallments] = useState(4)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const selectedGroup = groupData.groups.find(g => g.id === groupId)

  const LOAN_PRESETS = [
    'Emergency Medical Funds',
    'School Fees',
    'Business Capital / Inventory',
    'Asset Purchase',
    'House Construction / Rent',
    'Other'
  ]

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    if (!groupId) {
      setError('You must select a group to request a loan from.')
      return
    }

    const finalTitle = presetTitle === 'Other' ? customTitle : presetTitle
    if (!finalTitle) {
      setError('Please specify a loan title.')
      return
    }

    setLoading(true)
    const result = await addLoan({
      id: `loan-${Date.now().toString(36)}`,
      title: finalTitle,
      groupId,
      amount: Number(amount),
      interestRate: parseInt(selectedGroup?.rules?.interest) || 10,
      type: 'Flat Rate',
      installments: Number(installments),
      frequency: selectedGroup?.frequency || 'Monthly',
      startDate: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
      reason,
    })
    setLoading(false)
    if (result?.success) {
      navigate('/loans')
    } else {
      setError(result?.error || 'Failed to submit loan request')
    }
  }

  if (myGroups.length === 0) {
    return (
      <div className="page">
        <div className="empty-state">
          <div className="empty-icon">¤</div>
          <div className="empty-title">Cannot Request Loan</div>
          <p className="empty-copy">You need to join a group before you can request a loan.</p>
          <button className="btn" onClick={() => navigate('/join')}>Join Group</button>
        </div>
      </div>
    )
  }

  return (
    <div className="page new-loan-page">
      <div className="form-page-header">
        <div className="form-page-icon gold">↗</div>
        <div>
          <div className="page-kicker">Request loan</div>
          <h2>Request a Loan</h2>
          <p className="subcopy">Submit a loan request to one of your groups. The group admin will review your request.</p>
        </div>
      </div>

      <div className="info-notice">
        <span>ℹ</span>
        <p>Your loan request will be marked as "pending" until reviewed. Interest rates and frequencies are determined by the group's rules.</p>
      </div>

      {error && <div className="alert alert-danger"><span>⚠</span> {error}</div>}

      <form className="form-card" onSubmit={handleSubmit}>
        <div className="form-section-label">Loan Details</div>
        
        <div className="field-group">
          <label htmlFor="group">Select Group *</label>
          <select id="group" value={groupId} onChange={(e) => setGroupId(e.target.value)} required>
            {myGroups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>


        <div className="field-group">
          <label htmlFor="presetTitle">Loan Purpose *</label>
          <select
            id="presetTitle"
            value={presetTitle}
            onChange={(e) => setPresetTitle(e.target.value)}
            required
          >
            <option value="">Select a loan purpose...</option>
            {LOAN_PRESETS.map((preset) => (
              <option key={preset} value={preset}>{preset}</option>
            ))}
          </select>
        </div>

        {presetTitle === 'Other' && (
          <div className="field-group">
            <label htmlFor="customTitle">Custom Loan Title *</label>
            <input
              id="customTitle"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder="e.g. Emergency Medical Funds"
              required
            />
          </div>
        )}
        
        <div className="field-row-2">
          <div className="field-group">
            <label htmlFor="amount">Loan Amount (UGX) *</label>
            <input
              id="amount"
              type="number"
              min="1"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="e.g. 500000"
              required
            />
          </div>
        </div>

        <div className="form-section-label">Terms</div>
        
        <div className="field-row-2">
          <div className="field-group">
            <label>Group Interest Rate</label>
            <input value={selectedGroup?.rules?.interest || 'N/A'} readOnly className="read-only" style={{ background: 'rgba(0,0,0,0.02)' }} />
          </div>
          <div className="field-group">
            <label>Frequency</label>
            <input value={selectedGroup?.frequency || 'N/A'} readOnly className="read-only" style={{ background: 'rgba(0,0,0,0.02)' }} />
          </div>
        </div>
        
        <div className="field-row-2">
          <div className="field-group">
            <label htmlFor="installments">Number of Installments *</label>
            <input
              id="installments"
              type="number"
              min="1"
              max="24"
              value={installments}
              onChange={(e) => setInstallments(e.target.value)}
              required
            />
          </div>
          <div className="field-group">
            <label>Expected Start</label>
            <input value={new Date().toLocaleDateString()} readOnly className="read-only" style={{ background: 'rgba(0,0,0,0.02)' }} />
          </div>
        </div>
        
        <div className="field-group">
          <label htmlFor="reason">Reason (Optional)</label>
          <textarea
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why do you need this loan? Any context for the admin."
            rows={3}
          />
        </div>
        
        <div className="form-actions" style={{ marginTop: '32px' }}>
          <button type="button" className="btn secondary" onClick={() => navigate('/loans')}>Cancel</button>
          <button type="submit" className="btn gold">Submit Loan Request</button>
        </div>
      </form>
    </div>
  )
}
