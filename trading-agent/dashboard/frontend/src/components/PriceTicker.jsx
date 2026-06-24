import React, { useEffect, useState } from 'react'
import { fetchPrices } from '../api.js'

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
    <div className="price-ticker">
      {symbols.map(sym => {
        const { price, change_pct } = prices[sym]
        const up = change_pct >= 0
        const sign = up ? '+' : ''
        return (
          <span key={sym} className="ticker-item">
            <span className="ticker-symbol">{sym}</span>
            <span className="ticker-price">${price?.toFixed(2) ?? '—'}</span>
            {change_pct != null && (
              <span className={up ? 'positive' : 'negative'}>
                {sign}{change_pct.toFixed(2)}%
              </span>
            )}
          </span>
        )
      })}
    </div>
  )
}
