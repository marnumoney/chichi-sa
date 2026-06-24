import React, { useEffect, useState } from 'react'
import { fetchPortfolio } from '../api.js'

export default function Portfolio() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchPortfolio()
      .then(setData)
      .catch(e => setError(e.message))
  }, [])

  if (error) return <div className="error">Error: {error}</div>
  if (!data) return <div className="loading">Loading portfolio...</div>

  const fmt = n => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <div>
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card" style={{ flex: 1 }}>
          <div className="stat-label">Cash</div>
          <div className="stat-value">${fmt(data.cash)}</div>
        </div>
        <div className="card" style={{ flex: 1 }}>
          <div className="stat-label">Total Value</div>
          <div className="stat-value">${fmt(data.total_value)}</div>
        </div>
      </div>

      <div className="card">
        <h2>Open Positions</h2>
        {data.positions.length === 0 ? (
          <p style={{ color: '#718096' }}>No open positions.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Qty</th>
                <th>Entry Price</th>
                <th>Current Price</th>
                <th>Market Value</th>
                <th>P&amp;L</th>
              </tr>
            </thead>
            <tbody>
              {data.positions.map(p => {
                const pnlDollar = p.market_value - p.qty * p.avg_entry_price
                const pnlPct = (p.unrealized_plpc * 100).toFixed(2)
                const sign = pnlDollar >= 0 ? '+' : ''
                return (
                  <tr key={p.symbol}>
                    <td><strong>{p.symbol}</strong></td>
                    <td>{p.qty}</td>
                    <td>${fmt(p.avg_entry_price)}</td>
                    <td>${fmt(p.current_price)}</td>
                    <td>${fmt(p.market_value)}</td>
                    <td className={pnlDollar >= 0 ? 'positive' : 'negative'}>
                      {sign}${fmt(Math.abs(pnlDollar))} ({sign}{pnlPct}%)
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
