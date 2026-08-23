import React, { useState, useEffect, useCallback } from 'react'
import { useGroups } from '../context/GroupsContext'
import { useFinance } from '../context/FinanceContext'
import { useAuth } from '../context/AuthContext'
import { API_URL, SUPABASE_ANON_KEY } from '../config'
import GroupSwitcher from '../components/GroupSwitcher'
import { downloadRecordsCsv } from '../utils/csv'

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('flux_access_token')}`,
    apikey: SUPABASE_ANON_KEY,
  }
}

export default function AuditDashboard() {
  const { data, progressWorkflow } = useGroups()
  const { finance, advanceLoan } = useFinance()
  const { user } = useAuth()

  const [verifying, setVerifying] = useState(false)
  const [verificationResult, setVerificationResult] = useState(null)
  const [auditLogs, setAuditLogs] = useState([])
  const [showLedger, setShowLedger] = useState(false)
  const [activeGroupId, setActiveGroupId] = useState(null)

  const mainGroup = data.groups.find((g) => g.id === activeGroupId) || data.groups[0]

  const fetchAuditLogs = useCallback(async () => {
    if (!mainGroup) return
    try {
      const res = await fetch(`${API_URL}/audit-logs/?group=${mainGroup.id}`, { headers: authHeaders() })
      if (res.ok) setAuditLogs(await res.json())
    } catch (e) {
      console.error('Failed to fetch audit logs', e)
    }
  }, [mainGroup?.id])

  useEffect(() => {
    fetchAuditLogs()
  }, [fetchAuditLogs])

  if (!mainGroup) {
    return (
      <div className="page dashboard-page">
        <div className="empty-state"><p>Join or create a group to use the Audit panel.</p></div>
      </div>
    )
  }

  const groupLoans = finance.loans.filter((l) => (l.groupId || l.group) === mainGroup.id)
  const pendingAudit = groupLoans.filter((l) => l.status === 'pending_audit')
  const pendingInvestments = (mainGroup.requests || []).filter(
    (r) => r.type === 'investment' && r.status === 'pending_audit',
  )

  const handleApproveLoan = async (loanId) => {
    await advanceLoan(loanId, true)
  }

  const rejectLoan = async (loanId) => {
    await advanceLoan(loanId, false)
  }

  const handleApproveInvestment = async (reqId) => {
    await progressWorkflow(mainGroup.id, reqId, null, user.fullName, true)
  }

  const rejectInvestment = async (reqId) => {
    await progressWorkflow(mainGroup.id, reqId, null, user.fullName, false)
  }

  const runHashVerification = async () => {
    setVerifying(true)
    setVerificationResult(null)
    try {
      const res = await fetch(`${API_URL}/audit-logs/`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ groupId: mainGroup.id }),
      })
      if (res.ok) {
        const result = await res.json()
        setVerificationResult(result)
        fetchAuditLogs()
      }
    } catch (e) {
      console.error('Verification failed', e)
    }
    setVerifying(false)
  }

  const exportReport = () => {
    downloadRecordsCsv(mainGroup.records || [], `audit-report-${mainGroup.name}-${new Date().toISOString().slice(0, 10)}.csv`)
  }

  return (
    <div className="page dashboard-page">
      <header className="page-header">
        <h1>Audit Dashboard</h1>
        <p>Verify eligibility, clear audit checks, and maintain the record trail.</p>
      </header>

      <GroupSwitcher groups={data.groups} activeGroupId={mainGroup.id} onChange={setActiveGroupId} />

      <div className="dashboard-grid">
        <div className="section-block">
          <div className="section-heading"><span>Loan Eligibility Verify</span></div>
          {pendingAudit.length === 0 ? (
            <div className="empty-state"><p>No loans pending audit clearance.</p></div>
          ) : (
            <div className="request-list">
              {pendingAudit.map((loan) => (
                <div key={loan.id} className="request-card">
                  <div className="req-header">
                    <strong>{loan.requesterName}</strong>
                    <span className="badge warning">Needs Audit</span>
                  </div>
                  <div className="req-body">
                    <div>Amount: <strong>UGX {loan.amount?.toLocaleString()}</strong></div>
                    <div><small className="text-muted">Cleared by Treasury</small></div>
                  </div>
                  <div className="req-actions">
                    <button className="btn success" onClick={() => handleApproveLoan(loan.id)}>Verify Eligibility</button>
                    <button className="btn danger" onClick={() => rejectLoan(loan.id)}>Flag Discrepancy</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="section-block">
          <div className="section-heading"><span>Investment Clearance</span></div>
          {pendingInvestments.length === 0 ? (
            <div className="empty-state"><p>No investments pending audit clearance.</p></div>
          ) : (
            <div className="request-list">
              {pendingInvestments.map((req) => (
                <div key={req.id} className="request-card">
                  <div className="req-header">
                    <strong>{req.title}</strong>
                    <span className="badge warning">Needs Audit</span>
                  </div>
                  <div className="req-body">
                    <div>Amount: <strong>UGX {req.amount?.toLocaleString()}</strong></div>
                    <div><small className="text-muted">Member vote cleared</small></div>
                  </div>
                  <div className="req-actions">
                    <button className="btn success" onClick={() => handleApproveInvestment(req.id)}>Clear Investment</button>
                    <button className="btn danger" onClick={() => rejectInvestment(req.id)}>Flag Discrepancy</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="section-block">
          <div className="section-heading"><span>System Integrity</span></div>
          <div className="card-box">
            <p>Cryptographic hash-chain verifier. Run nightly, or manually verify now.</p>
            <button className="btn primary full" onClick={runHashVerification} disabled={verifying}>
              {verifying ? 'Running Cryptographic Verification...' : 'Run Hash-chain Verification'}
            </button>
            {verificationResult && (
              <div className="alert-card mt-1" style={{ background: '#e6fffa', border: '1px solid #38b2ac' }}>
                <div className="alert-icon" style={{ background: '#38b2ac' }}>✓</div>
                <div className="alert-body">
                  <div className="alert-title" style={{ color: '#234e52' }}>Verification Passed</div>
                  <p className="alert-msg" style={{ color: '#285e61' }}>
                    {verificationResult.recordCount} ledger entries verified. No tampering detected.
                  </p>
                </div>
              </div>
            )}

            {auditLogs.length > 0 && (
              <div className="list-group mt-1">
                {auditLogs.slice(0, 3).map((log) => (
                  <div key={log.id} className="list-item">
                    <div className="list-icon" style={{ background: 'var(--green)', color: 'white' }}>✓</div>
                    <div className="list-text">
                      <div><strong>{log.recordCount} records verified</strong></div>
                      <small className="text-muted">By {log.auditor} - {new Date(log.createdAt).toLocaleDateString()}</small>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="req-actions mt-1">
              <button className="btn secondary full" onClick={exportReport}>Export Audit Report (CSV)</button>
              <button className="btn secondary full" onClick={() => setShowLedger(!showLedger)}>
                {showLedger ? 'Hide' : 'View'} Read-only Financials
              </button>
            </div>

            {showLedger && (
              <div className="list-group mt-1">
                {(mainGroup.records || []).map((r) => (
                  <div key={r.id} className="list-item">
                    <div className="list-icon" style={{ background: 'var(--blue)', color: 'white' }}>$</div>
                    <div className="list-text">
                      <div><strong>{r.memberName}</strong> - UGX {r.amount?.toLocaleString()}</div>
                      <small className="text-muted">{r.method} - {new Date(r.date).toLocaleDateString()}</small>
                    </div>
                  </div>
                ))}
                {(mainGroup.records || []).length === 0 && (
                  <div className="empty-state"><p>No financial records yet.</p></div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
