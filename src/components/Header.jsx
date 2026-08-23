import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

export default function Header() {
  const location = useLocation()
  const navigate = useNavigate()
  const isInnerScreen =
    location.pathname.startsWith('/groups/') ||
    location.pathname === '/groups/new' ||
    location.pathname === '/loans/new' ||
    location.pathname === '/goals/new' ||
    location.pathname === '/login' ||
    location.pathname === '/profile/edit' ||
    location.pathname === '/settings'

  if (!isInnerScreen) {
    return null
  }

  let title = 'Flux'
  if (location.pathname.includes('/records')) title = 'Flux — Records'
  else if (location.pathname.includes('/settings')) title = 'Group Settings'
  else if (location.pathname.includes('/record')) title = 'Record Contribution'
  else if (location.pathname.includes('/new')) title = 'Create Group'
  else if (location.pathname === '/loans/new') title = 'Request Loan'
  else if (location.pathname === '/goals/new') title = 'Create Goal'

  return (
    <header className="app-header">
      <div className="header-inner">
        <button type="button" className="back-button" onClick={() => navigate(-1)} aria-label="Go back">
          ←
        </button>
        <h1 className="app-title">{title}</h1>
        <div className="header-spacer" />
      </div>
    </header>
  )
}
