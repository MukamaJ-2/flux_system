import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { API_URL, SUPABASE_ANON_KEY } from '../config'

const FinanceContext = createContext(null)

function getToken() {
  return localStorage.getItem('flux_access_token')
}

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${getToken()}`,
    apikey: SUPABASE_ANON_KEY,
  }
}

export function FinanceProvider({ children }) {
  const [finance, setFinance] = useState({ loans: [], goals: [] })

  // ─── Initial load ─────────────────────────────────────────────────────────
  const fetchFinance = useCallback(async () => {
    const token = getToken()
    if (!token) return

    try {
      const [loansRes, goalsRes] = await Promise.all([
        fetch(`${API_URL}/loans/`, { headers: authHeaders() }),
        fetch(`${API_URL}/goals/`, { headers: authHeaders() }),
      ])

      const loans = loansRes.ok ? await loansRes.json() : []
      const goals = goalsRes.ok ? await goalsRes.json() : []

      setFinance({ loans, goals })
    } catch (e) {
      console.error('Failed to fetch finance data', e)
    }
  }, [])

  useEffect(() => {
    fetchFinance()
  }, [fetchFinance])

  // ─── Loans ────────────────────────────────────────────────────────────────

  /**
   * Submit a new loan request.
   * payload shape: { id, title, group (id), amount, interestRate, type, installments,
   *                  frequency, startDate, reason, requesterId, requesterName }
   */
  async function addLoan(loan) {
    try {
      const payload = {
        id: loan.id || `loan-${Date.now().toString(36)}`,
        group: loan.groupId || loan.group,
        title: loan.title,
        amount: loan.amount,
        interestRate: loan.interestRate || 0,
        type: loan.type || 'Flat Rate',
        installments: loan.installments || 1,
        frequency: loan.frequency || 'Monthly',
        startDate: loan.startDate || '',
        reason: loan.reason || '',
      }
      const res = await fetch(`${API_URL}/loans/`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        const created = await res.json()
        setFinance((f) => ({ ...f, loans: [created, ...f.loans] }))
        return { success: true, loan: created }
      }
      const err = await res.json().catch(() => ({}))
      return { success: false, error: err.detail || 'Failed to submit loan' }
    } catch (e) {
      return { success: false, error: e.message }
    }
  }

  async function updateLoan(id, patch) {
    try {
      const res = await fetch(`${API_URL}/loans/${id}/`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify(patch),
      })
      if (res.ok) {
        const updated = await res.json()
        setFinance((f) => ({
          ...f,
          loans: f.loans.map((l) => (l.id === id ? updated : l)),
        }))
        return { success: true }
      }
      return { success: false }
    } catch (e) {
      return { success: false, error: e.message }
    }
  }

  async function decideLoanRequest(id, approved, adminName) {
    try {
      const res = await fetch(`${API_URL}/loans/${id}/advance/`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ approved }),
      })
      if (res.ok) {
        const updated = await res.json()
        setFinance((f) => ({
          ...f,
          loans: f.loans.map((l) => (l.id === id ? updated : l)),
        }))
        return { success: true, loan: updated }
      }
      const err = await res.json().catch(() => ({}))
      return { success: false, error: err.error || 'Failed to advance loan' }
    } catch (e) {
      return { success: false, error: e.message }
    }
  }

  async function advanceLoan(id, approved = true) {
    return decideLoanRequest(id, approved)
  }

  async function disburseLoan(id) {
    try {
      const res = await fetch(`${API_URL}/loans/${id}/disburse/`, {
        method: 'PATCH',
        headers: authHeaders(),
      })
      if (res.ok) {
        const updated = await res.json()
        setFinance((f) => ({
          ...f,
          loans: f.loans.map((l) => (l.id === id ? updated : l)),
        }))
        return { success: true }
      }
      const err = await res.json().catch(() => ({}))
      return { success: false, error: err.error || 'Failed to disburse loan' }
    } catch (e) {
      return { success: false, error: e.message }
    }
  }

  async function repayLoan(id, amount) {
    try {
      const res = await fetch(`${API_URL}/loans/${id}/repay/`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ amount }),
      })
      if (res.ok) {
        const updated = await res.json()
        setFinance((f) => ({
          ...f,
          loans: f.loans.map((l) => (l.id === id ? updated : l)),
        }))
        return { success: true }
      }
      return { success: false }
    } catch (e) {
      return { success: false, error: e.message }
    }
  }

  // ─── Goals ────────────────────────────────────────────────────────────────

  /**
   * Create a new savings goal.
   * payload shape: { id, title, targetAmount, savedAmount, targetDate,
   *                  linkedGroupId, notes, userId }
   */
  async function addGoal(goal) {
    try {
      const payload = {
        id: goal.id || `goal-${Date.now().toString(36)}`,
        title: goal.title,
        targetAmount: goal.targetAmount,
        savedAmount: goal.savedAmount || 0,
        targetDate: goal.targetDate,
        linkedGroupId: goal.linkedGroupId || '',
        notes: goal.notes || '',
        userId: goal.userId || undefined,
      }
      const res = await fetch(`${API_URL}/goals/`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        const created = await res.json()
        setFinance((f) => ({ ...f, goals: [created, ...f.goals] }))
        return { success: true, goal: created }
      }
      const err = await res.json().catch(() => ({}))
      return { success: false, error: err.detail || 'Failed to create goal' }
    } catch (e) {
      return { success: false, error: e.message }
    }
  }

  async function updateGoal(id, patch) {
    try {
      const res = await fetch(`${API_URL}/goals/${id}/`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify(patch),
      })
      if (res.ok) {
        const updated = await res.json()
        setFinance((f) => ({
          ...f,
          goals: f.goals.map((g) => (g.id === id ? updated : g)),
        }))
        return { success: true }
      }
      return { success: false }
    } catch (e) {
      return { success: false, error: e.message }
    }
  }

  async function decideGoalRequest(id, approved, adminName) {
    try {
      const res = await fetch(`${API_URL}/goals/${id}/decide/`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ approved }),
      })
      if (res.ok) {
        const updated = await res.json()
        setFinance((f) => ({
          ...f,
          goals: f.goals.map((g) => (g.id === id ? updated : g)),
        }))
        return { success: true }
      }
      const err = await res.json().catch(() => ({}))
      return { success: false, error: err.error || 'Failed to decide goal' }
    } catch (e) {
      return { success: false, error: e.message }
    }
  }

  async function saveGoalProgress(id, amount) {
    try {
      const res = await fetch(`${API_URL}/goals/${id}/save/`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ amount }),
      })
      if (res.ok) {
        const updated = await res.json()
        setFinance((f) => ({
          ...f,
          goals: f.goals.map((g) => (g.id === id ? updated : g)),
        }))
        return { success: true }
      }
      return { success: false }
    } catch (e) {
      return { success: false, error: e.message }
    }
  }

  return (
    <FinanceContext.Provider
      value={{
        finance,
        refreshFinance: fetchFinance,
        // Loans
        addLoan,
        updateLoan,
        decideLoanRequest,
        advanceLoan,
        disburseLoan,
        repayLoan,
        // Goals
        addGoal,
        updateGoal,
        decideGoalRequest,
        saveGoalProgress,
      }}
    >
      {children}
    </FinanceContext.Provider>
  )
}

export function useFinance() {
  return useContext(FinanceContext)
}
