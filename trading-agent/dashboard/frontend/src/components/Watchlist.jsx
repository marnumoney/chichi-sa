import React, { useEffect, useState } from 'react'
import { fetchWatchlist, saveWatchlist } from '../api.js'

export default function Watchlist() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [validationError, setValidationError] = useState(null)
  const [saveMsg, setSaveMsg] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchWatchlist()
      .then(setData)
      .catch(e => setError(e.message))
  }, [])

  function updateAllocation(index, value) {
    const updated = {
      ...data,
      watchlist: data.watchlist.map((w, i) =>
        i === index ? { ...w, max_allocation_pct: Number(value) } : w
      ),
    }
    const total = updated.watchlist.reduce((s, w) => s + w.max_allocation_pct, 0)
    setValidationError(total > 80 ? `Total ${total.toFixed(1)}% exceeds 80% limit` : null)
    setSaveMsg(null)
    setData(updated)
  }

  async function handleSave() {
    if (validationError) return
    setSaving(true)
    setSaveMsg(null)
    try {
      await saveWatchlist(data)
      setSaveMsg('Saved successfully.')
    } catch (e) {
      setValidationError(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (error) return <div className="error">Error: {error}</div>
  if (!data) return <div className="loading">Loading watchlist...</div>

  const total = data.watchlist.reduce((s, w) => s + w.max_allocation_pct, 0)

  return (
    <div className="card">
      <h2>Watchlist</h2>
      <table className="watchlist-table">
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Description</th>
            <th>Max Allocation %</th>
          </tr>
        </thead>
        <tbody>
          {data.watchlist.map((w, i) => (
            <tr key={w.symbol}>
              <td><strong>{w.symbol}</strong></td>
              <td style={{ color: '#a0aec0' }}>{w.description}</td>
              <td>
                <input
                  type="number"
                  min="1"
                  max="80"
                  value={w.max_allocation_pct}
                  onChange={e => updateAllocation(i, e.target.value)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: '0.75rem', fontSize: '0.875rem', color: '#a0aec0' }}>
        Total: <strong style={{ color: total > 80 ? '#fc8181' : '#68d391' }}>{total.toFixed(1)}%</strong> of 80% max
      </div>
      {validationError && <div className="validation-error">{validationError}</div>}
      {saveMsg && <div className="save-success">{saveMsg}</div>}
      <button
        className="save-btn"
        onClick={handleSave}
        disabled={saving || !!validationError}
      >
        {saving ? 'Saving...' : 'Save Watchlist'}
      </button>
    </div>
  )
}
