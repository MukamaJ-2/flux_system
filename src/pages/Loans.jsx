import React, { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { API_URL, SUPABASE_ANON_KEY } from '../config'

const STATUS_LABEL = {
  requested: 'Awaiting 1st Approval',
  pending_second_approval: 'Awaiting 2nd Approval',
  approved: 'Approved',
  active: 'Active',
  rejected: 'Rejected',
  repaid: 'Repaid',
  defaulted: 'Defaulted',
}
const STATUS_PILL = {
  requested: 'warning',
  pending_second_approval: 'warning',
  approved: 'success',
  active: 'success',
  rejected: 'danger',
  repaid: 'success',
  defaulted: 'danger',
}
const DECIDABLE = ['requested', 'pending_second_approval']

function totalPayable(loan) {
  return loan.principal + (loan.principal * loan.interestRate) / 100
}

export default function Loans() {
  const { session, profile, hasAnyRole } = useAuth()
  const isReviewer = hasAnyRole('treasurer', 'chair')

  const [loans, setLoans] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ principal: '', reason: '', installments: 1, dueDate: '' })
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [repayModal, setRepayModal] = useState({ show: false, loanId: null, amount: '' })

  function authHeaders() {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      apikey: SUPABASE_ANON_KEY,
    }
  }

  const fetchLoans = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/loans/`, { headers: authHeaders() })
      if (res.ok) setLoans(await res.json())
    } catch (e) {
      console.error('Failed to fetch loans', e)
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session])

  useEffect(() => {
    fetchLoans()
  }, [fetchLoans])

  const myLoans = loans.filter((l) => l.borrowerId === profile?.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  const pendingDecision = loans.filter((l) => DECIDABLE.includes(l.status) && l.borrowerId !== profile?.id)

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitError('')
    const principal = Number(form.principal)
    if (!principal || principal <= 0) {
      setSubmitError('Enter a valid amount.')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`${API_URL}/loans/`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          principal,
          reason: form.reason,
          installments: Number(form.installments) || 1,
          dueDate: form.dueDate || null,
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Failed to request loan.')
      setForm({ principal: '', reason: '', installments: 1, dueDate: '' })
      setShowForm(false)
      fetchLoans()
    } catch (err) {
      setSubmitError(err.message)
    }
    setSubmitting(false)
  }

  async function handleDecide(id, approved) {
    const res = await fetch(`${API_URL}/loans/${id}/decide/`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ approved }),
    })
    if (res.ok) fetchLoans()
    else {
      const body = await res.json().catch(() => ({}))
      window.alert(body.error || 'Failed to decide loan.')
    }
  }

  async function handleRepay(e) {
    e.preventDefault()
    const amount = Number(repayModal.amount)
    if (!amount || amount <= 0) return
    const res = await fetch(`${API_URL}/loans/${repayModal.loanId}/repay/`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ amount }),
    })
    if (res.ok) {
      setRepayModal({ show: false, loanId: null, amount: '' })
      fetchLoans()
    }
  }

  if (loading) return <div className="page">Loading…</div>

  return (
    <div className="page">
      <div className="page-intro">
        <div className="page-intro-icon blue">¤</div>
        <div>
          <div className="page-kicker">Loans</div>
          <h2>Borrow from the group fund</h2>
        </div>
      </div>

      <div className="page-top-row">
        <button className="btn" onClick={() => setShowForm((s) => !s)}>
          {showForm ? 'Cancel' : '+ Request Loan'}
        </button>
      </div>

      {showForm && (
        <div className="card-box" style={{ marginTop: '16px' }}>
          <form onSubmit={handleSubmit} className="flux-form">
            {submitError && <div className="alert alert-danger"><span>⚠</span> {submitError}</div>}
            <div className="field-row-2">
              <div className="field-group">
                <label>Amount (UGX) *</label>
                <input type="number" min="1" value={form.principal} onChange={(e) => setForm({ ...form, principal: e.target.value })} required autoFocus />
              </div>
              <div className="field-group">
                <label>Installments</label>
                <input type="number" min="1" value={form.installments} onChange={(e) => setForm({ ...form, installments: e.target.value })} />
              </div>
            </div>
            <div className="field-group">
              <label>Reason</label>
              <textarea rows={3} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
            </div>
            <div className="field-group">
              <label>Due Date</label>
              <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
            </div>
            <button type="submit" className="btn" disabled={submitting}>
              {submitting ? <span className="spinner" /> : 'Submit Request'}
            </button>
          </form>
        </div>
      )}

      <div className="section-block">
        <div className="section-heading"><span>Your Loans</span></div>
        {myLoans.length === 0 ? (
          <div className="empty-state"><p>No loans requested yet.</p></div>
        ) : (
          <div className="records-list">
            {myLoans.map((l) => (
              <div key={l.id} className="record-card" style={{ display: 'block' }}>
                <div className="headline" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div>
                    <div className="amount" style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>UGX {l.principal.toLocaleString()}</div>
                    <div className="muted" style={{ fontSize: '0.85rem' }}>{l.reason || 'No reason given'}</div>
                  </div>
                  <span className={`pill ${STATUS_PILL[l.status]}`}>{STATUS_LABEL[l.status]}</span>
                </div>
                <div className="text-sm text-muted">
                  Owes UGX {totalPayable(l).toLocaleString()} ({l.interestRate}% interest, {l.installments} installments)
                </div>
                {l.status === 'active' && (
                  <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
                    <button className="btn sm" onClick={() => setRepayModal({ show: true, loanId: l.id, amount: '' })}>Repay</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {isReviewer && (
        <div className="section-block">
          <div className="section-heading"><span>Pending Decisions</span></div>
          {pendingDecision.length === 0 ? (
            <div className="empty-state"><p>Nothing waiting on a decision.</p></div>
          ) : (
            <div className="request-list">
              {pendingDecision.map((l) => (
                <div key={l.id} className="request-card">
                  <div className="req-header">
                    <strong>UGX {l.principal.toLocaleString()}</strong>
                    <span className="badge warning">{STATUS_LABEL[l.status]}</span>
                  </div>
                  <div className="req-body">
                    <div>{l.reason || 'No reason given'}</div>
                    <div className="text-sm text-muted">{l.installments} installments, due {l.dueDate ? new Date(l.dueDate).toLocaleDateString() : 'not set'}</div>
                  </div>
                  <div className="req-actions">
                    <button className="btn danger" onClick={() => handleDecide(l.id, false)}>Reject</button>
                    <button className="btn success" onClick={() => handleDecide(l.id, true)}>Approve</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {repayModal.show && (
        <div className="modal-overlay" onClick={() => setRepayModal({ show: false, loanId: null, amount: '' })}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Repay Loan</h3>
            <form onSubmit={handleRepay} className="flux-form">
              <div className="field-group">
                <label>Amount (UGX)</label>
                <input type="number" min="1" value={repayModal.amount} onChange={(e) => setRepayModal({ ...repayModal, amount: e.target.value })} required autoFocus />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn secondary" onClick={() => setRepayModal({ show: false, loanId: null, amount: '' })}>Cancel</button>
                <button type="submit" className="btn primary">Confirm</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
