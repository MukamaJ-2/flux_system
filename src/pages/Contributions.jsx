import React, { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { API_URL, SUPABASE_ANON_KEY } from '../config'

function currentPeriod() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
}

const STATUS_LABEL = { pending: 'Pending Review', approved: 'Approved', partial: 'Partial', rejected: 'Rejected' }
const STATUS_PILL = { pending: 'warning', approved: 'success', partial: 'warning', rejected: 'danger' }

export default function Contributions() {
  const { session, profile, hasAnyRole } = useAuth()
  const isReviewer = hasAnyRole('treasurer', 'chair')

  const [contributions, setContributions] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('Mobile Money')
  const [file, setFile] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [signedUrls, setSignedUrls] = useState({})

  function authHeaders() {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      apikey: SUPABASE_ANON_KEY,
    }
  }

  const fetchContributions = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/contributions/`, { headers: authHeaders() })
      if (res.ok) setContributions(await res.json())
    } catch (e) {
      console.error('Failed to fetch contributions', e)
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session])

  useEffect(() => {
    fetchContributions()
  }, [fetchContributions])

  const myContributions = contributions
    .filter((c) => c.memberId === profile?.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  const myTotalApproved = myContributions
    .filter((c) => c.status === 'approved' || c.status === 'partial')
    .reduce((s, c) => s + c.amountPaid, 0)
  const pendingReview = contributions.filter((c) => c.status === 'pending' && c.memberId !== profile?.id)

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitError('')
    const amountPaid = Number(amount)
    if (!amountPaid || amountPaid <= 0) {
      setSubmitError('Enter a valid amount.')
      return
    }
    setSubmitting(true)
    try {
      let proofUrl = ''
      if (file) {
        const path = `${profile.id}/${Date.now()}-${file.name}`
        const { error: uploadError } = await supabase.storage.from('proofs').upload(path, file)
        if (uploadError) throw new Error(uploadError.message)
        proofUrl = path
      }

      const res = await fetch(`${API_URL}/contributions/`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ period: currentPeriod(), amountPaid, method, proofUrl }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Failed to submit contribution.')

      setAmount('')
      setFile(null)
      setShowForm(false)
      fetchContributions()
    } catch (err) {
      setSubmitError(err.message)
    }
    setSubmitting(false)
  }

  async function handleDecide(id, approved) {
    const reason = approved ? undefined : window.prompt('Reason for rejecting this contribution:') || ''
    if (!approved && reason === null) return
    const res = await fetch(`${API_URL}/contributions/${id}/decide/`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ approved, reason }),
    })
    if (res.ok) fetchContributions()
  }

  async function viewProof(proofPath) {
    if (signedUrls[proofPath]) {
      window.open(signedUrls[proofPath], '_blank')
      return
    }
    const { data, error } = await supabase.storage.from('proofs').createSignedUrl(proofPath, 3600)
    if (!error && data?.signedUrl) {
      setSignedUrls((prev) => ({ ...prev, [proofPath]: data.signedUrl }))
      window.open(data.signedUrl, '_blank')
    }
  }

  if (loading) return <div className="page">Loading…</div>

  return (
    <div className="page">
      <div className="page-intro">
        <div className="page-intro-icon gold">💰</div>
        <div>
          <div className="page-kicker">Contributions</div>
          <h2>UGX {myTotalApproved.toLocaleString()} total</h2>
        </div>
      </div>

      <div className="page-top-row">
        <button className="btn" onClick={() => setShowForm((s) => !s)}>
          {showForm ? 'Cancel' : '+ Log Contribution'}
        </button>
      </div>

      {showForm && (
        <div className="card-box" style={{ marginTop: '16px' }}>
          <form onSubmit={handleSubmit} className="flux-form">
            {submitError && <div className="alert alert-danger"><span>⚠</span> {submitError}</div>}
            <div className="field-row-2">
              <div className="field-group">
                <label>Amount (UGX) *</label>
                <input type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} required autoFocus />
              </div>
              <div className="field-group">
                <label>Method</label>
                <select value={method} onChange={(e) => setMethod(e.target.value)}>
                  <option value="Mobile Money">Mobile Money</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Cash">Cash</option>
                </select>
              </div>
            </div>
            <div className="field-group">
              <label>Proof of Payment (optional)</label>
              <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files[0] || null)} />
            </div>
            <button type="submit" className="btn" disabled={submitting}>
              {submitting ? <span className="spinner" /> : 'Submit Contribution'}
            </button>
          </form>
        </div>
      )}

      <div className="section-block">
        <div className="section-heading"><span>Your Contributions</span></div>
        {myContributions.length === 0 ? (
          <div className="empty-state"><p>You haven't logged a contribution yet.</p></div>
        ) : (
          <div className="list-group">
            {myContributions.map((c) => (
              <div key={c.id} className="list-item">
                <div className="list-icon" style={{ background: 'var(--teal)', color: 'white' }}>💰</div>
                <div className="list-text">
                  <div>UGX {c.amountPaid.toLocaleString()} — {c.method || 'Not specified'}</div>
                  <small className="text-muted">{new Date(c.createdAt).toLocaleDateString()}</small>
                  {c.status === 'rejected' && c.rejectionReason && (
                    <div className="text-sm" style={{ color: 'var(--danger, #c0392b)' }}>{c.rejectionReason}</div>
                  )}
                </div>
                <span className={`pill ${STATUS_PILL[c.status]}`}>{STATUS_LABEL[c.status]}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {isReviewer && (
        <div className="section-block">
          <div className="section-heading"><span>Pending Review</span></div>
          {pendingReview.length === 0 ? (
            <div className="empty-state"><p>Nothing waiting on review.</p></div>
          ) : (
            <div className="request-list">
              {pendingReview.map((c) => (
                <div key={c.id} className="request-card">
                  <div className="req-header">
                    <strong>{c.period.slice(0, 7)}</strong>
                    <span className="badge warning">Needs Review</span>
                  </div>
                  <div className="req-body">
                    <div>Amount: <strong>UGX {c.amountPaid.toLocaleString()}</strong> of UGX {c.amountDue.toLocaleString()}</div>
                    <div>Method: {c.method || 'Not specified'}</div>
                  </div>
                  <div className="req-actions">
                    {c.proofUrl && (
                      <button type="button" className="btn secondary" onClick={() => viewProof(c.proofUrl)}>View Proof</button>
                    )}
                    <button type="button" className="btn danger" onClick={() => handleDecide(c.id, false)}>Reject</button>
                    <button type="button" className="btn success" onClick={() => handleDecide(c.id, true)}>Approve</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
