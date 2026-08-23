import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'

const TITLES = {
  '/': 'Dashboard',
  '/groups': 'My Groups',
  '/loans': 'Loans',
  '/goals': 'Goals',
  '/profile': 'Profile',
  '/admin': 'Admin Panel',
  '/join': 'Join a Group',
  '/groups/new': 'Create Group',
}

export default function TopBar() {
  const { user, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const location = useLocation()
  const navigate = useNavigate()

  const title = Object.entries(TITLES).find(([path]) => location.pathname === path)?.[1]
    || (location.pathname.includes('/requests') ? 'Pending Requests'
    : location.pathname.includes('/settings') ? 'Group Settings'
    : location.pathname.includes('/record') ? 'Record Contribution'
    : location.pathname.includes('/submit') ? 'Submit Request'
    : location.pathname.includes('/records') ? 'Contribution Records'
    : location.pathname.includes('/groups/') ? 'Group Details'
    : 'FLUX')

  const canGoBack = !Object.keys(TITLES).includes(location.pathname)

  if (!user) return null

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
          <div className="topbar-avatar">{user.avatar || user.fullName?.slice(0, 2).toUpperCase()}</div>
          <div className="topbar-info">
            <div className="topbar-name">{user.fullName}</div>
            <div className="topbar-role">{user.role}</div>
          </div>
        </div>
      </div>
    </header>
  )
}
