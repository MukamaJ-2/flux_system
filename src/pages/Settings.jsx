import React, { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { API_URL, SUPABASE_ANON_KEY } from '../config'

const FIELDS = [
  { key: 'name', label: 'Group Name', type: 'text' },
  { key: 'contributionAmount', label: 'Contribution Amount (UGX)', type: 'number' },
  { key: 'frequency', label: 'Contribution Frequency', type: 'select', options: ['Daily', 'Weekly', 'Monthly'] },
  { key: 'contributionDeadlineDay', label: 'Contribution Deadline (day of month)', type: 'number' },
  { key: 'interestRate', label: 'Loan Interest Rate (%)', type: 'number' },
  { key: 'interestType', label: 'Interest Type', type: 'select', options: ['Flat Rate', 'Reducing Balance'] },
]

const ELIGIBILITY_FIELDS = [
  { key: 'minMembershipMonths', label: 'Minimum Membership (months) before a loan', type: 'number' },
  { key: 'maxLoanMultipleOfSavings', label: 'Max Loan as a Multiple of Own Savings', type: 'number' },
  { key: 'maxLoanPercentOfFund', label: 'Max Loan as % of Group Fund', type: 'number' },
]

export default function Settings() {
  const { session } = useAuth()
  const [form, setForm] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  function authHeaders() {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      apikey: SUPABASE_ANON_KEY,
    }
  }

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/settings/`, { headers: authHeaders() })
      if (res.ok) {
        const s = await res.json()
        setForm({
          name: s.name,
          contributionAmount: s.contribution_amount,
          frequency: s.frequency,
          contributionDeadlineDay: s.contribution_deadline_day,
          interestRate: s.interest_rate,
          interestType: s.interest_type,
          minMembershipMonths: s.min_membership_months,
          maxLoanMultipleOfSavings: s.max_loan_multiple_of_savings,
          maxLoanPercentOfFund: s.max_loan_percent_of_fund,
        })
      }
    } catch (e) {
      console.error('Failed to fetch settings', e)
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  async function handleSave(e) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const res = await fetch(`${API_URL}/settings/`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Failed to save settings.')
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(err.message)
    }
    setSaving(false)
  }

  if (loading || !form) return <div className="page">Loading…</div>

  return (
    <div className="page">
      <div className="page-intro">
        <div className="page-intro-icon teal">⚙</div>
        <div>
          <div className="page-kicker">Chair</div>
          <h2>Group Settings</h2>
        </div>
      </div>

      <form onSubmit={handleSave} className="flux-form">
        {error && <div className="alert alert-danger"><span>⚠</span> {error}</div>}

        <div className="section-block">
          <div className="section-heading"><span>Contributions & Interest</span></div>
          <div className="card-box">
            {FIELDS.map((f) => (
              <div className="field-group" key={f.key} style={{ marginBottom: '12px' }}>
                <label>{f.label}</label>
                {f.type === 'select' ? (
                  <select value={form[f.key] || ''} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}>
                    {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input
                    type={f.type}
                    value={form[f.key] ?? ''}
                    onChange={(e) => setForm({ ...form, [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value })}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="section-block">
          <div className="section-heading"><span>Loan Eligibility</span></div>
          <div className="card-box">
            {ELIGIBILITY_FIELDS.map((f) => (
              <div className="field-group" key={f.key} style={{ marginBottom: '12px' }}>
                <label>{f.label}</label>
                <input
                  type="number"
                  value={form[f.key] ?? ''}
                  onChange={(e) => setForm({ ...form, [f.key]: Number(e.target.value) })}
                />
              </div>
            ))}
          </div>
        </div>

        <button type="submit" className="btn" disabled={saving}>
          {saving ? <span className="spinner" /> : 'Save Settings'}
        </button>
        {saved && <span className="text-success" style={{ marginLeft: '12px' }}>Saved.</span>}
      </form>
    </div>
  )
}
