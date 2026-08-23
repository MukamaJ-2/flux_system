import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGroups } from '../context/GroupsContext'
import { useFinance } from '../context/FinanceContext'
import { useAuth } from '../context/AuthContext'
import { API_URL, SUPABASE_ANON_KEY } from '../config'
import GroupSwitcher from '../components/GroupSwitcher'
import ConfirmAction from '../components/ConfirmAction'

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('flux_access_token')}`,
    apikey: SUPABASE_ANON_KEY,
  }
}

export default function ChairDashboard() {
  const { data, progressWorkflow, removeMember } = useGroups()
  const { finance, advanceLoan } = useFinance()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [confirmModal, setConfirmModal] = useState({ show: false, action: null, title: '', message: '', confirmLabel: '' })
  const [analytics, setAnalytics] = useState(null)
  const [showAnalytics, setShowAnalytics] = useState(false)
  const [activeGroupId, setActiveGroupId] = useState(null)
  const [issues, setIssues] = useState([])

  const mainGroup = data.groups.find((g) => g.id === activeGroupId) || data.groups[0]

  const fetchAnalytics = useCallback(async () => {
    if (!mainGroup) return
    try {
      const res = await fetch(`${API_URL}/analytics/?group=${mainGroup.id}`, { headers: authHeaders() })
      if (res.ok) setAnalytics(await res.json())
    } catch (e) {
      console.error('Failed to fetch analytics', e)
    }
  }, [mainGroup?.id])

  const fetchIssues = useCallback(async () => {
    if (!mainGroup) return
    try {
      const res = await fetch(`${API_URL}/issues/?group=${mainGroup.id}`, { headers: authHeaders() })
      if (res.ok) setIssues(await res.json())
    } catch (e) {
      console.error('Failed to fetch issues', e)
    }
  }, [mainGroup?.id])

  useEffect(() => {
    fetchIssues()
  }, [fetchIssues])

  if (!mainGroup) {
    return (
      <div className="page dashboard-page">
        <div className="empty-state"><p>Join or create a group to use the Chair panel.</p></div>
      </div>
    )
  }

  const groupLoans = finance.loans.filter((l) => (l.groupId || l.group) === mainGroup.id)
  const pendingLoans = groupLoans.filter((l) => l.status === 'pending_chair')
  const pendingInvestments = (mainGroup.requests || []).filter(
    (r) => r.type === 'investment' && r.status === 'pending_chair',
  )
  const openIssues = issues.filter((i) => i.status !== 'resolved')

  const openConfirm = (title, message, confirmLabel, action, payload) => {
    setConfirmModal({ show: true, title, message, confirmLabel, action: () => action(payload) })
  }

  const closeConfirm = () => setConfirmModal({ show: false, action: null, title: '', message: '', confirmLabel: '' })

  const handleConfirm = async () => {
    if (confirmModal.action) await confirmModal.action()
    closeConfirm()
  }

  const approveLoan = async (loanId) => {
    await advanceLoan(loanId, true)
  }

  const vetoLoan = async (loanId) => {
    await advanceLoan(loanId, false)
  }

  const approveInvestment = async (reqId) => {
    await progressWorkflow(mainGroup.id, reqId, null, user.fullName, true)
  }

  const vetoInvestment = async (reqId) => {
    await progressWorkflow(mainGroup.id, reqId, null, user.fullName, false)
  }

  const handleShowAnalytics = async () => {
    await fetchAnalytics()
    setShowAnalytics(true)
  }

  const handleResolveIssue = async (id) => {
    const res = await fetch(`${API_URL}/issues/${id}/`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ status: 'resolved' }),
    })
    if (res.ok) {
      const updated = await res.json()
      setIssues((prev) => prev.map((i) => (i.id === id ? updated : i)))
    }
  }

  return (
    <div className="page dashboard-page">
      <header className="page-header">
        <h1>Chair Dashboard</h1>
        <p>Review the final workflow approvals, manage members, and close the approval chain.</p>
      </header>

      <GroupSwitcher groups={data.groups} activeGroupId={mainGroup.id} onChange={setActiveGroupId} />

      <div className="dashboard-grid">
        <div className="section-block">
          <div className="section-heading"><span>Final Loan Sign-off</span></div>
          {pendingLoans.length === 0 ? (
            <div className="empty-state"><p>No loans pending chair approval.</p></div>
          ) : (
            <div className="request-list">
              {pendingLoans.map((loan) => (
                <div key={loan.id} className="request-card">
                  <div className="req-header">
                    <strong>{loan.requesterName}</strong>
                    <span className="badge warning">Needs Sign-off</span>
                  </div>
                  <div className="req-body">
                    <div>Amount: <strong>UGX {loan.amount?.toLocaleString()}</strong></div>
                    <div><small className="text-muted">Cleared by Secretary, Treasury, and Audit</small></div>
                  </div>
                  <div className="req-actions">
                    <button className="btn primary" onClick={() => openConfirm('Sign-off Loan', `Give final approval for a UGX ${loan.amount?.toLocaleString()} loan to ${loan.requesterName}?`, 'Confirm Sign-off', approveLoan, loan.id)}>
                      Final Sign-off
                    </button>
                    <button className="btn danger" onClick={() => vetoLoan(loan.id)}>Veto</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="section-block">
          <div className="section-heading"><span>Approve Investments</span></div>
          {pendingInvestments.length === 0 ? (
            <div className="empty-state"><p>No investments pending chair approval.</p></div>
          ) : (
            <div className="request-list">
              {pendingInvestments.map((req) => (
                <div key={req.id} className="request-card">
                  <div className="req-header">
                    <strong>{req.title}</strong>
                    <span className="badge warning">Needs Sign-off</span>
                  </div>
                  <div className="req-body">
                    <div>Amount: <strong>UGX {req.amount?.toLocaleString()}</strong></div>
                    <div><small className="text-muted">Cleared by Audit</small></div>
                  </div>
                  <div className="req-actions">
                    <button className="btn primary" onClick={() => openConfirm('Sign-off Investment', `Give final approval for the "${req.title}" investment (UGX ${req.amount?.toLocaleString()})?`, 'Confirm Sign-off', approveInvestment, req.id)}>
                      Approve Investment
                    </button>
                    <button className="btn danger" onClick={() => vetoInvestment(req.id)}>Veto</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="section-block">
          <div className="section-heading"><span>Manage Members</span></div>
          <div className="member-list">
            {mainGroup.members.map((m) => (
              <div key={m.id} className="member-card">
                <div className="member-avatar">{m.avatar}</div>
                <div className="member-info">
                  <div className="member-name">{m.name}</div>
                  <div className="member-email">{m.role}</div>
                </div>
                {m.role !== 'admin' && (
                  <button
                    className="btn danger small"
                    onClick={() => {
                      if (confirm('Remove this member?')) removeMember(mainGroup.id, m.id)
                    }}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="section-block">
          <div className="section-heading"><span>Open Issues & Disputes</span></div>
          {openIssues.length === 0 ? (
            <div className="empty-state"><p>No open issues for this group.</p></div>
          ) : (
            <div className="list-group">
              {openIssues.map((iss) => (
                <div key={iss.id} className="list-item">
                  <div className="list-icon" style={{ background: 'var(--gold)', color: 'white' }}>!</div>
                  <div className="list-text">
                    <div><strong>{iss.title}</strong></div>
                    <small className="text-muted">{iss.description}</small>
                    <small className="text-muted">Reported by {iss.author}</small>
                  </div>
                  <button className="btn success small" onClick={() => handleResolveIssue(iss.id)}>Resolve</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="section-block">
          <div className="section-heading"><span>Group Administration</span></div>
          <div className="card-box">
            <div className="req-actions">
              <button className="btn secondary full" onClick={() => navigate(`/groups/${mainGroup.id}/settings`)}>
                Configure Group Rules
              </button>
              <button className="btn secondary full" onClick={handleShowAnalytics}>
                Analytics & Reports
              </button>
            </div>
          </div>
        </div>
      </div>

      {showAnalytics && analytics && (
        <div className="modal-overlay" onClick={() => setShowAnalytics(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Analytics & Reports - {analytics.groupName}</h3>
            <div className="modal-body">
              <div className="stats-grid">
                <div className="stat-tile green">
                  <div className="stat-value">UGX {analytics.totalCollected?.toLocaleString()}</div>
                  <div className="stat-label">Total Collected</div>
                </div>
                <div className="stat-tile gold">
                  <div className="stat-value">{analytics.collectionRate}%</div>
                  <div className="stat-label">Collection Rate</div>
                </div>
                <div className="stat-tile blue">
                  <div className="stat-value">{analytics.memberCount}</div>
                  <div className="stat-label">Members</div>
                </div>
                <div className="stat-tile teal">
                  <div className="stat-value">{analytics.activeLoans}</div>
                  <div className="stat-label">Active Loans</div>
                </div>
              </div>
              <div className="card-box mt-1">
                <div className="info-row">
                  <span>Total Outstanding (Loans)</span>
                  <strong>UGX {analytics.totalOutstanding?.toLocaleString()}</strong>
                </div>
                <div className="info-row">
                  <span>Total Repaid</span>
                  <strong>UGX {analytics.totalRepaid?.toLocaleString()}</strong>
                </div>
                <div className="info-row">
                  <span>Records</span>
                  <strong>{analytics.recordCount}</strong>
                </div>
              </div>
              {analytics.monthlyBreakdown && Object.keys(analytics.monthlyBreakdown).length > 0 && (
                <div className="card-box mt-1">
                  <div className="section-heading"><span>Monthly Breakdown</span></div>
                  {Object.entries(analytics.monthlyBreakdown).map(([month, amount]) => (
                    <div key={month} className="info-row">
                      <span>{month}</span>
                      <strong>UGX {amount?.toLocaleString()}</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-actions mt-1">
              <button className="btn secondary" onClick={() => setShowAnalytics(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmAction
        show={confirmModal.show}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmLabel={confirmModal.confirmLabel}
        onConfirm={handleConfirm}
        onCancel={closeConfirm}
      />
    </div>
  )
}
