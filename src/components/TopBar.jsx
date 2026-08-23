import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'

const TITLES = {
  '/': 'Dashboard',
  '/contributions': 'Contributions',
  '/loans': 'Loans',
  '/meetings': 'Meetings',
  '/investments': 'Investments',
  '/audit': 'Audit',
  '/members': 'Members',
  '/settings': 'Group Settings',
  '/profile': 'Profile',
}

export default function TopBar() {
  const { session, profile } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const location = useLocation()
  const navigate = useNavigate()

  const title = TITLES[location.pathname] || 'FLUX'
  const canGoBack = !Object.keys(TITLES).includes(location.pathname)

  if (!session) return null

  return (
    <header className="topbar">
      <div className="topbar-left">
        {canGoBack && (
          <button className="topbar-back" onClick={() => navigate(-1)} aria-label="Go back">
            ←
          </button>
        )}
        <h1 className="topbar-title">{title}</h1>
      </div>
      <div className="topbar-right">
        <button
          onClick={toggleTheme}
          className="topbar-back"
          aria-label="Toggle Theme"
          style={{ fontSize: '1.2rem' }}
        >
          {theme === 'light' ? '🌙' : '☀️'}
        </button>
        <div className="topbar-user">
          <div className="topbar-avatar">{profile?.avatar || profile?.fullName?.slice(0, 2).toUpperCase()}</div>
          <div className="topbar-info">
            <div className="topbar-name">{profile?.fullName}</div>
            <div className="topbar-role">{(profile?.roles || []).join(', ') || 'Member'}</div>
          </div>
        </div>
      </div>
    </header>
  )
}
