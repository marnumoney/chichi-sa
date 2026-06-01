import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { Trash2, Search, Download } from 'lucide-react'
import Modal from '../../components/Modal'
import { exportCsv } from '../../utils/exportCsv'

export default function AdminPuppies() {
  const { puppies, kennels, adminRemovePuppy } = useApp()
  const [search, setSearch] = useState('')
  const [filterKennel, setFilterKennel] = useState('All')
  const [filterStatus, setFilterStatus] = useState('All')
  const [deleteTarget, setDeleteTarget] = useState(null)

  const approvedKennels = kennels.filter(k => k.status === 'approved')

  const filtered = puppies.filter(p => {
    const kennel = kennels.find(k => k.id === p.kennelId)
    if (filterKennel !== 'All' && p.kennelId !== filterKennel) return false
    if (filterStatus === 'Available' && p.sold) return false
    if (filterStatus === 'Sold' && !p.sold) return false
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) &&
        !p.breed?.toLowerCase().includes(search.toLowerCase()) &&
        !p.color?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const available = filtered.filter(p => !p.sold).length
  const sold = filtered.filter(p => p.sold).length

  return (
    <div>
      <div className="flex items-start justify-between mb-8">
        <div>
          <h2 className="font-display text-3xl font-semibold text-espresso mb-1">All Puppy Listings</h2>
          <p className="font-body text-sm text-muted">{available} available · {sold} sold · {filtered.length} total shown</p>
        </div>
        <button onClick={() => exportCsv('listings.csv', puppies.map(p => {
          const k = kennels.find(kk => kk.id === p.kennelId)
          return { Name: p.name, Breed: p.breed, Coat: p.coatType, Gender: p.gender, Colour: p.color, DOB: p.dob, Price: p.price, Kennel: k?.name ?? '—', Registry: k?.registry ?? '—', Status: p.sold ? 'Sold' : 'Available', 'Reg No': p.registrationNo ?? '—' }
        }))} className="flex items-center gap-1.5 btn-secondary text-xs tracking-widest uppercase py-2.5 px-4">
          <Download className="w-3.5 h-3.5" /> Export Excel
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6 p-4 bg-white border border-divider">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
          <input className="input-field pl-9 py-2 text-xs" placeholder="Search name, breed, colour..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input-field w-auto py-2 text-xs" value={filterKennel} onChange={e => setFilterKennel(e.target.value)}>
          <option value="All">All Kennels</option>
          {approvedKennels.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
        </select>
        <div className="flex gap-1">
          {['All', 'Available', 'Sold'].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-3 py-2 font-body text-xs font-medium transition-colors ${filterStatus === s ? 'bg-espresso text-cream' : 'bg-white border border-divider text-muted hover:text-espresso'}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-divider overflow-hidden">
        {filtered.length === 0 ? (
          <p className="px-5 py-12 text-center font-body text-sm text-muted">No listings match your filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full font-body text-sm">
              <thead>
                <tr className="bg-cream border-b border-divider">
                  {['Puppy', 'Kennel', 'Coat / Gender', 'Colour', 'Price', 'Breeding', 'Status', 'Actions'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-divider">
                {filtered.map(p => {
                  const kennel = kennels.find(k => k.id === p.kennelId)
                  return (
                    <tr key={p.id} className={`hover:bg-cream/30 transition-colors ${p.sold ? 'opacity-60' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <img src={p.images[0]} alt={p.name}
                            className={`w-10 h-10 object-cover flex-shrink-0 ${p.sold ? 'grayscale' : ''}`}
                            onError={e => { e.target.src = `https://picsum.photos/seed/${p.id}/80/80` }} />
                          <div>
                            <p className="font-semibold text-espresso">{p.name}</p>
                            <p className="text-[10px] text-muted font-mono">{p.registrationNo || '—'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {kennel ? (
                          <div className="flex items-center gap-1.5">
                            <div className="w-4 h-4 flex-shrink-0" style={{ backgroundColor: kennel.color }} />
                            <div>
                              <p className="text-xs text-espresso">{kennel.name}</p>
                              <span className={kennel.registry === 'KUSA' ? 'badge-kusa' : 'badge-canine'}>{kennel.registry}</span>
                            </div>
                          </div>
                        ) : <span className="text-muted text-xs">Unknown</span>}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <div className="text-muted">{p.coatType ?? '—'}</div>
                        <div className={`text-[10px] font-bold ${p.gender === 'Male' ? 'text-blue-600' : 'text-pink-500'}`}>{p.gender}</div>
                      </td>
                      <td className="px-4 py-3 text-muted text-xs">{p.color || '—'}</td>
                      <td className="px-4 py-3 font-semibold text-espresso">R{p.price.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 ${p.breedingRights ? 'bg-sage/10 text-sage-dark' : 'bg-espresso/10 text-espresso'}`}>
                          {p.breedingRights ? 'Full' : 'Pet Only'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 ${p.sold ? 'bg-red-100 text-red-700' : 'bg-sage/10 text-sage-dark'}`}>
                          {p.sold ? 'Sold' : 'Active'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => setDeleteTarget(p)}
                          className="flex items-center gap-1 text-muted hover:text-red-500 font-body text-xs transition-colors">
                          <Trash2 className="w-3.5 h-3.5" /> Remove
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Remove Listing">
        <div className="space-y-4">
          <p className="font-body text-sm text-muted">
            Permanently remove <strong className="text-espresso">{deleteTarget?.name}</strong> from the platform? This cannot be undone.
          </p>
          <div className="flex gap-3">
            <button onClick={() => setDeleteTarget(null)} className="flex-1 btn-secondary text-xs tracking-widest uppercase py-3">Cancel</button>
            <button onClick={() => { adminRemovePuppy(deleteTarget.id); setDeleteTarget(null) }}
              className="flex-1 bg-red-600 text-white font-body text-xs font-semibold tracking-widest uppercase py-3 hover:bg-red-700 transition-colors">
              Remove Listing
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
