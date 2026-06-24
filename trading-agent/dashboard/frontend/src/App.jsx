import React, { useState } from 'react'
import Portfolio from './components/Portfolio.jsx'
import Journal from './components/Journal.jsx'
import Watchlist from './components/Watchlist.jsx'

const TABS = ['Portfolio', 'Journal', 'Watchlist']

export default function App() {
  const [tab, setTab] = useState('Portfolio')

  return (
    <div className="app">
      <header className="header">
        <h1>Trading Agent</h1>
        <nav className="nav">
          {TABS.map(t => (
            <button
              key={t}
              className={`nav-btn ${tab === t ? 'active' : ''}`}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </nav>
      </header>
      <main className="main">
        {tab === 'Portfolio' && <Portfolio />}
        {tab === 'Journal' && <Journal />}
        {tab === 'Watchlist' && <Watchlist />}
      </main>
    </div>
  )
}
