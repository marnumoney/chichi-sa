export async function fetchPortfolio() {
  const res = await fetch('/portfolio')
  if (!res.ok) throw new Error('Failed to fetch portfolio')
  return res.json()
}

export async function fetchJournalDates() {
  const res = await fetch('/journal')
  if (!res.ok) throw new Error('Failed to fetch journal list')
  return res.json()
}

export async function fetchJournalEntry(date) {
  const res = await fetch(`/journal/${date}`)
  if (!res.ok) throw new Error(`Failed to fetch journal entry for ${date}`)
  return res.json()
}

export async function fetchWatchlist() {
  const res = await fetch('/watchlist')
  if (!res.ok) throw new Error('Failed to fetch watchlist')
  return res.json()
}

export async function saveWatchlist(body) {
  const res = await fetch('/watchlist', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.detail || 'Failed to save watchlist')
  }
  return res.json()
}

export async function fetchPrices() {
  const res = await fetch('/prices')
  if (!res.ok) throw new Error('Failed to fetch prices')
  return res.json()
}
