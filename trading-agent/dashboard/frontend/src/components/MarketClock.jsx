import React, { useEffect, useState } from 'react'
import { fetchMarket } from '../api.js'

function countdown(target) {
  const diff = Math.max(0, new Date(target) - Date.now())
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  const s = Math.floor((diff % 60000) / 1000)
  return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`
}

export default function MarketClock() {
  const [status, setStatus] = useState(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const load = () => fetchMarket().then(setStatus).catch(() => {})
    load()
    const pollId = setInterval(load, 30000)
    return () => clearInterval(pollId)
  }, [])

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  if (!status) return null

  const isOpen = status.is_open
  const target = isOpen ? status.next_close : status.next_open
  const label = isOpen ? 'Closes in' : 'Opens in'

  return (
    <div className="market-clock">
      <span className={`market-dot ${isOpen ? 'dot-open' : 'dot-closed'}`} />
      <span className="market-status-label">{isOpen ? 'OPEN' : 'CLOSED'}</span>
      {target && (
        <span className="market-countdown">{label} {countdown(target)}</span>
      )}
    </div>
  )
}
