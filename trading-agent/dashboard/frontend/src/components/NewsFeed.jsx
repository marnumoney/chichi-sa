import React, { useEffect, useState } from 'react'
import { fetchNews } from '../api.js'

function fmtAge(iso) {
  const diff = Date.now() - new Date(iso)
  const m = Math.floor(diff / 60000)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function NewsFeed() {
  const [items, setItems] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    const load = () => fetchNews().then(setItems).catch(e => setError(e.message))
    load()
    const id = setInterval(load, 60000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="card" style={{ flex: 1, minWidth: 0, overflowY: 'auto', maxHeight: 400 }}>
      <h2>News</h2>
      {error && <div className="error">{error}</div>}
      {items.length === 0 && !error && (
        <div style={{ color: '#718096', fontSize: '0.875rem' }}>Loading headlines...</div>
      )}
      <div className="news-list">
        {items.map(item => (
          <div key={item.id} className="news-item">
            <div className="news-meta">
              <div className="news-symbols">
                {(item.symbols || []).map(s => (
                  <span key={s} className="news-tag">{s}</span>
                ))}
              </div>
              <span className="news-age">{fmtAge(item.created_at)}</span>
            </div>
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="news-headline"
            >
              {item.headline}
            </a>
            {item.summary && (
              <p className="news-summary">{item.summary}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
