import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { API_URL, SUPABASE_ANON_KEY } from '../config'

const GroupsContext = createContext(null)

function getToken() {
  return localStorage.getItem('flux_access_token')
}

export function getGroupRole(group, user) {
  if (!group || !user) return null
  return group.members.find((m) => m.id === user.id)?.role || null
}

export function isGroupAdmin(group, user) {
  return getGroupRole(group, user) === 'admin'
}

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${getToken()}`,
    apikey: SUPABASE_ANON_KEY,
  }
}

export function GroupsProvider({ children }) {
  const [data, setData] = useState({ groups: [] })

  // ─── Fetch ────────────────────────────────────────────────────────────────
  const fetchGroups = useCallback(async () => {
    try {
      const token = getToken()
      if (!token) return
      const res = await fetch(`${API_URL}/groups/`, { headers: authHeaders() })
      if (res.ok) {
        const groups = await res.json()
        setData({ groups })
      }
    } catch (e) {
      console.error('Failed to fetch groups', e)
    }
  }, [])

  useEffect(() => {
    fetchGroups()
  }, [fetchGroups])

  // ─── Create Group ─────────────────────────────────────────────────────────
  async function createGroup(group) {
    try {
      const res = await fetch(`${API_URL}/groups/`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(group),
      })
      if (res.ok) {
        const created = await res.json()
        setData((d) => ({ groups: [...d.groups, created] }))
        return { success: true, id: created.id }
      }
      const err = await res.json().catch(() => ({}))
      return { success: false, error: err.detail || JSON.stringify(err) || 'Failed to create group' }
    } catch (e) {
      return { success: false, error: e.message }
    }
  }

  // ─── Update Group settings ────────────────────────────────────────────────
  async function updateGroup(id, patch) {
    try {
      const res = await fetch(`${API_URL}/groups/${id}/`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify(patch),
      })
      if (res.ok) {
        const updated = await res.json()
        setData((d) => ({
          groups: d.groups.map((g) => (g.id === id ? updated : g)),
        }))
        return { success: true }
      }
      const err = await res.json().catch(() => ({}))
      return { success: false, error: err.detail || 'Failed to update group' }
    } catch (e) {
      return { success: false, error: e.message }
    }
  }

  // ─── Delete Group ─────────────────────────────────────────────────────────
  async function deleteGroup(id) {
    try {
      const res = await fetch(`${API_URL}/groups/${id}/`, {
        method: 'DELETE',
        headers: authHeaders(),
      })
      if (res.ok || res.status === 204) {
        setData((d) => ({ groups: d.groups.filter((g) => g.id !== id) }))
        return { success: true }
      }
      const err = await res.json().catch(() => ({}))
      return { success: false, error: err.error || 'Failed to delete group' }
    } catch (e) {
      return { success: false, error: e.message }
    }
  }

  // ─── Join Group by invite code ────────────────────────────────────────────
  async function joinGroup(inviteCode) {
    try {
      const res = await fetch(`${API_URL}/groups/join/`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ inviteCode }),
      })
      if (res.ok) {
        const body = await res.json()
        setData((d) => ({ groups: [...d.groups, body.group] }))
        return { success: true, group: body.group }
      }
      const err = await res.json().catch(() => ({}))
      return { success: false, error: err.error || 'Invalid invite code' }
    } catch (e) {
      return { success: false, error: e.message }
    }
  }

  // ─── Member Management ────────────────────────────────────────────────────
  async function addMember(groupId, { name, email }) {
    try {
      const res = await fetch(`${API_URL}/groups/${groupId}/members/`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ name, email }),
      })
      if (res.ok) {
        const created = await res.json()
        // Refresh groups to get updated member list
        await fetchGroups()
        return { success: true, data: created, default_password: created.default_password }
      }
      const err = await res.json().catch(() => ({}))
      return { success: false, error: err.error || 'Failed to add member' }
    } catch (e) {
      return { success: false, error: e.message }
    }
  }

  async function removeMember(groupId, memberId) {
    try {
      const res = await fetch(`${API_URL}/groups/${groupId}/members/${memberId}/`, {
        method: 'DELETE',
        headers: authHeaders(),
      })
      if (res.ok) {
        setData((d) => ({
          groups: d.groups.map((g) =>
            g.id === groupId
              ? { ...g, members: g.members.filter((m) => m.id !== memberId) }
              : g
          ),
        }))
        return { success: true }
      }
      const err = await res.json().catch(() => ({}))
      return { success: false, error: err.error || 'Failed to remove member' }
    } catch (e) {
      return { success: false, error: e.message }
    }
  }

  async function editMember(groupId, memberId, newName, newEmail) {
    try {
      const res = await fetch(`${API_URL}/groups/${groupId}/members/${memberId}/`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ name: newName, email: newEmail }),
      })
      if (res.ok) {
        await fetchGroups()
        return { success: true }
      }
      const err = await res.json().catch(() => ({}))
      return { success: false, error: err.error || 'Failed to edit member' }
    } catch (e) {
      return { success: false, error: e.message }
    }
  }

  // ─── Contribution Requests ────────────────────────────────────────────────
  async function submitRequest(groupId, request) {
    try {
      const payload = {
        id: request.id || `req-${Date.now().toString(36)}`,
        group: groupId,
        type: request.type || 'contribution',
        amount: request.amount,
        title: request.title || request.note || '',
        method: request.method || '',
        note: request.note || '',
        receipt_url: request.receiptUrl || '',
        date: request.date || null,
      }
      const res = await fetch(`${API_URL}/requests/`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        const created = await res.json()
        // Append to the matching group's requests list locally
        setData((d) => ({
          groups: d.groups.map((g) =>
            g.id === groupId
              ? { ...g, requests: [created, ...(g.requests || [])] }
              : g
          ),
        }))
        return { success: true, request: created }
      }
      const err = await res.json().catch(() => ({}))
      return { success: false, error: err.detail || 'Failed to submit request' }
    } catch (e) {
      return { success: false, error: e.message }
    }
  }

  async function decideRequest(groupId, requestId, approved, adminName) {
    try {
      const res = await fetch(`${API_URL}/requests/${requestId}/decide/`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ approved }),
      })
      if (res.ok) {
        const updated = await res.json()
        setData((d) => ({
          groups: d.groups.map((g) =>
            g.id === groupId
              ? { ...g, requests: g.requests.map((r) => (r.id === requestId ? updated : r)) }
              : g
          ),
        }))
        if (approved && updated.type === 'contribution') {
          await fetchGroups()
        }
        return { success: true }
      }
      const err = await res.json().catch(() => ({}))
      return { success: false, error: err.error || 'Failed to decide request' }
    } catch (e) {
      return { success: false, error: e.message }
    }
  }

  async function progressWorkflow(groupId, requestId, nextStatus, actorName, approved = true) {
    try {
      const res = await fetch(`${API_URL}/requests/${requestId}/advance/`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ approved }),
      })
      if (res.ok) {
        const updated = await res.json()
        setData((d) => ({
          groups: d.groups.map((g) =>
            g.id === groupId
              ? { ...g, requests: g.requests.map((r) => (r.id === requestId ? updated : r)) }
              : g
          ),
        }))
        return { success: true, request: updated }
      }
      const err = await res.json().catch(() => ({}))
      return { success: false, error: err.error || 'Failed to advance request' }
    } catch (e) {
      return { success: false, error: e.message }
    }
  }

  // ─── Vote on investment proposal ──────────────────────────────────────────
  async function castVote(groupId, requestId, userId, voteType) {
    try {
      const res = await fetch(`${API_URL}/requests/${requestId}/vote/`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ vote: voteType }),
      })
      if (res.ok) {
        const updated = await res.json()
        setData((d) => ({
          groups: d.groups.map((g) =>
            g.id === groupId
              ? { ...g, requests: g.requests.map((r) => (r.id === requestId ? updated : r)) }
              : g
          ),
        }))
        return { success: true }
      }
      const err = await res.json().catch(() => ({}))
      return { success: false, error: err.error || 'Failed to cast vote' }
    } catch (e) {
      return { success: false, error: e.message }
    }
  }

  // ─── Direct record contribution (admin) ───────────────────────────────────
  async function recordContribution(groupId, record) {
    try {
      const payload = {
        id: record.id || `rec-${Date.now().toString(36)}`,
        group: groupId,
        member: record.memberId,
        amount: record.amount,
        method: record.method || 'Cash',
        note: record.note || '',
        receipt_url: record.receiptUrl || '',
        date: record.date || null,
      }
      const res = await fetch(`${API_URL}/records/`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        const created = await res.json()
        setData((d) => ({
          groups: d.groups.map((g) =>
            g.id === groupId
              ? { ...g, records: [created, ...(g.records || [])] }
              : g
          ),
        }))
        return { success: true }
      }
      const err = await res.json().catch(() => ({}))
      return { success: false, error: err.detail || 'Failed to record contribution' }
    } catch (e) {
      return { success: false, error: e.message }
    }
  }

  return (
    <GroupsContext.Provider
      value={{
        data,
        refreshGroups: fetchGroups,
        createGroup,
        updateGroup,
        deleteGroup,
        joinGroup,
        addMember,
        removeMember,
        editMember,
        submitRequest,
        decideRequest,
        progressWorkflow,
        castVote,
        recordContribution,
      }}
    >
      {children}
    </GroupsContext.Provider>
  )
}

export function useGroups() {
  return useContext(GroupsContext)
}

export default GroupsContext
