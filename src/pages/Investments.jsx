import React, { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { API_URL, SUPABASE_ANON_KEY } from '../config'

export default function Investments() {
  const { session } = useAuth()
  const [investments, setInvestments] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ description: '', amount: '', expectedReturn: '' })
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [returnModal, setReturnModal] = useState({ show: false, id: null, amount: '' })

  function authHeaders() {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      apikey: SUPABASE_ANON_KEY,
    }
  }

  const fetchInvestments = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/investments/`, { headers: authHeaders() })
      if (res.ok) setInvestments(await res.json())
    } catch (e) {
      console.error('Failed to fetch investments', e)
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session])

  useEffect(() => {
    fetchInvestments()
  }, [fetchInvestments])

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitError('')
    const amount = Number(form.amount)
    if (!form.description.trim() || !amount || amount <= 0) {
      setSubmitError('Enter a description and a valid amount.')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`${API_URL}/investments/`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          description: form.description,
          amount,
          expectedReturn: form.expectedReturn ? Number(form.expectedReturn) : null,
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Failed to log investment.')
      setForm({ description: '', amount: '', expectedReturn: '' })
      setShowForm(false)
      fetchInvestments()
    } catch (err) {
      setSubmitError(err.message)
    }
    setSubmitting(false)
  }

  async function handleRecordReturn(e) {
    e.preventDefault()
    const actualReturn = Number(returnModal.amount)
    if (isNaN(actualReturn) || actualReturn < 0) return
    const res = await fetch(`${API_URL}/investments/${returnModal.id}/return/`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ actualReturn }),
    })
    if (res.ok) {
      setReturnModal({ show: false, id: null, amount: '' })
      fetchInvestments()
    }
  }

  if (loading) return <div className="page">Loading…</div>

  const totalActive = investments.filter((i) => i.status === 'active').reduce((s, i) => s + i.amount, 0)
  const totalProfit = investments
    .filter((i) => i.status === 'returned')
    .reduce((s, i) => s + (i.actualReturn - i.amount), 0)

  return (
    <div className="page">
      <div className="page-intro">
        <div className="page-intro-icon gold">📈</div>
        <div>
          <div className="page-kicker">Treasurer / Chair</div>
          <h2>Investments</h2>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-tile teal">
          <div className="stat-value">UGX {totalActive.toLocaleString()}</div>
          <div className="stat-label">Currently Invested</div>
        </div>
        <div className="stat-tile gold">
          <div className="stat-value">UGX {totalProfit.toLocaleString()}</div>
          <div className="stat-label">Realized Profit/Loss</div>
        </div>
      </div>

      <div className="page-top-row">
        <button className="btn" onClick={() => setShowForm((s) => !s)}>
          {showForm ? 'Cancel' : '+ Log Investment'}
        </button>
      </div>

      {showForm && (
        <div className="card-box" style={{ marginTop: '16px' }}>
          <form onSubmit={handleSubmit} className="flux-form">
            {submitError && <div className="alert alert-danger"><span>⚠</span> {submitError}</div>}
            <div className="field-group">
              <label>Description *</label>
              <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="e.g. Poultry stock purchase" required autoFocus />
            </div>
            <div className="field-row-2">
              <div className="field-group">
                <label>Amount Invested (UGX) *</label>
                <input type="number" min="1" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
              </div>
              <div className="field-group">
                <label>Expected Return (optional)</label>
                <input type="number" min="0" value={form.expectedReturn} onChange={(e) => setForm({ ...form, expectedReturn: e.target.value })} />
              </div>
            </div>
            <button type="submit" className="btn" disabled={submitting}>
              {submitting ? <span className="spinner" /> : 'Log Investment'}
            </button>
          </form>
        </div>
      )}

      <div className="section-block">
        <div className="section-heading"><span>All Investments</span></div>
        {investments.length === 0 ? (
          <div className="empty-state"><p>No investments logged yet.</p></div>
        ) : (
          <div className="request-list">
            {investments.map((i) => (
              <div key={i.id} className="request-card">
                <div className="req-header">
                  <strong>{i.description}</strong>
                  <span className={`pill ${i.status === 'returned' ? 'success' : 'warning'}`}>{i.status === 'returned' ? 'Returned' : 'Active'}</span>
                </div>
                <div className="req-body">
                  <div>Invested: <strong>UGX {i.amount.toLocaleString()}</strong> on {new Date(i.investedAt).toLocaleDateString()}</div>
                  {i.expectedReturn != null && <div>Expected Return: UGX {i.expectedReturn.toLocaleString()}</div>}
                  {i.status === 'returned' && (
                    <div>
                      Actual Return: <strong>UGX {i.actualReturn.toLocaleString()}</strong>
                      {' '}({i.actualReturn - i.amount >= 0 ? '+' : ''}{(i.actualReturn - i.amount).toLocaleString()})
                    </div>
                  )}
                </div>
                {i.status === 'active' && (
                  <div className="req-actions">
                    <button className="btn" onClick={() => setReturnModal({ show: true, id: i.id, amount: '' })}>Record Return</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {returnModal.show && (
        <div className="modal-overlay" onClick={() => setReturnModal({ show: false, id: null, amount: '' })}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Record Return</h3>
            <form onSubmit={handleRecordReturn} className="flux-form">
              <div className="field-group">
                <label>Actual Amount Returned (UGX)</label>
                <input type="number" min="0" value={returnModal.amount} onChange={(e) => setReturnModal({ ...returnModal, amount: e.target.value })} required autoFocus />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn secondary" onClick={() => setReturnModal({ show: false, id: null, amount: '' })}>Cancel</button>
                <button type="submit" className="btn primary">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
