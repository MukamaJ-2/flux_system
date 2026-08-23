import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useGroups, isGroupAdmin } from '../context/GroupsContext'
import { useAuth } from '../context/AuthContext'

export default function RecordContribution() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data, recordContribution } = useGroups()
  const { user, hasAnyRole } = useAuth()
  const group = data.groups.find((g) => g.id === id)
  const canRecord = isGroupAdmin(group, user) || hasAnyRole('sysadmin', 'chair', 'treasury', 'secretary', 'audit')

  const [memberId, setMemberId] = useState(group?.members.find((m) => m.role !== 'admin')?.id || group?.members[0]?.id || '')
  const [amount, setAmount] = useState(group?.contribution || '')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [method, setMethod] = useState('Mobile Money')
  const [note, setNote] = useState('')
  const [receiptUrl, setReceiptUrl] = useState('')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  if (!group) return <div className="page"><div className="empty-title">Group not found</div></div>
  if (!canRecord) return (
    <div className="page">
      <div className="empty-state">
        <div className="empty-icon">⚠</div>
        <div className="empty-title">Not Authorized</div>
        <p className="empty-copy">Only the group admin or a finance role can record contributions directly.</p>
        <button className="btn" onClick={() => navigate(`/groups/${id}`)}>Back to Group</button>
      </div>
    </div>
  )

  const selectedMember = group.members.find((m) => m.id === memberId)

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

  async function handleRecord(e) {
    e.preventDefault()
    if (!memberId) { setError('Please select a member'); return }
    if (!amount || Number(amount) <= 0) { setError('Enter a valid amount'); return }
    const result = await recordContribution(id, {
      memberId,
      amount: Number(amount),
      method,
      note,
      receiptUrl,
    })
    if (result?.success) {
      setSaved(true)
    } else {
      setError(result?.error || 'Failed to record contribution')
    }
  }

  if (saved) {
    return (
      <div className="page">
        <div className="success-state">
          <div className="success-icon">✓</div>
          <h2>Contribution Recorded!</h2>
          <p>UGX <strong>{Number(amount).toLocaleString()}</strong> for <strong>{selectedMember?.name}</strong> has been recorded.</p>
          <div className="success-actions">
            <button className="btn" onClick={() => navigate(`/groups/${id}/records`)}>View Records</button>
            <button className="btn secondary" onClick={() => { setSaved(false); setNote('') }}>Record Another</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="form-page-header">
        <div className="form-page-icon gold">✏</div>
        <div>
          <div className="page-kicker">Admin · {group.name}</div>
          <h2>Record Contribution</h2>
          <p className="subcopy">Directly record a confirmed contribution. This bypasses the request queue and immediately adds to records.</p>
        </div>
      </div>

      {error && <div className="alert alert-danger"><span>⚠</span> {error}</div>}

      <form className="form-card" onSubmit={handleRecord}>
        <div className="form-section-label">Contribution Details</div>

        <div className="field-row-2">
          <div className="field-group">
            <label htmlFor="member">Member *</label>
            <select id="member" value={memberId} onChange={(e) => setMemberId(e.target.value)} required>
              <option value="">Select member...</option>
              {group.members.map((m) => (
                <option key={m.id} value={m.id}>{m.name} ({m.role})</option>
              ))}
            </select>
          </div>
          <div className="field-group">
            <label htmlFor="amount">Amount (UGX) *</label>
            <input
              id="amount"
              type="number"
              value={amount}
              min={1}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`Standard: ${group.contribution.toLocaleString()}`}
              required
            />
          </div>
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
          <label htmlFor="note">Note (optional)</label>
          <textarea
            id="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Transaction reference, remarks, etc."
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
          <div className="admin-record-note">
            <span>⚙</span>
            <span>Recording as admin — this goes directly to records without a request.</span>
          </div>
          <div className="form-actions">
            <button type="button" className="btn secondary" onClick={() => navigate(`/groups/${id}`)}>Cancel</button>
            <button type="submit" className="btn">Record Contribution</button>
          </div>
        </div>
      </form>
    </div>
  )
}
