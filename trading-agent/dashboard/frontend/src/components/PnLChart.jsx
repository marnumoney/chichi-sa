import React, { useEffect, useState } from 'react'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, ReferenceLine,
} from 'recharts'
import { fetchHistory } from '../api.js'

function fmt(n) {
  return `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function fmtDate(ts) {
  return new Date(ts * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  const { equity, profit_loss } = payload[0].payload
  const up = profit_loss >= 0
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-date">{fmtDate(label)}</div>
      <div>{fmt(equity)}</div>
      <div className={up ? 'positive' : 'negative'}>{up ? '+' : ''}{fmt(profit_loss)}</div>
    </div>
  )
}

export default function PnLChart() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchHistory().then(setData).catch(e => setError(e.message))
  }, [])

  if (error) return <div className="error">History: {error}</div>
  if (!data) return <div className="loading">Loading chart...</div>

  const points = (data.timestamp || []).map((ts, i) => ({
    ts,
    equity: data.equity[i],
    profit_loss: data.profit_loss[i],
  })).filter(p => p.equity != null)

  if (points.length === 0) return <div className="loading">No history data yet.</div>

  const base = data.base_value
  const last = points[points.length - 1]
  const totalPnl = last.profit_loss
  const up = totalPnl >= 0
  const color = up ? '#68d391' : '#fc8181'

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '1rem' }}>
        <h2>Portfolio Value (1M)</h2>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{fmt(last.equity)}</div>
          <div className={up ? 'positive' : 'negative'} style={{ fontSize: '0.875rem' }}>
            {up ? '+' : ''}{fmt(totalPnl)} from {fmt(base)}
          </div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={points} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="ts" tickFormatter={fmtDate} tick={{ fill: '#718096', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fill: '#718096', fontSize: 11 }} axisLine={false} tickLine={false} width={50} />
          <Tooltip content={<CustomTooltip />} />
          {base && <ReferenceLine y={base} stroke="#4a5568" strokeDasharray="4 2" />}
          <Area type="monotone" dataKey="equity" stroke={color} strokeWidth={2} fill="url(#pnlGrad)" dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
