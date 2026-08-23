import React from 'react'

/**
 * Lets a user who belongs to more than one group pick which one this
 * dashboard applies to. Renders nothing when there's only one group,
 * since a picker with a single option is just noise.
 */
export default function GroupSwitcher({ groups, activeGroupId, onChange }) {
  if (!groups || groups.length <= 1) return null

  return (
    <div className="group-switcher" style={{ marginBottom: '20px' }}>
      <label htmlFor="group-switcher-select" style={{ fontSize: '0.8rem', fontWeight: 600, marginRight: '8px' }}>
        Group
      </label>
      <select
        id="group-switcher-select"
        className="form-input"
        style={{ width: 'auto', display: 'inline-block' }}
        value={activeGroupId}
        onChange={(e) => onChange(e.target.value)}
      >
        {groups.map((g) => (
          <option key={g.id} value={g.id}>{g.name}</option>
        ))}
      </select>
    </div>
  )
}
