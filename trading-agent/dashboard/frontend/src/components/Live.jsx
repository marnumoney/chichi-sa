import React from 'react'
import PnLChart from './PnLChart.jsx'
import OrdersFeed from './OrdersFeed.jsx'
import NewsFeed from './NewsFeed.jsx'

export default function Live() {
  return (
    <div>
      <PnLChart />
      <div style={{ display: 'flex', gap: '1rem' }}>
        <OrdersFeed />
        <NewsFeed />
      </div>
    </div>
  )
}
