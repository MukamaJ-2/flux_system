import React, { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const NAV_LINKS = [
  { to: '/', label: 'Dashboard', icon: '⌂', exact: true },
  { to: '/contributions', label: 'Contributions', icon: '💰' },
  { to: '/loans', label: 'Loans', icon: '¤' },
  { to: '/meetings', label: 'Meetings', icon: '📋' },
  { to: '/investments', label: 'Investments', icon: '📈', roleOnly: ['treasurer', 'chair'] },
  { to: '/audit', label: 'Audit', icon: '🔍', roleOnly: ['auditor', 'chair'] },
  { to: '/members', label: 'Members', icon: '◔', roleOnly: ['chair'] },
  { to: '/settings', label: 'Settings', icon: '⚙', roleOnly: ['chair'] },
  { to: '/profile', label: 'Profile', icon: '◎' },
]

export default function Sidebar() {
  const { session, profile, mustSetPassword, signOut } = useAuth()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)

  // Nothing here — including which panels a role unlocks — should be
  // visible until the forced first-login password change is done.
  if (!session || mustSetPassword) return null

  function handleSignOut() {
    signOut()
    navigate('/login')
  }

  const links = NAV_LINKS.filter((l) => {
    if (l.roleOnly && !l.roleOnly.some((r) => profile?.roles?.includes(r))) return false
    return true
  })

  return (
    <>
      <button
        className="sidebar-toggle"
        onClick={() => setCollapsed((c) => !c)}
        aria-label="Toggle sidebar"
      >
        {collapsed ? '▶' : '◀'}
      </button>

      <nav className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-logo">
          <div className="sidebar-logo-mark">F</div>
          {!collapsed && <span className="sidebar-logo-text">FLUX</span>}
        </div>

        <ul className="sidebar-nav">
          {links.map((link) => (
            <li key={link.to}>
              <NavLink
                to={link.to}
                end={link.exact}
                className={({ isActive }) =>
                  `sidebar-link ${isActive ? 'active' : ''}`
                }
              >
                <span className="sidebar-icon">{link.icon}</span>
                {!collapsed && <span className="sidebar-label">{link.label}</span>}
              </NavLink>
            </li>
          ))}
        </ul>

        <div className="sidebar-user">
          <div className="sidebar-avatar">{profile?.avatar || profile?.fullName?.slice(0, 2).toUpperCase()}</div>
          {!collapsed && (
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{profile?.fullName}</div>
              <div className="sidebar-user-role">{(profile?.roles || []).join(', ') || 'Member'}</div>
            </div>
          )}
          {!collapsed && (
            <button className="sidebar-logout" onClick={handleSignOut} title="Sign out">
              ⏏
            </button>
          )}
        </div>
      </nav>
    </>
  )
}
