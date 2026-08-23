import React, { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useGroups } from '../context/GroupsContext'

const NAV_LINKS = [
  { to: '/', label: 'Dashboard', icon: '⌂', exact: true },
  { to: '/groups', label: 'Groups', icon: '◌' },
  { to: '/loans', label: 'Loans', icon: '¤' },
  { to: '/goals', label: 'Goals', icon: '◎' },
  { to: '/voting', label: 'Voting Booth', icon: '🗳️' },
  { to: '/chair', label: 'Chair Panel', icon: '⚖', roleOnly: ['chair', 'sysadmin'] },
  { to: '/treasury', label: 'Treasury Panel', icon: '💰', roleOnly: ['treasury', 'sysadmin'] },
  { to: '/secretary', label: 'Secretary Panel', icon: '📋', roleOnly: ['secretary', 'sysadmin'] },
  { to: '/audit', label: 'Audit Panel', icon: '🔍', roleOnly: ['audit', 'sysadmin'] },
  { to: '/mobilizer', label: 'Mobilizer Panel', icon: '📣', roleOnly: ['mobilizer', 'sysadmin'] },
  { to: '/admin', label: 'Sysadmin Panel', icon: '⚙', roleOnly: ['sysadmin'] },
  { to: '/profile', label: 'Profile', icon: '◔' },
]

export default function Sidebar() {
  const { user, signOut } = useAuth()
  const { data } = useGroups()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)

  if (!user) return null

  const pendingCount = data.groups.reduce(
    (sum, g) => sum + (g.requests || []).filter((r) => r.status === 'pending' || r.status === 'pending_secretary' || r.status === 'pending_treasury').length,
    0,
  )

  function handleSignOut() {
    signOut()
    navigate('/login')
  }

  const links = NAV_LINKS.filter((l) => {
    if (l.roleOnly && !l.roleOnly.includes(user.role)) return false
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
                {!collapsed && (
                  <span className="sidebar-label">
                    {link.label}
                    {link.label === 'Sysadmin Panel' && pendingCount > 0 && (
                      <span className="sidebar-badge">{pendingCount}</span>
                    )}
                  </span>
                )}
                {collapsed && link.label === 'Sysadmin Panel' && pendingCount > 0 && (
                  <span className="sidebar-badge-dot" />
                )}
              </NavLink>
            </li>
          ))}
        </ul>

        <div className="sidebar-user">
          <div className="sidebar-avatar">{user.avatar || user.fullName?.slice(0, 2).toUpperCase()}</div>
          {!collapsed && (
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{user.fullName}</div>
              <div className="sidebar-user-role">{user.role}</div>
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
