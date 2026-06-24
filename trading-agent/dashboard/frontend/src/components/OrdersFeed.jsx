import React, { useEffect, useState } from 'react'
import { fetchOrders } from '../api.js'

const STATUS_COLOR = {
  filled: '#68d391',
  partially_filled: '#f6ad55',
  canceled: '#718096',
  rejected: '#fc8181',
  pending_new: '#90cdf4',
  new: '#90cdf4',
  accepted: '#90cdf4',
}

function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
}

export default function OrdersFeed() {
  const [orders, setOrders] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    const load = () => fetchOrders().then(setOrders).catch(e => setError(e.message))
    load()
    const id = setInterval(load, 10000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="card" style={{ flex: 1, minWidth: 0, overflowY: 'auto', maxHeight: 400 }}>
      <h2>Recent Orders</h2>
      {error && <div className="error">{error}</div>}
      {orders.length === 0 && !error && (
        <div style={{ color: '#718096', fontSize: '0.875rem' }}>No orders yet.</div>
      )}
      <div className="orders-list">
        {orders.map(o => {
          const filled = parseFloat(o.filled_qty || 0)
          const qty = parseFloat(o.qty || 0)
          const price = o.filled_avg_price
            ? `$${parseFloat(o.filled_avg_price).toFixed(2)}`
            : o.limit_price
            ? `$${parseFloat(o.limit_price).toFixed(2)} lmt`
            : '—'
          const color = STATUS_COLOR[o.status] || '#a0aec0'
          return (
            <div key={o.id} className="order-row">
              <div className="order-row-left">
                <span className={`order-side ${o.side === 'buy' ? 'positive' : 'negative'}`}>
                  {o.side.toUpperCase()}
                </span>
                <span className="order-symbol">{o.symbol}</span>
                <span className="order-qty">{filled > 0 ? `${filled}/${qty}` : qty} sh</span>
              </div>
              <div className="order-row-right">
                <span className="order-price">{price}</span>
                <span className="order-status" style={{ color }}>{o.status.replace('_', ' ')}</span>
                <span className="order-time">{fmtTime(o.created_at)}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
