import React, { useState } from 'react'
import { useGroups } from '../context/GroupsContext'
import { useAuth } from '../context/AuthContext'
import GroupSwitcher from '../components/GroupSwitcher'

export default function VotingDashboard() {
  const { data, castVote } = useGroups()
  const { user } = useAuth()
  const [activeGroupId, setActiveGroupId] = useState(null)

  const mainGroup = data.groups.find((g) => g.id === activeGroupId) || data.groups[0]
  if (!mainGroup) return null

  const proposedInvestments = (mainGroup.requests || []).filter(r => r.type === 'investment' && r.status === 'proposed')
  
  const totalMembers = mainGroup.members.length
  const majorityThreshold = Math.floor(totalMembers / 2) + 1

  return (
    <div className="page dashboard-page">
      <header className="page-header">
        <h1>Voting Booth</h1>
        <p>Review proposed investments and cast your vote. A majority "Yes" vote will pass the proposal to Audit.</p>
      </header>

      <GroupSwitcher groups={data.groups} activeGroupId={mainGroup.id} onChange={setActiveGroupId} />

      <div className="dashboard-grid">
        <div className="section-block" style={{ gridColumn: '1 / -1' }}>
          <div className="section-heading"><span>Active Proposals</span></div>
          {proposedInvestments.length === 0 ? (
            <div className="empty-state">
              <p>There are no active investment proposals open for voting.</p>
            </div>
          ) : (
            <div className="request-list">
              {proposedInvestments.map(req => {
                const votes = req.votes || { yes: [], no: [] }
                const yesCount = votes.yes.length
                const noCount = votes.no.length
                const progressPct = Math.min((yesCount / majorityThreshold) * 100, 100)
                
                const hasVotedYes = votes.yes.includes(user?.id)
                const hasVotedNo = votes.no.includes(user?.id)

                return (
                  <div key={req.id} className="request-card" style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '2rem', alignItems: 'center' }}>
                    
                    {/* Proposal Details */}
                    <div>
                      <div className="req-header">
                        <strong style={{ fontSize: '1.25rem' }}>{req.title}</strong>
                        <span className="badge info">Proposed</span>
                      </div>
                      <div className="req-body mt-1">
                        <div>Proposed Amount: <strong>UGX {req.amount?.toLocaleString()}</strong></div>
                        <div>Proposed By: <strong>{req.requesterName}</strong></div>
                        <div className="text-muted text-sm mt-1">Submitted: {new Date(req.createdAt).toLocaleDateString()}</div>
                      </div>
                      
                      <div className="req-actions mt-1">
                        <button 
                          className={`btn ${hasVotedYes ? 'primary' : 'secondary'}`} 
                          onClick={() => castVote(mainGroup.id, req.id, user.id, 'yes')}
                        >
                          👍 {hasVotedYes ? 'Voted Yes' : 'Vote Yes'}
                        </button>
                        <button 
                          className={`btn ${hasVotedNo ? 'danger' : 'secondary'}`} 
                          onClick={() => castVote(mainGroup.id, req.id, user.id, 'no')}
                        >
                          👎 {hasVotedNo ? 'Voted No' : 'Vote No'}
                        </button>
                      </div>
                    </div>

                    {/* Progress Tracker */}
                    <div className="card-box" style={{ background: 'var(--bg-secondary)', border: 'none' }}>
                      <div style={{ marginBottom: '0.5rem', fontWeight: 'bold' }}>Pass Progress</div>
                      <div className="progress-bar-bg" style={{ background: '#ddd', height: '12px', borderRadius: '6px', overflow: 'hidden' }}>
                        <div className="progress-bar-fill" style={{ background: 'var(--primary)', height: '100%', width: `${progressPct}%`, transition: 'width 0.3s' }}></div>
                      </div>
                      <div className="text-sm text-muted mt-1" style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>{yesCount} / {majorityThreshold} Votes to Pass</span>
                        <span>{noCount} Against</span>
                      </div>
                    </div>

                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
