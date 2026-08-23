import React, { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useGroups, isGroupAdmin } from '../context/GroupsContext'
import { useAuth } from '../context/AuthContext'

export default function ContributionRecords() {
  const { id } = useParams()
  const { data } = useGroups()
  const { user } = useAuth()
  const [filter, setFilter] = useState('all')
  const group = data.groups.find((g) => g.id === id)

  if (!group) return <div className="page"><div className="empty-title">Group not found</div></div>

  const totalCollected = (group.records || []).reduce((sum, r) => sum + r.amount, 0)
  const groupIsAdmin = isGroupAdmin(group, user)

  // Per-member breakdown with share percentages
  const memberBreakdown = group.members.map((m) => {
    const memberTotal = (group.records || [])
      .filter((r) => r.memberId === m.id)
      .reduce((s, r) => s + r.amount, 0)
    const share = totalCollected > 0 ? ((memberTotal / totalCollected) * 100).toFixed(1) : '0.0'
    return { ...m, memberTotal, share }
  }).sort((a, b) => b.memberTotal - a.memberTotal)

  const filteredRecords = filter === 'all'
    ? (group.records || [])
    : (group.records || []).filter((r) => r.memberId === filter)

  return (
    <div className="page records-page">
      <div className="page-intro">
        <div className="page-intro-icon teal">▤</div>
        <div>
          <div className="page-kicker">Contribution history · {group.name}</div>
          <h2>Records</h2>
        </div>
      </div>

      <div className="summary-bar">
        <div className="summary-item-lg">
          <div className="summary-lbl">Total Collected</div>
          <div className="summary-val teal">UGX {totalCollected.toLocaleString()}</div>
        </div>
        <div className="summary-item-lg">
          <div className="summary-lbl">Total Records</div>
          <div className="summary-val">{(group.records || []).length}</div>
        </div>
        <div className="summary-item-lg">
          <div className="summary-lbl">Members</div>
          <div className="summary-val">{group.members.length}</div>
        </div>
      </div>

      <div className="section-block">
        <div className="section-heading"><span>Member Share Breakdown</span></div>
        <div className="card-box">
          {memberBreakdown.map((m) => (
            <div key={m.id} style={{ marginBottom: '0.75rem' }}>
              <div className="info-row">
                <span><strong>{m.name}</strong></span>
                <span>{m.share}%</span>
              </div>
              <div className="progress-track" style={{ height: '8px', background: 'var(--line)', borderRadius: '4px', overflow: 'hidden', marginTop: '4px' }}>
                <div className="progress-fill" style={{ width: `${Math.min(parseFloat(m.share), 100)}%`, height: '100%', background: 'linear-gradient(135deg, var(--teal), #1dbf84)' }} />
              </div>
              <div className="info-row" style={{ marginTop: '2px' }}>
                <span className="text-muted text-sm">UGX {m.memberTotal.toLocaleString()}</span>
              </div>
            </div>
          ))}
          {totalCollected === 0 && <div className="empty-state"><p>No contributions collected yet.</p></div>}
        </div>
      </div>

      <div className="section-block">
        <div className="section-heading"><span>Filter by Member</span></div>
        <div className="filter-row">
          <button
            className={`filter-chip ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All Records
          </button>
          {group.members.map((m) => (
            <button
              key={m.id}
              className={`filter-chip ${filter === m.id ? 'active' : ''}`}
              onClick={() => setFilter(m.id)}
            >
              {m.name}
            </button>
          ))}
        </div>
      </div>

      {filteredRecords.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">▤</div>
          <div className="empty-title">No Records Yet</div>
          <p className="empty-copy">
            {groupIsAdmin
              ? 'Approve member requests or record contributions directly to see them here.'
              : 'Contribution records will appear here once approved by the treasury.'}
          </p>
          {groupIsAdmin && (
            <div className="empty-actions">
              <Link to={`/groups/${id}/requests`} className="btn">Review Requests</Link>
              <Link to={`/groups/${id}/record`} className="btn secondary">Record Directly</Link>
            </div>
          )}
          {!groupIsAdmin && (
            <Link to={`/groups/${id}/submit`} className="btn">Submit Contribution</Link>
          )}
        </div>
      ) : (
        <div className="records-list">
          {[...filteredRecords].reverse().map((r) => (
            <div key={r.id} className="record-card">
              <div className="record-left">
                <div className="record-avatar">
                  {group.members.find((m) => m.id === r.memberId)?.avatar || r.memberName?.slice(0, 2).toUpperCase() || '?'}
                </div>
                <div className="record-info">
                  <div className="record-name">{r.memberName || group.members.find((m) => m.id === r.memberId)?.name || 'Unknown'}</div>
                  <div className="record-meta">
                    {r.method && <span>{r.method}</span>}
                    <span>{new Date(r.date).toLocaleDateString()}</span>
                  </div>
                  {r.note && <div className="record-note">{r.note}</div>}
                  {r.receipt_url && (
                    <div style={{ marginTop: '8px' }}>
                      <img
                        src={r.receipt_url}
                        alt="Receipt"
                        style={{ maxWidth: '100%', maxHeight: '100px', borderRadius: '4px', cursor: 'pointer', border: '1px solid var(--border)' }}
                        onClick={() => window.open(r.receipt_url, '_blank')}
                      />
                    </div>
                  )}
                </div>
              </div>
              <div className="record-right">
                <div className="record-amount">UGX {r.amount.toLocaleString()}</div>
                <span className="pill success">Confirmed</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="page-footer-links">
        <Link to={`/groups/${id}`} className="link-action">← Back to Group</Link>
        {groupIsAdmin && <Link to={`/groups/${id}/requests`} className="link-action">Review Requests →</Link>}
      </div>
    </div>
  )
}
