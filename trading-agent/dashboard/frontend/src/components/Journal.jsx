import React, { useEffect, useState } from 'react'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { fetchJournalDates, fetchJournalEntry } from '../api.js'

export default function Journal() {
  const [dates, setDates] = useState([])
  const [selected, setSelected] = useState(null)
  const [content, setContent] = useState('')
  const [error, setError] = useState(null)

  useEffect(() => {
    const load = () =>
      fetchJournalDates()
        .then(data => {
          setDates(data.dates)
          if (data.dates.length > 0) setSelected(prev => prev ?? data.dates[0])
        })
        .catch(e => setError(e.message))
    load()
    const id = setInterval(load, 30000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!selected) return
    const load = () =>
      fetchJournalEntry(selected)
        .then(data => setContent(data.content))
        .catch(e => setError(e.message))
    load()
    const id = setInterval(load, 30000)
    return () => clearInterval(id)
  }, [selected])

  if (error) return <div className="error">Error: {error}</div>

  // Content is sanitized with DOMPurify before rendering to prevent XSS
  const safeHtml = DOMPurify.sanitize(marked.parse(content))

  return (
    <div className="journal-layout">
      <div className="card journal-list">
        {dates.length === 0
          ? <div style={{ color: '#718096', fontSize: '0.875rem' }}>No entries yet.</div>
          : dates.map(date => (
              <div
                key={date}
                className={`journal-list-item ${selected === date ? 'selected' : ''}`}
                onClick={() => setSelected(date)}
              >
                {date}
              </div>
            ))
        }
      </div>
      <div className="card journal-content">
        {selected
          ? <div className="markdown" dangerouslySetInnerHTML={{ __html: safeHtml }} />
          : <div style={{ color: '#718096' }}>Select a journal entry.</div>
        }
      </div>
    </div>
  )
}
