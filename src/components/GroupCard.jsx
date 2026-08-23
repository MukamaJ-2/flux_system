import React from 'react'
import { Link } from 'react-router-dom'

export default function GroupCard({ group }) {
  return (
    <div className="group-card">
      <div className="group-icon">👥</div>
      <div className="group-body">
        <h3 className="group-name">{group.name}</h3>
        <div className="group-meta">
          <span>UGX {group.contribution.toLocaleString()}</span>
          <span>{group.frequency.toLowerCase()}</span>
          <span>{group.members.length} members</span>
        </div>
      </div>
      <span className="pill info">{group.cycle}</span>
      <Link to={`/groups/${group.id}`} className="btn secondary">Open</Link>
    </div>
  )
}
