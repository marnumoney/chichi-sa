import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useApp, apiFetch, normalize } from '../../context/AppContext'
import { Logo } from '../../components/Logo'
import { ShoppingBag, LogOut, Check } from 'lucide-react'

export default function BuyerDashboard() {
  const { buyerUser, logoutBuyer } = useApp()
  const navigate = useNavigate()
  const [purchases, setPurchases] = useState([])
  const [tab, setTab] = useState('purchases')
  const [profileForm, setProfileForm] = useState({ name: buyerUser?.name || '', phone: buyerUser?.phone || '' })
  const [profileSaved, setProfileSaved] = useState(false)

  useEffect(() => {
    apiFetch('/buyer/me')
      .then(r => r.json())
      .then(d => { const data = normalize(d); setPurchases(data.purchases || []) })
      .catch(() => {})
  }, [])

  const handleLogout = () => { logoutBuyer(); navigate('/') }

  const saveProfile = async (e) => {
    e.preventDefault()
    await apiFetch('/buyer/profile', { method: 'PUT', body: profileForm })
    setProfileSaved(true)
    setTimeout(() => setProfileSaved(false), 2500)
  }

  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <header className="bg-white border-b border-divider px-4 py-4 flex items-center justify-between">
        <Link to="/"><Logo /></Link>
        <div className="flex items-center gap-4">
          <Link to="/" className="font-body text-xs text-muted hover:text-sienna transition-colors">Browse Puppies</Link>
          <button onClick={handleLogout} className="flex items-center gap-1.5 font-body text-xs text-muted hover:text-red-500 transition-colors">
            <LogOut className="w-3.5 h-3.5" /> Sign Out
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-10">
        {/* Welcome */}
        <div className="mb-8">
          <h1 className="font-display text-3xl font-semibold text-espresso mb-1">
            Welcome back, {buyerUser?.name?.split(' ')[0]}
          </h1>
          <p className="font-body text-sm text-muted">{buyerUser?.email}</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-white border border-divider p-5 flex items-center gap-4">
            <div className="w-10 h-10 bg-sienna/10 flex items-center justify-center flex-shrink-0">
              <ShoppingBag className="w-5 h-5 text-sienna" />
            </div>
            <div>
              <p className="font-body text-xs text-muted uppercase tracking-widest">Total Purchases</p>
              <p className="font-display text-3xl font-semibold text-espresso">{purchases.length}</p>
            </div>
          </div>
          <div className="bg-white border border-divider p-5 flex items-center gap-4">
            <div className="w-10 h-10 bg-sage/10 flex items-center justify-center flex-shrink-0">
              <span className="font-body font-bold text-base text-sage-dark">R</span>
            </div>
            <div>
              <p className="font-body text-xs text-muted uppercase tracking-widest">Total Spent</p>
              <p className="font-display text-3xl font-semibold text-espresso">
                R{purchases.reduce((s, p) => s + (p.amount || 0), 0).toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-divider mb-6">
          {[['purchases', 'My Purchases'], ['profile', 'Profile']].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`font-body text-xs tracking-widest uppercase px-5 py-3 border-b-2 transition-colors ${tab === key ? 'border-sienna text-sienna font-semibold' : 'border-transparent text-muted hover:text-espresso'}`}>
              {label}
            </button>
          ))}
        </div>

        {/* Purchases tab */}
        {tab === 'purchases' && (
          <div>
            {purchases.length === 0 ? (
              <div className="bg-white border border-divider p-12 text-center">
                <ShoppingBag className="w-10 h-10 text-muted mx-auto mb-4" />
                <p className="font-display text-xl font-semibold text-espresso mb-2">No purchases yet</p>
                <p className="font-body text-sm text-muted mb-6">Browse our kennels to find your perfect Chihuahua.</p>
                <Link to="/" className="btn-primary text-xs tracking-widest uppercase py-3 px-6">Browse Puppies</Link>
              </div>
            ) : (
              <div className="space-y-4">
                {purchases.map(p => {
                  return (
                    <div key={p.id} className="bg-white border border-divider p-5">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <p className="font-display text-lg font-semibold text-espresso">{p.puppyName}</p>
                          <p className="font-body text-sm text-muted">{p.kennelName} · {p.date}</p>
                        </div>
                        <span className="font-display text-xl font-semibold text-espresso">R{(p.amount || 0).toLocaleString()}</span>
                      </div>

                      <div className="flex items-center gap-2 mt-3">
                        <Check className="w-4 h-4 text-sage-dark" />
                        <span className="font-body text-xs text-sage-dark font-semibold">Payment confirmed via Yoco</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Profile tab */}
        {tab === 'profile' && (
          <div className="bg-white border border-divider p-6 max-w-md">
            <h3 className="font-body font-semibold text-sm text-espresso mb-5">Account Details</h3>
            <form onSubmit={saveProfile} className="space-y-4">
              <div>
                <label className="label">Full Name</label>
                <input className="input-field" value={profileForm.name}
                  onChange={e => setProfileForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="label">Email Address</label>
                <input className="input-field bg-cream text-muted cursor-not-allowed" value={buyerUser?.email} readOnly />
                <p className="font-body text-[10px] text-muted mt-1">Email cannot be changed.</p>
              </div>
              <div>
                <label className="label">Phone Number</label>
                <input type="tel" className="input-field" value={profileForm.phone}
                  onChange={e => setProfileForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <button type="submit"
                className={`flex items-center gap-2 px-6 py-2.5 font-body text-xs font-semibold tracking-widest uppercase ${profileSaved ? 'bg-sage text-white' : 'btn-primary'}`}>
                {profileSaved ? <><Check className="w-3.5 h-3.5" /> Saved!</> : 'Save Changes'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
