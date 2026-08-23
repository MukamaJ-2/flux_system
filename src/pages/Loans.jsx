import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useFinance } from '../context/FinanceContext'
import { useAuth } from '../context/AuthContext'
import { useGroups } from '../context/GroupsContext'
import { totalPayable, outstandingBalance } from '../utils/loans'

const PENDING_STAGES = ['pending_secretary', 'pending_treasury', 'pending_audit', 'pending_chair']
const ACTIVE_STAGES = ['approved', 'disbursed']

export default function Loans() {
  const { finance, repayLoan } = useFinance()
  const { user } = useAuth()
  const { data: groupData } = useGroups()

  const [filter, setFilter] = useState('My Loans')
  const [repayModal, setRepayModal] = useState({ show: false, loanId: null, amount: '' })

  const myGroupIds = groupData.groups
    .filter((g) => g.members.some((m) => m.id === user?.id))
    .map((g) => g.id)

  const adminGroupIds = groupData.groups
    .filter((g) => g.members.some((m) => m.id === user?.id && m.role === 'admin'))
    .map((g) => g.id)

  const myLoans = finance.loans.filter((loan) => loan.requesterId === user?.id)

  const groupLoans = finance.loans.filter((loan) =>
    myGroupIds.includes(loan.groupId) && ACTIVE_STAGES.includes(loan.status)
  )

  const pendingAdminRequests = finance.loans.filter((loan) =>
    adminGroupIds.includes(loan.groupId) && PENDING_STAGES.includes(loan.status)
  )

  let displayLoans = []
  if (filter === 'My Loans') displayLoans = myLoans
  else if (filter === 'Group Loans') displayLoans = groupLoans
  else if (filter === 'Pending Requests') displayLoans = pendingAdminRequests

  const totals = groupLoans.reduce(
    (acc, loan) => {
      acc.total += totalPayable(loan)
      acc.outstanding += outstandingBalance(loan)
      return acc
    },
    { total: 0, outstanding: 0 }
  )

  const handleRepay = async (e) => {
    e.preventDefault()
    const amount = Number(repayModal.amount)
    if (!amount || amount <= 0) return
    await repayLoan(repayModal.loanId, amount)
    setRepayModal({ show: false, loanId: null, amount: '' })
  }

  return (
    <div className="page loans-page">
      <div className="page-intro">
        <div className="page-intro-icon blue">¤</div>
        <div>
          <div className="page-kicker">Borrowing</div>
          <h2>Loans</h2>
          <p className="subcopy">Request loans from your savings groups or view active group lending.</p>
        </div>
      </div>

      <div className="page-top-row">
        {myGroupIds.length > 0 ? (
          <Link to="/loans/new" className="btn">+ Request Loan</Link>
        ) : (
          <div className="admin-record-note">
            <span>ℹ</span>
            <span>Join a group to request a loan.</span>
          </div>
        )}
      </div>

      <div className="summary-bar">
        <div className="summary-item-lg">
          <div className="summary-lbl">Active Group Loans</div>
          <div className="summary-val">{groupLoans.length}</div>
        </div>
        <div className="summary-item-lg">
          <div className="summary-lbl">Total Outstanding</div>
          <div className="summary-val gold">UGX {totals.outstanding.toLocaleString()}</div>
        </div>
      </div>

      <div className="filter-row">
        <button
          className={`filter-chip ${filter === 'My Loans' ? 'active' : ''}`}
          onClick={() => setFilter('My Loans')}
        >
          My Loans
        </button>
        <button
          className={`filter-chip ${filter === 'Group Loans' ? 'active' : ''}`}
          onClick={() => setFilter('Group Loans')}
        >
          Group Loans
        </button>
        {adminGroupIds.length > 0 && (
          <button
            className={`filter-chip ${filter === 'Pending Requests' ? 'active' : ''}`}
            onClick={() => setFilter('Pending Requests')}
          >
            Pending Requests
            {pendingAdminRequests.length > 0 && <span className="chip-count">{pendingAdminRequests.length}</span>}
          </button>
        )}
      </div>

      <div className="section-block">
        {displayLoans.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">¤</div>
            <div className="empty-title">No {filter}</div>
            <p className="empty-copy">
              {filter === 'My Loans' && "You haven't requested any loans."}
              {filter === 'Group Loans' && "No active loans in your groups."}
              {filter === 'Pending Requests' && "No pending loan requests to review."}
            </p>
          </div>
        ) : (
          <div className="records-list">
            {displayLoans.map((loan) => {
              const group = groupData.groups.find((g) => g.id === loan.groupId)
              const payable = totalPayable(loan)
              const progress = Math.min((loan.repaid / payable) * 100, 100)
              const outstanding = outstandingBalance(loan)
              const isMine = loan.requesterId === String(user?.id)
              const isActive = ACTIVE_STAGES.includes(loan.status)

              return (
                <div key={loan.id} className="record-card" style={{ display: 'block' }}>
                  <div className="headline" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div>
                      <div className="amount" style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--text-strong)' }}>UGX {loan.amount.toLocaleString()}</div>
                      <div className="muted" style={{ fontSize: '0.9rem' }}>{loan.title} — for {loan.requesterName}</div>
                    </div>
                    <span className={`pill ${loan.status === 'approved' || loan.status === 'disbursed' || loan.status === 'repaid' ? 'success' : loan.status === 'rejected' ? 'danger' : 'warning'}`}>
                      {loan.status}
                    </span>
                  </div>

                  {isActive && (
                    <div className="progress-track" style={{ height: '8px', background: 'var(--line)', borderRadius: '4px', overflow: 'hidden', marginBottom: '12px' }}>
                      <div className="progress-fill" style={{ width: `${progress}%`, height: '100%', background: 'linear-gradient(135deg, var(--teal), #1dbf84)' }} />
                    </div>
                  )}

                  <div className="record-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '8px' }}>
                    <span>Group: <strong>{group?.name || 'Unknown'}</strong></span>
                    <span>Requested: {new Date(loan.createdAt).toLocaleDateString()}</span>
                  </div>

                  <div className="record-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--muted)', background: 'rgba(0,0,0,0.03)', padding: '10px', borderRadius: '8px' }}>
                    <span>Interest: {loan.interestRate}% ({loan.type}) — owes UGX {payable.toLocaleString()}</span>
                    <span>{loan.installments} {loan.frequency} installments</span>
                  </div>

                  {isActive && outstanding > 0 && isMine && (
                    <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                      <button className="btn sm" onClick={() => setRepayModal({ show: true, loanId: loan.id, amount: '' })}>
                        Repay (UGX {outstanding.toLocaleString()} left)
                      </button>
                    </div>
                  )}

                  {filter === 'Pending Requests' && PENDING_STAGES.includes(loan.status) && (
                    <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                      <Link to={`/groups/${loan.groupId}/requests`} className="btn sm">Review in Group</Link>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {repayModal.show && (
        <div className="modal-overlay" onClick={() => setRepayModal({ show: false })}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Repay Loan</h3>
            <form onSubmit={handleRepay} className="flux-form">
              <div className="form-group">
                <label>Repayment Amount (UGX)</label>
                <input
                  type="number"
                  className="form-input"
                  min="1"
                  required
                  value={repayModal.amount}
                  onChange={(e) => setRepayModal({ ...repayModal, amount: e.target.value })}
                  placeholder="Enter amount to repay"
                  autoFocus
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn secondary" onClick={() => setRepayModal({ show: false })}>Cancel</button>
                <button type="submit" className="btn primary">Confirm Repayment</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
