import React, { useEffect, useState } from 'react'
import { fetchPrices } from '../api.js'

function fmtPrice(n) {
  return n != null ? `$${n.toFixed(2)}` : '—'
}

function fmtVol(n) {
  if (n == null) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

function RangeBar({ low, high, price }) {
  if (low == null || high == null || price == null || high === low) return null
  const pct = Math.min(100, Math.max(0, ((price - low) / (high - low)) * 100))
  return (
    <div className="range-bar-wrap">
      <span className="range-label">{fmtPrice(low)}</span>
      <div className="range-track">
        <div className="range-fill" style={{ width: `${pct}%` }} />
        <div className="range-dot" style={{ left: `${pct}%` }} />
      </div>
      <span className="range-label">{fmtPrice(high)}</span>
    </div>
  )
}

export default function PriceTicker() {
  const [prices, setPrices] = useState({})

  useEffect(() => {
    const load = () => fetchPrices().then(setPrices).catch(() => {})
    load()
    const id = setInterval(load, 5000)
    return () => clearInterval(id)
  }, [])

  const symbols = Object.keys(prices)
  if (symbols.length === 0) return null

  return (
    <div className="live-feed">
      {symbols.map(sym => {
        const { price, change_pct, open, high, low, volume, bid, ask } = prices[sym]
        const up = change_pct >= 0
        const sign = up ? '+' : ''
        return (
          <div key={sym} className={`live-card ${up ? 'live-card-up' : 'live-card-down'}`}>
            <div className="live-card-header">
              <span className="live-symbol">{sym}</span>
              <span className="live-price">{fmtPrice(price)}</span>
              <span className={`live-change ${up ? 'positive' : 'negative'}`}>
                {change_pct != null ? `${sign}${change_pct.toFixed(2)}%` : '—'}
              </span>
            </div>

            <RangeBar low={low} high={high} price={price} />

            <div className="live-card-grid">
              <div className="live-stat">
                <span className="live-stat-label">Open</span>
                <span>{fmtPrice(open)}</span>
              </div>
              <div className="live-stat">
                <span className="live-stat-label">High</span>
                <span className="positive">{fmtPrice(high)}</span>
              </div>
              <div className="live-stat">
                <span className="live-stat-label">Low</span>
                <span className="negative">{fmtPrice(low)}</span>
              </div>
              <div className="live-stat">
                <span className="live-stat-label">Vol</span>
                <span>{fmtVol(volume)}</span>
              </div>
              <div className="live-stat">
                <span className="live-stat-label">Bid</span>
                <span>{fmtPrice(bid)}</span>
              </div>
              <div className="live-stat">
                <span className="live-stat-label">Ask</span>
                <span>{fmtPrice(ask)}</span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
