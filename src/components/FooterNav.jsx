import React from 'react'
import { Link, useLocation } from 'react-router-dom'

export default function FooterNav() {
  const loc = useLocation()

  if (!(
    loc.pathname === '/' ||
    loc.pathname === '/groups' ||
    loc.pathname === '/loans' ||
    loc.pathname === '/goals' ||
    loc.pathname === '/profile'
  )) {
    return null
  }

  return (
    <footer className="bottom-nav">
      <div className="bottom-nav-inner">
        <Link to="/" className={loc.pathname === '/' ? 'active' : ''}>
          <span className="icon">⌂</span>
          <span className="label">Home</span>
        </Link>
        <Link to="/groups" className={loc.pathname === '/groups' ? 'active' : ''}>
          <span className="icon">◌</span>
          <span className="label">Groups</span>
        </Link>
        <Link to="/loans" className={loc.pathname === '/loans' ? 'active' : ''}>
          <span className="icon">¤</span>
          <span className="label">Loans</span>
        </Link>
        <Link to="/goals" className={loc.pathname === '/goals' ? 'active' : ''}>
          <span className="icon">◎</span>
          <span className="label">Goals</span>
        </Link>
        <Link to="/profile" className={loc.pathname === '/profile' ? 'active' : ''}>
          <span className="icon">◔</span>
          <span className="label">Profile</span>
        </Link>
      </div>
    </footer>
  )
}
