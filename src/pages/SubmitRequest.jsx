import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useGroups } from '../context/GroupsContext'
import { useAuth } from '../context/AuthContext'

export default function SubmitRequest() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data, submitRequest } = useGroups()
  const { user } = useAuth()

  const group = data.groups.find((g) => g.id === id)

  const [amount, setAmount] = useState(group?.contribution || '')
  const [method, setMethod] = useState('Mobile Money')
  const [note, setNote] = useState('')
  const [receiptUrl, setReceiptUrl] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (!group) return <div className="page"><div className="empty-state"><div className="empty-title">Group not found</div></div></div>

  function handleFileChange(e) {
    const file = e.target.files[0]
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setError('File is too large. Please select an image under 2MB.')
        e.target.value = ''
        return
      }
      setError('')
      const reader = new FileReader()
      reader.onloadend = () => setReceiptUrl(reader.result)
      reader.readAsDataURL(file)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!amount || Number(amount) <= 0) {
      setError('Please enter a valid amount')
      return
    }
    setError('')
    setLoading(true)
    const result = await submitRequest(id, {
      type: 'contribution',
      amount: Number(amount),
      method,
      note,
      receiptUrl,
      date,
    })
    setLoading(false)
    if (result?.success) {
      setSubmitted(true)
    } else {
      setError(result?.error || 'Failed to submit request. Please try again.')
    }
  }

  if (submitted) {
    return (
      <div className="page">
        <div className="success-state">
          <div className="success-icon">✓</div>
          <h2>Request Submitted!</h2>
          <p>Your contribution request of <strong>UGX {Number(amount).toLocaleString()}</strong> has been submitted and is awaiting admin approval.</p>
          <div className="success-actions">
            <button className="btn" onClick={() => navigate(`/groups/${id}`)}>Back to Group</button>
            <button className="btn secondary" onClick={() => { setSubmitted(false); setAmount(group.contribution); setNote('') }}>Submit Another</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="form-page-header">
        <div className="form-page-icon gold">💰</div>
        <div>
          <div className="page-kicker">Member contribution</div>
          <h2>Submit Contribution Request</h2>
          <p className="subcopy">Submit your payment details to <strong>{group.name}</strong>. The admin will review and approve your request.</p>
        </div>
      </div>

      <div className="info-notice">
        <span>ℹ</span>
        <p>Your request will be reviewed by the group admin. You will be able to see the status in the group's records once processed.</p>
      </div>

      {error && <div className="alert alert-danger"><span>⚠</span> {error}</div>}

      <form className="form-card" onSubmit={handleSubmit}>
        <div className="form-section-label">Payment Details</div>

        <div className="field-group">
          <label htmlFor="amount">Amount (UGX) *</label>
          <input
            id="amount"
            type="number"
            value={amount}
            min={1}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="e.g. 20000"
            required
          />
          <span className="field-hint">Group contribution: UGX {group.contribution.toLocaleString()} / {group.frequency}</span>
        </div>

        <div className="field-row-2">
          <div className="field-group">
            <label htmlFor="method">Payment Method *</label>
            <select id="method" value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="Mobile Money">Mobile Money (MTN / Airtel)</option>
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="Cash">Cash</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div className="field-group">
            <label htmlFor="date">Payment Date *</label>
            <input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="field-group">
          <label htmlFor="note">Note / Reference (optional)</label>
          <textarea
            id="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. MTN transaction ID: 123456789, or any notes for the admin"
            rows={3}
          />
        </div>

        <div className="field-group">
          <label htmlFor="receipt">Receipt Image (optional)</label>
          <input
            id="receipt"
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="file-input"
          />
          {receiptUrl && (
            <div style={{ marginTop: '12px' }}>
              <img src={receiptUrl} alt="Receipt preview" style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '8px', border: '1px solid var(--border)' }} />
            </div>
          )}
        </div>

        <div className="form-footer">
          <div className="submitter-info">
            <div className="submitter-avatar">{user.avatar}</div>
            <div>
              <div className="submitter-name">{user.fullName}</div>
              <div className="submitter-role">Submitting as member</div>
            </div>
          </div>
          <div className="form-actions">
            <button type="button" className="btn secondary" onClick={() => navigate(`/groups/${id}`)}>Cancel</button>
            <button type="submit" className="btn gold" disabled={loading}>
              {loading ? <span className="spinner" /> : 'Submit Request'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
