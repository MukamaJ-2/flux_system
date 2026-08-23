import React, { useState } from 'react'
import { useGroups } from '../context/GroupsContext'
import { useFinance } from '../context/FinanceContext'
import { useAuth } from '../context/AuthContext'
import GroupSwitcher from '../components/GroupSwitcher'
import ConfirmAction from '../components/ConfirmAction'
import { downloadRecordsCsv } from '../utils/csv'
import { totalPayable } from '../utils/loans'

export default function TreasuryDashboard() {
  const { data, decideRequest } = useGroups()
  const { finance, advanceLoan, disburseLoan } = useFinance()
  const { user } = useAuth()

  const [confirmModal, setConfirmModal] = useState({ show: false, action: null, title: '', message: '', confirmLabel: '' })
  const [activeGroupId, setActiveGroupId] = useState(null)

  const mainGroup = data.groups.find((g) => g.id === activeGroupId) || data.groups[0]
  if (!mainGroup) {
    return (
      <div className="page dashboard-page">
        <div className="empty-state"><p>Join or create a group to use the Treasury panel.</p></div>
      </div>
    )
  }

  const groupLoans = finance.loans.filter((l) => (l.groupId || l.group) === mainGroup.id)
  const pendingChecks = groupLoans.filter((l) => l.status === 'pending_treasury')
  const pendingDisbursals = groupLoans.filter((l) => l.status === 'approved')
  const pendingContributions = (mainGroup.requests || []).filter(
    (r) => r.type === 'contribution' && r.status === 'pending_treasury',
  )

  const openConfirm = (title, message, confirmLabel, action, payload) => {
    setConfirmModal({ show: true, title, message, confirmLabel, action: () => action(payload) })
  }

  const closeConfirm = () => setConfirmModal({ show: false, action: null, title: '', message: '', confirmLabel: '' })

  const handleConfirm = async () => {
    if (confirmModal.action) await confirmModal.action()
    closeConfirm()
  }

  const handleApproveCheck = async (loanId) => {
    await advanceLoan(loanId, true)
  }

  const rejectLoan = async (loanId) => {
    await advanceLoan(loanId, false)
  }

  const executeDisbursal = async (loanId) => {
    await disburseLoan(loanId)
  }

  const executeContribution = async (reqId) => {
    await decideRequest(mainGroup.id, reqId, true, user.fullName)
  }

  const generateStatements = () => {
    downloadRecordsCsv(mainGroup.records || [], `statements-${mainGroup.name}-${new Date().toISOString().slice(0, 10)}.csv`)
  }

  const interestRate = mainGroup.rules?.interest || '0'
  const totalCollected = (mainGroup.records || []).reduce((s, r) => s + (r.amount || 0), 0)
  const totalLoaned = groupLoans.reduce((s, l) => s + totalPayable(l), 0)
  const totalRepaid = groupLoans.reduce((s, l) => s + (l.repaid || 0), 0)

  return (
    <div className="page dashboard-page">
      <header className="page-header">
        <h1>Treasury Dashboard</h1>
        <p>Handle finance workflow handoffs, record approved funds, and process disbursals.</p>
      </header>

      <GroupSwitcher groups={data.groups} activeGroupId={mainGroup.id} onChange={setActiveGroupId} />

      <div className="dashboard-grid">
        <div className="section-block">
          <div className="section-heading"><span>Loan Financial Checks</span></div>
          {pendingChecks.length === 0 ? (
            <div className="empty-state"><p>No pending financial checks.</p></div>
          ) : (
            <div className="request-list">
              {pendingChecks.map((loan) => (
                <div key={loan.id} className="request-card">
                  <div className="req-header">
                    <strong>{loan.requesterName}</strong>
                    <span className="badge warning">Needs Check</span>
                  </div>
                  <div className="req-body">
                    <div>Amount: <strong>UGX {loan.amount?.toLocaleString()}</strong></div>
                    <div>Status: Awaiting Treasury clearance</div>
                  </div>
                  <div className="req-actions">
                    <button className="btn success" onClick={() => handleApproveCheck(loan.id)}>Clear Financials</button>
                    <button className="btn danger" onClick={() => rejectLoan(loan.id)}>Reject</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="section-block">
          <div className="section-heading"><span>Process Disbursals</span></div>
          {pendingDisbursals.length === 0 ? (
            <div className="empty-state"><p>No loans awaiting disbursal.</p></div>
          ) : (
            <div className="request-list">
              {pendingDisbursals.map((loan) => (
                <div key={loan.id} className="request-card">
                  <div className="req-header">
                    <strong>{loan.requesterName}</strong>
                    <span className="badge success">Ready to Pay</span>
                  </div>
                  <div className="req-body">
                    <div>Amount: <strong>UGX {loan.amount?.toLocaleString()}</strong></div>
                    <div><small className="text-muted">Approved by Chair — not yet paid out</small></div>
                  </div>
                  <div className="req-actions">
                    <button className="btn primary" onClick={() => openConfirm('Disburse Loan', `Confirm that UGX ${loan.amount?.toLocaleString()} has been paid out to ${loan.requesterName}.`, 'Confirm Disbursal', executeDisbursal, loan.id)}>
                      Process Disbursal
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="section-block">
          <div className="section-heading"><span>Record Contributions</span></div>
          {pendingContributions.length === 0 ? (
            <div className="empty-state"><p>No pending contributions.</p></div>
          ) : (
            <div className="request-list">
              {pendingContributions.map((req) => (
                <div key={req.id} className="request-card">
                  <div className="req-header">
                    <strong>{req.requesterName}</strong>
                    <span className="badge info">{req.method}</span>
                  </div>
                  <div className="req-body">
                    <div>Amount: <strong>UGX {req.amount?.toLocaleString()}</strong></div>
                    <div><small className="text-muted">{req.note}</small></div>
                  </div>
                  <div className="req-actions">
                    <button className="btn primary" onClick={() => openConfirm('Record Contribution', `Confirm UGX ${req.amount?.toLocaleString()} received from ${req.requesterName}.`, 'Confirm & Record', executeContribution, req.id)}>
                      Record Funds
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="section-block">
          <div className="section-heading"><span>Loan Interest & Statements</span></div>
          <div className="card-box">
            <div className="info-row">
              <span>Group Interest Rate</span>
              <strong>{interestRate}</strong>
            </div>
            <div className="info-row">
              <span>Total Collected</span>
              <strong>UGX {totalCollected.toLocaleString()}</strong>
            </div>
            <div className="info-row">
              <span>Total Owed (principal + interest)</span>
              <strong>UGX {totalLoaned.toLocaleString()}</strong>
            </div>
            <div className="info-row">
              <span>Total Repaid</span>
              <strong>UGX {totalRepaid.toLocaleString()}</strong>
            </div>
            <div className="req-actions mt-1">
              <button className="btn secondary full" onClick={generateStatements}>Generate Statements (CSV)</button>
            </div>
          </div>
        </div>
      </div>

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
