import React, { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useGroups, isGroupAdmin } from '../context/GroupsContext'
import { useAuth } from '../context/AuthContext'
import { useFinance } from '../context/FinanceContext'

export default function AdminRequests() {
  const { id } = useParams()
  const { data, decideRequest } = useGroups()
  const { finance, decideLoanRequest, decideGoalRequest } = useFinance()
  const { user, hasAnyRole } = useAuth()

  const [requestType, setRequestType] = useState('contributions') // 'contributions' or 'loans' or 'goals'
  const [filter, setFilter] = useState('pending')
  const [deciding, setDeciding] = useState(null)

  const group = data.groups.find((g) => g.id === id)
  if (!group) return <div className="page"><div className="empty-title">Group not found</div></div>
  const canReview = isGroupAdmin(group, user) || hasAnyRole('sysadmin', 'chair', 'treasury', 'secretary', 'audit')
  if (!canReview) return (
    <div className="page">
      <div className="empty-state">
        <div className="empty-icon">⚠</div>
        <div className="empty-title">Not Authorized</div>
        <p className="empty-copy">Only the group admin or a finance role can review requests.</p>
        <Link to={`/groups/${id}`} className="btn">Back to Group</Link>
      </div>
    </div>
  )

  // Contribution Requests
  const allContributions = group.requests || []
  const filteredContributions = filter === 'all' ? allContributions : filter === 'pending' ? allContributions.filter((r) => r.status === 'pending' || r.status === 'pending_treasury' || r.status === 'pending_secretary' || r.status === 'pending_audit' || r.status === 'pending_chair') : allContributions.filter((r) => r.status === filter)
  const pendingContributionsCount = allContributions.filter((r) => r.status === 'pending' || r.status === 'pending_treasury').length

  // Loan Requests — API returns groupId field
  const allLoans = finance.loans.filter(l => (l.groupId || l.group) === id)
  const filteredLoans = filter === 'all' ? allLoans : allLoans.filter((l) => l.status === filter)
  const pendingLoansCount = allLoans.filter((l) => l.status === 'pending').length

  // Goal Requests — API returns linkedGroupId field
  const allGoals = finance.goals.filter(g => (g.linkedGroupId || g.linked_group) === id)
  const filteredGoals = filter === 'all' ? allGoals : allGoals.filter((g) => g.status === filter)
  const pendingGoalsCount = allGoals.filter((g) => g.status === 'pending').length

  async function handleDecideContribution(requestId, approved) {
    setDeciding(`contrib_${requestId}_${approved ? 'approve' : 'reject'}`)
    await decideRequest(id, requestId, approved, user?.fullName)
    setDeciding(null)
  }

  async function handleDecideLoan(loanId, approved) {
    setDeciding(`loan_${loanId}_${approved ? 'approve' : 'reject'}`)
    await decideLoanRequest(loanId, approved, user?.fullName)
    setDeciding(null)
  }

  async function handleDecideGoal(goalId, approved) {
    setDeciding(`goal_${goalId}_${approved ? 'approve' : 'reject'}`)
    await decideGoalRequest(goalId, approved, user?.fullName)
    setDeciding(null)
  }

  return (
    <div className="page admin-requests-page">
      <div className="page-intro">
        <div className="page-intro-icon gold">⏳</div>
        <div>
          <div className="page-kicker">Admin · {group.name}</div>
          <h2>Requests Review</h2>
          <p className="subcopy">Review, approve, or reject member requests. Approved contributions are added to official records.</p>
        </div>
      </div>

      <div className="tab-row" style={{ marginBottom: '24px' }}>
        <button
          className={`tab-btn ${requestType === 'contributions' ? 'active' : ''}`}
          onClick={() => setRequestType('contributions')}
        >
          Contributions
          {pendingContributionsCount > 0 && <span className="chip-count">{pendingContributionsCount}</span>}
        </button>
        <button
          className={`tab-btn ${requestType === 'loans' ? 'active' : ''}`}
          onClick={() => setRequestType('loans')}
        >
          Loans
          {pendingLoansCount > 0 && <span className="chip-count">{pendingLoansCount}</span>}
        </button>
        <button
          className={`tab-btn ${requestType === 'goals' ? 'active' : ''}`}
          onClick={() => setRequestType('goals')}
        >
          Goals
          {pendingGoalsCount > 0 && <span className="chip-count">{pendingGoalsCount}</span>}
        </button>
      </div>

      <div className="filter-row">
        {['pending', 'approved', 'rejected', 'all'].map((f) => (
          <button
            key={f}
            className={`filter-chip ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {requestType === 'contributions' && (
        <>
          {filteredContributions.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">✓</div>
              <div className="empty-title">No {filter !== 'all' ? filter : ''} contributions</div>
              <p className="empty-copy">
                {filter === 'pending'
                  ? 'All contribution requests have been reviewed.'
                  : `No ${filter} requests to show.`}
              </p>
            </div>
          ) : (
            <div className="request-list">
              {[...filteredContributions].reverse().map((req) => (
                <div key={req.id} className={`request-card admin-req ${req.status}`}>
                  <div className="req-header">
                    <div className="req-member">
                      <div className="req-avatar">{req.requesterAvatar || req.requesterName?.slice(0, 2).toUpperCase() || '?'}</div>
                      <div>
                        <div className="req-name">{req.requesterName}</div>
                        <div className="req-date">{new Date(req.createdAt).toLocaleString()}</div>
                      </div>
                    </div>
                    <div className="req-right">
                      <div className="req-amount">UGX {Number(req.amount).toLocaleString()}</div>
                      <span className={`pill ${req.status === 'approved' ? 'success' : req.status === 'rejected' ? 'danger' : 'warning'}`}>
                        {req.status}
                      </span>
                    </div>
                  </div>

                  <div className="req-details">
                    <div className="req-detail-row">
                      <span className="req-detail-label">Payment Method</span>
                      <span className="req-detail-value">{req.method || 'Not specified'}</span>
                    </div>
                    {req.date && (
                      <div className="req-detail-row">
                        <span className="req-detail-label">Payment Date</span>
                        <span className="req-detail-value">{new Date(req.date).toLocaleDateString()}</span>
                      </div>
                    )}
                    {req.note && (
                      <div className="req-note-box">
                        <span className="req-detail-label">Note</span>
                        <p>{req.note}</p>
                      </div>
                    )}
                    {req.receiptUrl && (
                      <div className="req-detail-row">
                        <span className="req-detail-label">Receipt</span>
                        <div style={{ marginTop: '8px' }}>
                          <img 
                            src={req.receiptUrl} 
                            alt="Receipt" 
                            style={{ maxWidth: '100%', maxHeight: '150px', borderRadius: '4px', cursor: 'pointer', border: '1px solid var(--border)' }}
                            onClick={() => window.open(req.receiptUrl, '_blank')}
                          />
                        </div>
                      </div>
                    )}
                    {req.decidedBy && (
                      <div className="req-decided">
                        {req.status === 'approved' ? '✓' : '✗'} {req.status} by {req.decidedBy} on {new Date(req.decidedAt).toLocaleDateString()}
                      </div>
                    )}
                  </div>

                  {['pending', 'pending_secretary', 'pending_treasury', 'pending_audit', 'pending_chair'].includes(req.status) && (
                    <div className="req-actions">
                      <button
                        className="btn danger"
                        onClick={() => handleDecideContribution(req.id, false)}
                        disabled={!!deciding}
                      >
                        {deciding === `contrib_${req.id}_reject` ? <span className="spinner sm" /> : '✗ Reject'}
                      </button>
                      <button
                        className="btn"
                        onClick={() => handleDecideContribution(req.id, true)}
                        disabled={!!deciding}
                      >
                        {deciding === `contrib_${req.id}_approve` ? <span className="spinner sm" /> : '✓ Approve'}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {requestType === 'loans' && (
        <>
          {filteredLoans.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">✓</div>
              <div className="empty-title">No {filter !== 'all' ? filter : ''} loans</div>
              <p className="empty-copy">
                {filter === 'pending'
                  ? 'All loan requests have been reviewed.'
                  : `No ${filter} loans to show.`}
              </p>
            </div>
          ) : (
            <div className="request-list">
              {[...filteredLoans].reverse().map((loan) => (
                <div key={loan.id} className={`request-card admin-req ${loan.status}`}>
                  <div className="req-header">
                    <div className="req-member">
                      <div className="req-avatar">{loan.requesterName?.slice(0, 2).toUpperCase() || '?'}</div>
                      <div>
                        <div className="req-name">{loan.requesterName}</div>
                        <div className="req-date">{new Date(loan.createdAt).toLocaleString()}</div>
                      </div>
                    </div>
                    <div className="req-right">
                      <div className="req-amount">UGX {Number(loan.amount).toLocaleString()}</div>
                      <span className={`pill ${loan.status === 'approved' ? 'success' : loan.status === 'rejected' ? 'danger' : 'warning'}`}>
                        {loan.status}
                      </span>
                    </div>
                  </div>

                  <div className="req-details">
                    <div className="req-detail-row">
                      <span className="req-detail-label">Loan Title</span>
                      <span className="req-detail-value">{loan.title}</span>
                    </div>
                    <div className="req-detail-row">
                      <span className="req-detail-label">Requested Terms</span>
                      <span className="req-detail-value">{loan.installments} x {loan.frequency} @ {loan.interestRate}%</span>
                    </div>
                    {loan.reason && (
                      <div className="req-note-box">
                        <span className="req-detail-label">Reason</span>
                        <p>{loan.reason}</p>
                      </div>
                    )}
                    {loan.decidedBy && (
                      <div className="req-decided">
                        {loan.status === 'approved' ? '✓' : '✗'} {loan.status} by {loan.decidedBy} on {new Date(loan.decidedAt).toLocaleDateString()}
                      </div>
                    )}
                  </div>

                  {loan.status === 'pending' && (
                    <div className="req-actions">
                      <button
                        className="btn danger"
                        onClick={() => handleDecideLoan(loan.id, false)}
                        disabled={!!deciding}
                      >
                        {deciding === `loan_${loan.id}_reject` ? <span className="spinner sm" /> : '✗ Reject'}
                      </button>
                      <button
                        className="btn"
                        onClick={() => handleDecideLoan(loan.id, true)}
                        disabled={!!deciding}
                      >
                        {deciding === `loan_${loan.id}_approve` ? <span className="spinner sm" /> : '✓ Approve'}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {requestType === 'goals' && (
        <>
          {filteredGoals.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">✓</div>
              <div className="empty-title">No {filter !== 'all' ? filter : ''} goals</div>
              <p className="empty-copy">
                {filter === 'pending'
                  ? 'All goal requests have been reviewed.'
                  : `No ${filter} goals to show.`}
              </p>
            </div>
          ) : (
            <div className="request-list">
              {[...filteredGoals].reverse().map((goal) => {
                const requesterName = goal.requesterName || `User #${goal.userId || '?'}`
                return (
                <div key={goal.id} className={`request-card admin-req ${goal.status}`}>
                  <div className="req-header">
                    <div className="req-member">
                      <div className="req-avatar">{requesterName.slice(0, 2).toUpperCase()}</div>
                      <div>
                        <div className="req-name">{requesterName}</div>
                        <div className="req-date">Goal Target: {new Date(goal.targetDate).toLocaleDateString()}</div>
                      </div>
                    </div>
                    <div className="req-right">
                      <div className="req-amount">UGX {Number(goal.targetAmount).toLocaleString()}</div>
                      <span className={`pill ${goal.status === 'approved' ? 'success' : goal.status === 'rejected' ? 'danger' : 'warning'}`}>
                        {goal.status}
                      </span>
                    </div>
                  </div>

                  <div className="req-details">
                    <div className="req-detail-row">
                      <span className="req-detail-label">Goal Title</span>
                      <span className="req-detail-value">{goal.title}</span>
                    </div>
                    {goal.notes && (
                      <div className="req-note-box">
                        <span className="req-detail-label">Notes</span>
                        <p>{goal.notes}</p>
                      </div>
                    )}
                    {goal.decidedBy && (
                      <div className="req-decided">
                        {goal.status === 'approved' ? '✓' : '✗'} {goal.status} by {goal.decidedBy} on {new Date(goal.decidedAt).toLocaleDateString()}
                      </div>
                    )}
                  </div>

                  {goal.status === 'pending' && (
                    <div className="req-actions">
                      <button
                        className="btn danger"
                        onClick={() => handleDecideGoal(goal.id, false)}
                        disabled={!!deciding}
                      >
                        {deciding === `goal_${goal.id}_reject` ? <span className="spinner sm" /> : '✗ Reject'}
                      </button>
                      <button
                        className="btn"
                        onClick={() => handleDecideGoal(goal.id, true)}
                        disabled={!!deciding}
                      >
                        {deciding === `goal_${goal.id}_approve` ? <span className="spinner sm" /> : '✓ Approve'}
                      </button>
                    </div>
                  )}
                </div>
              )})}
            </div>
          )}
        </>
      )}

      <div className="page-footer-links">
        <Link to={`/groups/${id}`} className="link-action">← Back to Group</Link>
        <Link to={`/groups/${id}/records`} className="link-action">View Records →</Link>
      </div>
    </div>
  )
}
