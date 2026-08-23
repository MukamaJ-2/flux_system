import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function FooterNav() {
  const loc = useLocation()
  const { profile } = useAuth()

  const FOOTER_PATHS = ['/', '/contributions', '/loans', '/members', '/profile']
  if (!FOOTER_PATHS.includes(loc.pathname)) {
    return null
  }

  return (
    <footer className="bottom-nav">
      <div className="bottom-nav-inner">
        <Link to="/" className={loc.pathname === '/' ? 'active' : ''}>
          <span className="icon">⌂</span>
          <span className="label">Home</span>
        </Link>
        <Link to="/contributions" className={loc.pathname === '/contributions' ? 'active' : ''}>
          <span className="icon">💰</span>
          <span className="label">Contributions</span>
        </Link>
        <Link to="/loans" className={loc.pathname === '/loans' ? 'active' : ''}>
          <span className="icon">¤</span>
          <span className="label">Loans</span>
        </Link>
        {profile?.roles?.includes('chair') && (
          <Link to="/members" className={loc.pathname === '/members' ? 'active' : ''}>
            <span className="icon">◔</span>
            <span className="label">Members</span>
          </Link>
        )}
        <Link to="/profile" className={loc.pathname === '/profile' ? 'active' : ''}>
          <span className="icon">◎</span>
          <span className="label">Profile</span>
        </Link>
      </div>
    </footer>
  )
}
