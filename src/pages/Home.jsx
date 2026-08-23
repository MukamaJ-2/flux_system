import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { API_URL, SUPABASE_ANON_KEY } from '../config'

function currentPeriod() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
}

const STATUS_LABEL = { pending: 'Pending Review', approved: 'Approved', partial: 'Partial', rejected: 'Rejected' }
const STATUS_PILL = { pending: 'warning', approved: 'success', partial: 'warning', rejected: 'danger' }
const DECIDABLE_LOAN_STAGES = ['requested', 'pending_second_approval']
const NOTICE_ICON = { meeting_reminder: '📅', deadline_reminder: '⏰', general: '🔔' }

export default function Home() {
  const { session, profile, hasAnyRole } = useAuth()
  const isReviewer = hasAnyRole('treasurer', 'chair')
  const [summary, setSummary] = useState(null)
  const [myContribution, setMyContribution] = useState(null)
  const [pendingContributions, setPendingContributions] = useState(0)
  const [pendingLoans, setPendingLoans] = useState(0)
  const [notices, setNotices] = useState([])

  useEffect(() => {
    let cancelled = false
    async function fetchData() {
      const headers = { Authorization: `Bearer ${session.access_token}`, apikey: SUPABASE_ANON_KEY }
      try {
        const [summaryRes, contribRes, loansRes, noticesRes] = await Promise.all([
          fetch(`${API_URL}/ledger/summary/`, { headers }),
          fetch(`${API_URL}/contributions/?period=${currentPeriod()}`, { headers }),
          isReviewer ? fetch(`${API_URL}/loans/`, { headers }) : Promise.resolve(null),
          fetch(`${API_URL}/notifications/`, { headers }),
        ])
        if (cancelled) return
        if (summaryRes.ok) setSummary(await summaryRes.json())
        if (contribRes.ok) {
          const rows = await contribRes.json()
          setMyContribution(rows.filter((c) => c.memberId === profile?.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || null)
          if (isReviewer) setPendingContributions(rows.filter((c) => c.status === 'pending' && c.memberId !== profile?.id).length)
        }
        if (loansRes?.ok) {
          const rows = await loansRes.json()
          setPendingLoans(rows.filter((l) => DECIDABLE_LOAN_STAGES.includes(l.status) && l.borrowerId !== profile?.id).length)
        }
        if (noticesRes.ok) {
          const rows = await noticesRes.json()
          setNotices(rows.filter((n) => n.member_id === profile?.id).slice(0, 5))
        }
      } catch (e) {
        console.error('Failed to fetch dashboard data', e)
      }
    }
    if (session && profile) fetchData()
    return () => { cancelled = true }
  }, [session, profile, isReviewer])

  return (
    <div className="page home-page">
      <div className="welcome-banner">
        <div className="welcome-text">
          <div className="page-kicker">Flux</div>
          <h2 className="welcome-name">{profile?.fullName}</h2>
          {(profile?.roles || []).map((r) => (
            <span key={r} className="role-badge member" style={{ marginRight: '6px' }}>{r.toUpperCase()}</span>
          ))}
        </div>
        <div className="welcome-mark">F</div>
      </div>

      <div className="stats-grid">
        <div className="stat-tile teal">
          <div className="stat-icon">💰</div>
          <div className="stat-value">UGX {(summary?.myTotal || 0).toLocaleString()}</div>
          <div className="stat-label">My Balance</div>
        </div>
        <div className="stat-tile gold">
          <div className="stat-icon">▤</div>
          <div className="stat-value">UGX {(summary?.groupTotal || 0).toLocaleString()}</div>
          <div className="stat-label">Group Fund Total</div>
        </div>
      </div>

      {isReviewer && (pendingContributions > 0 || pendingLoans > 0) && (
        <div className="section-block">
          <div className="section-heading"><span>Needs Your Attention</span></div>
          <div className="quick-actions">
            {pendingContributions > 0 && (
              <Link to="/contributions" className="quick-action-card gold">
                <span className="qa-icon">💰</span>
                <span>{pendingContributions} Contribution{pendingContributions === 1 ? '' : 's'} to Review</span>
              </Link>
            )}
            {pendingLoans > 0 && (
              <Link to="/loans" className="quick-action-card blue">
                <span className="qa-icon">¤</span>
                <span>{pendingLoans} Loan{pendingLoans === 1 ? '' : 's'} to Decide</span>
              </Link>
            )}
          </div>
        </div>
      )}

      <div className="section-block">
        <div className="section-heading"><span>Your Most Recent Contribution</span></div>
        <div className="alert-card">
          <div className="alert-icon">💰</div>
          <div className="alert-body">
            {myContribution ? (
              <>
                <div className="alert-title">UGX {myContribution.amountPaid.toLocaleString()}</div>
                <p className="alert-msg">
                  <span className={`pill ${STATUS_PILL[myContribution.status]}`}>{STATUS_LABEL[myContribution.status]}</span>
                </p>
              </>
            ) : (
              <>
                <div className="alert-title">Nothing logged yet</div>
                <p className="alert-msg">Log a contribution any time — there's no limit.</p>
              </>
            )}
          </div>
          <Link to="/contributions" className="btn">{myContribution ? 'View All' : 'Log Now'}</Link>
        </div>
      </div>

      {notices.length > 0 && (
        <div className="section-block">
          <div className="section-heading"><span>Notices</span></div>
          <div className="list-group">
            {notices.map((n) => (
              <div key={n.id} className="list-item">
                <div className="list-icon" style={{ background: 'var(--gold)', color: 'white' }}>{NOTICE_ICON[n.type] || '🔔'}</div>
                <div className="list-text">
                  <div>{n.payload}</div>
                  <small className="text-muted">{new Date(n.sent_at).toLocaleDateString()}</small>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
