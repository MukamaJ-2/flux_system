import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useFinance } from '../context/FinanceContext'
import { useAuth } from '../context/AuthContext'

export default function Goals() {
  const { finance, saveGoalProgress } = useFinance()
  const { user } = useAuth()
  const [filter, setFilter] = useState('approved')
  const [contributeModal, setContributeModal] = useState({ show: false, goalId: null, amount: '' })

  const myGoals = finance.goals.filter((goal) => goal.userId === user?.id)

  const filteredGoals = filter === 'All' ? myGoals : myGoals.filter(g => g.status === filter)

  const activeCount = myGoals.filter((goal) => goal.status === 'approved').length
  const savedTotal = myGoals.reduce((sum, goal) => sum + goal.savedAmount, 0)

  const handleContribute = async (e) => {
    e.preventDefault()
    const amount = Number(contributeModal.amount)
    if (!amount || amount <= 0) return
    await saveGoalProgress(contributeModal.goalId, amount)
    setContributeModal({ show: false, goalId: null, amount: '' })
  }

  return (
    <div className="page goals-page">
      <div className="page-intro">
        <div className="page-intro-icon gold">◎</div>
        <div>
          <div className="page-kicker">Personal Finance</div>
          <h2>Saving Goals</h2>
          <p className="subcopy">Set targets and track your personal savings progress.</p>
        </div>
      </div>

      <div className="page-top-row">
        <Link to="/goals/new" className="btn">+ Create Goal</Link>
      </div>

      <div className="summary-bar">
        <div className="summary-item-lg">
          <div className="summary-lbl">Active Goals</div>
          <div className="summary-val">{activeCount}</div>
        </div>
        <div className="summary-item-lg">
          <div className="summary-lbl">Total Saved</div>
          <div className="summary-val gold">UGX {savedTotal.toLocaleString()}</div>
        </div>
      </div>

      <div className="filter-row">
        {['pending', 'approved', 'rejected', 'All'].map((f) => (
          <button
            key={f}
            className={`filter-chip ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="section-block">
        {filteredGoals.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">◎</div>
            <div className="empty-title">No {filter !== 'All' ? filter : ''} Goals</div>
            <p className="empty-copy">Create a saving goal to start tracking your progress.</p>
            <Link to="/goals/new" className="btn">Create Goal</Link>
          </div>
        ) : (
          <div className="records-list">
            {filteredGoals.map((goal) => {
              const progress = Math.min((goal.savedAmount / goal.targetAmount) * 100, 100)
              const remaining = Math.max(goal.targetAmount - goal.savedAmount, 0)

              return (
                <div key={goal.id} className="record-card" style={{ display: 'block' }}>
                  <div className="headline" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <div>
                      <div className="amount" style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--text-strong)' }}>{goal.title}</div>
                      <div className="muted" style={{ fontSize: '0.9rem' }}>Target UGX {goal.targetAmount.toLocaleString()}</div>
                    </div>
                    <span className={`pill ${goal.status === 'approved' ? 'success' : goal.status === 'rejected' ? 'danger' : goal.status === 'completed' ? 'success' : 'warning'}`}>{goal.status}</span>
                  </div>

                  <div className="progress-track" style={{ height: '8px', background: 'var(--line)', borderRadius: '4px', overflow: 'hidden', marginBottom: '12px' }}>
                    <div className="progress-fill" style={{ width: `${progress}%`, height: '100%', background: 'linear-gradient(135deg, var(--gold), #c99723)' }} />
                  </div>

                  <div className="record-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--muted)' }}>
                    <span>Saved UGX {goal.savedAmount.toLocaleString()}</span>
                    <span>Due {new Date(goal.targetDate).toLocaleDateString()}</span>
                  </div>

                  {goal.linkedGroupId && (
                    <div style={{ marginTop: '12px', fontSize: '0.8rem', color: 'var(--teal)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>🔗</span> Linked to group payouts
                    </div>
                  )}

                  {goal.status === 'approved' && remaining > 0 && (
                    <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
                      <button className="btn sm" onClick={() => setContributeModal({ show: true, goalId: goal.id, amount: '' })}>
                        Add Savings (UGX {remaining.toLocaleString()} left)
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {contributeModal.show && (
        <div className="modal-overlay" onClick={() => setContributeModal({ show: false })}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Add to Savings</h3>
            <form onSubmit={handleContribute} className="flux-form">
              <div className="form-group">
                <label>Amount (UGX)</label>
                <input
                  type="number"
                  className="form-input"
                  min="1"
                  required
                  value={contributeModal.amount}
                  onChange={(e) => setContributeModal({ ...contributeModal, amount: e.target.value })}
                  placeholder="Enter amount to add"
                  autoFocus
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn secondary" onClick={() => setContributeModal({ show: false })}>Cancel</button>
                <button type="submit" className="btn primary">Add Savings</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
