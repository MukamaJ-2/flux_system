import React, { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { API_URL, SUPABASE_ANON_KEY } from '../config'

function downloadCsv(rows, headers, filename) {
  const csv = [headers, ...rows].map((row) => row.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function Audit() {
  const { session } = useAuth()
  const [auditLog, setAuditLog] = useState([])
  const [ledger, setLedger] = useState([])
  const [loading, setLoading] = useState(true)

  function authHeaders() {
    return { Authorization: `Bearer ${session.access_token}`, apikey: SUPABASE_ANON_KEY }
  }

  const fetchData = useCallback(async () => {
    try {
      const [logRes, ledgerRes] = await Promise.all([
        fetch(`${API_URL}/audit-log/`, { headers: authHeaders() }),
        fetch(`${API_URL}/ledger/`, { headers: authHeaders() }),
      ])
      if (logRes.ok) setAuditLog(await logRes.json())
      if (ledgerRes.ok) setLedger(await ledgerRes.json())
    } catch (e) {
      console.error('Failed to fetch audit data', e)
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  function exportLedger() {
    downloadCsv(
      ledger.map((e) => [e.createdAt, e.entryType, e.direction, e.amount, e.memberId || '', e.note || '']),
      ['Date', 'Type', 'Direction', 'Amount', 'MemberId', 'Note'],
      `flux-ledger-${new Date().toISOString().slice(0, 10)}.csv`,
    )
  }

  if (loading) return <div className="page">Loading…</div>

  return (
    <div className="page">
      <div className="page-intro">
        <div className="page-intro-icon teal">🔍</div>
        <div>
          <div className="page-kicker">Audit</div>
          <h2>Integrity & Activity Log</h2>
        </div>
      </div>

      <div className="page-top-row">
        <button className="btn secondary" onClick={exportLedger}>Export Full Ledger (CSV)</button>
      </div>

      <div className="section-block">
        <div className="section-heading"><span>Ledger — All Entries ({ledger.length})</span></div>
        {ledger.length === 0 ? (
          <div className="empty-state"><p>No transactions yet.</p></div>
        ) : (
          <div className="list-group">
            {ledger.slice(0, 30).map((e) => (
              <div key={e.id} className="list-item">
                <div className="list-icon" style={{ background: e.direction === 'credit' ? 'var(--green)' : 'var(--red)', color: 'white' }}>
                  {e.direction === 'credit' ? '+' : '−'}
                </div>
                <div className="list-text">
                  <div>{e.entryType.replace('_', ' ')} — UGX {e.amount.toLocaleString()}</div>
                  <small className="text-muted">{new Date(e.createdAt).toLocaleString()} {e.note && `— ${e.note}`}</small>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="section-block">
        <div className="section-heading"><span>Audit Log — Who Did What ({auditLog.length})</span></div>
        {auditLog.length === 0 ? (
          <div className="empty-state"><p>No actions logged yet.</p></div>
        ) : (
          <div className="list-group">
            {auditLog.slice(0, 30).map((a) => (
              <div key={a.id} className="list-item">
                <div className="list-icon" style={{ background: 'var(--blue)', color: 'white' }}>≡</div>
                <div className="list-text">
                  <div>{a.action.replace(/_/g, ' ')} — {a.target_table}</div>
                  <small className="text-muted">{new Date(a.created_at).toLocaleString()}</small>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
