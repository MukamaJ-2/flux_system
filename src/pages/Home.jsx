import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getDashboardPathForRole, useAuth } from '../context/AuthContext'
import { useGroups } from '../context/GroupsContext'
import { useFinance } from '../context/FinanceContext'
import { API_URL, SUPABASE_ANON_KEY } from '../config'

const MESSAGE_ICON = { reminder: '⏰', meeting_invite: '📅', general: '🔔' }

export default function Home() {
  const { user } = useAuth()
  const { data } = useGroups()
  const { finance } = useFinance()
  const [inbox, setInbox] = useState([])

  useEffect(() => {
    let cancelled = false
    async function fetchInbox() {
      try {
        const res = await fetch(`${API_URL}/messages/inbox/`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('flux_access_token')}`,
            apikey: SUPABASE_ANON_KEY,
          },
        })
        if (res.ok && !cancelled) setInbox(await res.json())
      } catch (e) {
        console.error('Failed to fetch messages', e)
      }
    }
    fetchInbox()
    return () => { cancelled = true }
  }, [])

  const myGroups = data.groups.filter((g) =>
    g.members.some((m) => m.id === user?.id),
  )

  const totalGroupSavings = myGroups.reduce(
    (sum, g) => sum + (g.records || []).reduce((s, r) => s + r.amount, 0),
    0,
  )

  const myContributions = myGroups.reduce(
    (sum, g) => sum + (g.records || []).filter((r) => r.memberId === user?.id).reduce((s, r) => s + r.amount, 0),
    0,
  )
  const rolePanelPath = getDashboardPathForRole(user?.role)
  const hasRolePanel = rolePanelPath !== '/'

  const myLoans = finance.loans.filter((l) => l.requesterId === String(user?.id))
  const activeLoansCount = myLoans.filter((l) => l.status === 'approved' || l.status === 'pending_chair' || l.status === 'pending_treasury' || l.status === 'pending_audit' || l.status === 'pending_disbursal').length

  // Consistency: contributions in last 3 months vs expected (3 * contribution)
  const threeMonthsAgo = new Date()
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
  const recentContributions = myGroups.reduce(
    (sum, g) => sum + (g.records || []).filter((r) => r.memberId === user?.id && new Date(r.date) >= threeMonthsAgo).length,
    0,
  )
  const expectedContributions = myGroups.length * 3
  const consistencyScore = expectedContributions > 0 ? Math.round((recentContributions / expectedContributions) * 100) : 0

  // My share percentage across all my groups
  const mySharePercentage = totalGroupSavings > 0 ? ((myContributions / totalGroupSavings) * 100).toFixed(1) : '0.0'

  // Per-group breakdown: my contribution, group total, my share %
  const groupBreakdown = myGroups.map((g) => {
    const groupTotal = (g.records || []).reduce((s, r) => s + r.amount, 0)
    const myInGroup = (g.records || []).filter((r) => r.memberId === user?.id).reduce((s, r) => s + r.amount, 0)
    const share = groupTotal > 0 ? ((myInGroup / groupTotal) * 100).toFixed(1) : '0.0'
    return { group: g, groupTotal, myInGroup, share }
  })

  // Recent contributions across all my groups (latest 5)
  const allMyRecords = myGroups
    .flatMap((g) => (g.records || []).filter((r) => r.memberId === user?.id).map((r) => ({ ...r, groupName: g.name })))
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5)

  return (
    <div className="page home-page">
      <div className="welcome-banner">
        <div className="welcome-text">
          <div className="page-kicker">Shared Member Dashboard</div>
          <h2 className="welcome-name">{user?.fullName}</h2>
          <div className={`role-badge member`}>
            {user?.role.toUpperCase()}
          </div>
        </div>
        <div className="welcome-mark">F</div>
      </div>

      {hasRolePanel && (
        <div className="section-block">
          <div className="section-heading">
            <span>Your Panel</span>
          </div>
          <div className="card-box">
            <p className="subcopy" style={{ marginBottom: '1rem' }}>
              Your account is assigned the <strong>{user?.role}</strong> role, so you also have access to your dedicated panel.
            </p>
            <Link to={rolePanelPath} className="btn gold">
              Open {user?.role?.charAt(0).toUpperCase()}{user?.role?.slice(1)} Panel
            </Link>
          </div>
        </div>
      )}

      <div className="stats-grid">
        <div className="stat-tile teal">
          <div className="stat-icon">💰</div>
          <div className="stat-value">UGX {myContributions.toLocaleString()}</div>
          <div className="stat-label">My Contributions</div>
        </div>
        <div className="stat-tile blue">
          <div className="stat-icon">¤</div>
          <div className="stat-value">{activeLoansCount} Active</div>
          <div className="stat-label">My Loans & Status</div>
        </div>
        <div className="stat-tile gold">
          <div className="stat-icon">▤</div>
          <div className="stat-value">UGX {totalGroupSavings.toLocaleString()}</div>
          <div className="stat-label">Group Savings Total</div>
        </div>
        <div className="stat-tile green">
          <div className="stat-icon">⭐</div>
          <div className="stat-value">{consistencyScore}%</div>
          <div className="stat-label">Consistency Score</div>
        </div>
      </div>

      <div className="section-block">
        <div className="section-heading"><span>My Contribution Share</span></div>
        <div className="card-box">
          <div className="info-row" style={{ marginBottom: '1rem' }}>
            <span>My share of total group savings</span>
            <strong style={{ fontSize: '1.4rem', color: 'var(--teal)' }}>{mySharePercentage}%</strong>
          </div>
          <div className="progress-track" style={{ height: '12px', background: 'var(--line)', borderRadius: '6px', overflow: 'hidden' }}>
            <div className="progress-fill" style={{ width: `${Math.min(parseFloat(mySharePercentage), 100)}%`, height: '100%', background: 'linear-gradient(135deg, var(--teal), #1dbf84)', transition: 'width 0.6s ease' }} />
          </div>
          <div className="info-row" style={{ marginTop: '0.5rem' }}>
            <span className="text-muted text-sm">UGX {myContributions.toLocaleString()} of UGX {totalGroupSavings.toLocaleString()}</span>
          </div>
        </div>

        {groupBreakdown.length > 0 && (
          <div className="card-box" style={{ marginTop: '1rem' }}>
            <div className="section-heading"><span>Per-Group Breakdown</span></div>
            {groupBreakdown.map(({ group, groupTotal, myInGroup, share }) => (
              <div key={group.id} style={{ marginBottom: '1rem' }}>
                <div className="info-row">
                  <span><strong>{group.name}</strong></span>
                  <span>{share}%</span>
                </div>
                <div className="progress-track" style={{ height: '8px', background: 'var(--line)', borderRadius: '4px', overflow: 'hidden', marginTop: '4px' }}>
                  <div className="progress-fill" style={{ width: `${Math.min(parseFloat(share), 100)}%`, height: '100%', background: 'linear-gradient(135deg, var(--gold), #c99723)' }} />
                </div>
                <div className="info-row" style={{ marginTop: '2px' }}>
                  <span className="text-muted text-sm">UGX {myInGroup.toLocaleString()} of UGX {groupTotal.toLocaleString()}</span>
                  <Link to={`/groups/${group.id}/records`} className="link-action text-sm">View Records</Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="section-block">
        <div className="section-heading">
          <span>Notices & Deadlines</span>
        </div>
        {myGroups[0] && (
          <div className="alert-card" style={{ marginBottom: '1rem' }}>
            <div className="alert-icon">🔔</div>
            <div className="alert-body">
              <div className="alert-title">Upcoming Contribution</div>
              <p className="alert-msg">Your {myGroups[0].frequency} contribution of UGX {myGroups[0].contribution?.toLocaleString()} is due soon.</p>
            </div>
            <Link to={`/groups/${myGroups[0].id}/submit`} className="btn">Pay Now</Link>
          </div>
        )}
        {!myGroups[0] && (
          <div className="alert-card" style={{ marginBottom: '1rem' }}>
            <div className="alert-icon">📋</div>
            <div className="alert-body">
              <div className="alert-title">Get Started</div>
              <p className="alert-msg">You are not in any groups yet. Join a group to start contributing.</p>
            </div>
            <Link to="/groups" className="btn">Browse Groups</Link>
          </div>
        )}

        {inbox.length > 0 && (
          <div className="list-group">
            {inbox.slice(0, 5).map((m) => (
              <div key={m.id} className="list-item">
                <div className="list-icon" style={{ background: 'var(--gold)', color: 'white' }}>
                  {MESSAGE_ICON[m.type] || '🔔'}
                </div>
                <div className="list-text">
                  <div>{m.message}</div>
                  <small className="text-muted">{m.groupName} - from {m.sender} - {new Date(m.createdAt).toLocaleDateString()}</small>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {allMyRecords.length > 0 && (
        <div className="section-block">
          <div className="section-heading"><span>Recent Contributions</span></div>
          <div className="list-group">
            {allMyRecords.map((r) => (
              <div key={r.id} className="list-item">
                <div className="list-icon" style={{ background: 'var(--teal)', color: 'white' }}>💰</div>
                <div className="list-text">
                  <div><strong>UGX {r.amount.toLocaleString()}</strong> - {r.groupName}</div>
                  <small className="text-muted">{r.method} - {new Date(r.date).toLocaleDateString()}</small>
                </div>
                <span className="pill success">Confirmed</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="section-block">
        <div className="section-heading"><span>Quick Actions</span></div>
        <div className="quick-actions">
          {myGroups[0] && (
            <Link to={`/groups/${myGroups[0].id}/submit`} className="quick-action-card gold">
              <span className="qa-icon">↑</span>
              <span>Submit Contribution</span>
            </Link>
          )}
          <Link to="/loans" className="quick-action-card blue">
            <span className="qa-icon">¤</span>
            <span>Loans</span>
          </Link>
          <Link to="/goals" className="quick-action-card green">
            <span className="qa-icon">◎</span>
            <span>Goals</span>
          </Link>
          <Link to="/profile" className="quick-action-card teal">
            <span className="qa-icon">◔</span>
            <span>Profile</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
