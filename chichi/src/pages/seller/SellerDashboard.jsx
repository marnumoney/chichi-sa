import { Link } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { Package, TrendingUp, Gift, AlertCircle, Plus } from 'lucide-react'

function RandIcon() {
  return <span className="font-body font-bold text-base leading-none">R</span>
}

function MembershipBanner({ kennel, sellerId }) {
  if (!kennel?.membershipExpiry) return null
  const daysLeft = Math.ceil((new Date(kennel.membershipExpiry) - new Date()) / (1000 * 60 * 60 * 24))

  if (daysLeft > 60) return null

  const renewHref = `/pay/membership?seller=${sellerId}`

  if (daysLeft <= 0) {
    return (
      <div className="flex items-start gap-3 bg-red-50 border border-red-200 px-5 py-4 mb-6">
        <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-body font-semibold text-sm text-red-700">Membership Expired</p>
          <p className="font-body text-xs text-red-600 mt-0.5">Your membership has expired. Renew now to continue listing puppies.</p>
        </div>
        <Link to={renewHref} className="ml-auto btn-primary bg-red-600 hover:bg-red-700 text-xs tracking-widest uppercase py-2 px-4 whitespace-nowrap">
          Renew Now
        </Link>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 px-5 py-4 mb-6">
      <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
      <div>
        <p className="font-body font-semibold text-sm text-amber-700">Membership Expires in {daysLeft} Days</p>
        <p className="font-body text-xs text-amber-600 mt-0.5">Renew before {kennel.membershipExpiry} to avoid listing interruptions.</p>
      </div>
      <Link to={renewHref} className="ml-auto bg-amber-500 text-white font-body text-xs font-semibold tracking-widest uppercase px-4 py-2 hover:bg-amber-600 transition-colors whitespace-nowrap">
        Renew Early
      </Link>
    </div>
  )
}

export default function SellerDashboard() {
  const { sellerUser, puppies, kennels, adminSettings, transactions } = useApp()
  const kennel = sellerUser?.kennel

  const myPuppies = puppies.filter(p => p.kennelId === sellerUser?.kennelId)
  const active = myPuppies.filter(p => !p.sold)
  const sold = myPuppies.filter(p => p.sold)
  const commission = kennel?.commission ?? adminSettings?.defaultCommission ?? 8

  const myTxns = transactions.filter(t => t.kennelId === sellerUser?.kennelId)
  const pendingPayouts = myTxns.filter(t => !t.sellerPaid)
  const releasedPayouts = myTxns.filter(t => t.sellerPaid)
  const grossRevenue = myTxns.reduce((acc, t) => acc + t.amount, 0)
  const commissionPaid = myTxns.reduce((acc, t) => acc + t.commission, 0)

  const referralDiscountActive = !!kennel?.referredBy

  return (
    <div>
      {/* Welcome */}
      <div className="mb-6">
        <h2 className="font-display text-3xl font-semibold text-espresso mb-1">
          Welcome, {sellerUser?.name?.split(' ')[0]}
        </h2>
        <p className="font-body text-sm text-muted">
          {kennel?.name}{kennel?.registry ? ` · ${kennel.registry}` : ''}
          {referralDiscountActive && (
            <span className="ml-2 text-sage font-semibold">· Referral discount active ({(adminSettings?.referralDiscount ?? 1.5)}% off commission)</span>
          )}
        </p>
      </div>

      <MembershipBanner kennel={kennel} sellerId={sellerUser?.id} />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Active Listings', value: active.length, icon: Package, color: 'text-espresso bg-espresso/10' },
          { label: 'Puppies Sold', value: sold.length, icon: TrendingUp, color: 'text-sage-dark bg-sage/10' },
          { label: 'Paid Out to You', value: (() => { const n = releasedPayouts.reduce((a,t)=>a+t.sellerPayout,0); return n ? `R${n.toLocaleString()}` : 'R —' })(), icon: RandIcon, color: 'text-sienna bg-sienna/10' },
          { label: 'Pending Release', value: (() => { const n = pendingPayouts.reduce((a,t)=>a+t.sellerPayout,0); return n ? `R${n.toLocaleString()}` : 'R —' })(), icon: RandIcon, color: 'text-amber-700 bg-amber-50' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white border border-divider p-5">
            <div className={`w-9 h-9 flex items-center justify-center mb-3 ${color}`}>
              <Icon className="w-5 h-5" />
            </div>
            <p className="font-body text-2xl font-bold text-espresso leading-none mb-1 tabular-nums">{value}</p>
            <p className="font-body text-xs text-muted uppercase tracking-widest">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent listings */}
        <div className="bg-white border border-divider">
          <div className="flex items-center justify-between px-5 py-4 border-b border-divider">
            <h3 className="font-body font-semibold text-sm text-espresso">My Listings</h3>
            <Link to="/seller/puppies" className="font-body text-xs text-sienna hover:underline">View all</Link>
          </div>
          {myPuppies.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="font-body text-sm text-muted mb-3">No puppies listed yet.</p>
              <Link to="/seller/puppies" className="btn-primary text-xs tracking-widest uppercase py-2 px-4 inline-flex items-center gap-2">
                <Plus className="w-3.5 h-3.5" /> Add First Puppy
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-divider">
              {myPuppies.slice(0, 4).map(p => (
                <div key={p.id} className="flex items-center gap-3 px-5 py-3">
                  <img
                    src={p.images[0]}
                    alt={p.name}
                    className={`w-10 h-10 object-cover flex-shrink-0 ${p.sold ? 'grayscale' : ''}`}
                    onError={e => { e.target.src = `https://picsum.photos/seed/${p.id}/80/80` }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-body text-sm font-semibold text-espresso truncate">{p.name}</p>
                    <p className="font-body text-xs text-muted">{p.coatType ?? 'Chihuahua'} · R{p.price.toLocaleString()}</p>
                  </div>
                  <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 ${p.sold ? 'bg-red-100 text-red-700' : 'bg-sage/10 text-sage-dark'}`}>
                    {p.sold ? 'Sold' : 'Active'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Referral & membership */}
        <div className="space-y-4">
          {/* Membership card */}
          <div className="bg-white border border-divider p-5">
            <h3 className="font-body font-semibold text-sm text-espresso mb-3">Membership</h3>
            <div className="flex items-center justify-between mb-2">
              <span className="font-body text-xs text-muted">Status</span>
              <span className="badge-available px-2 py-0.5">Active</span>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-body text-xs text-muted">Expires</span>
              <span className="font-body text-xs font-semibold text-espresso">{kennel?.membershipExpiry ?? 'N/A'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-body text-xs text-muted">Commission rate</span>
              <span className="font-body text-xs font-semibold text-espresso">{commission}%{referralDiscountActive ? ` (${(adminSettings?.referralDiscount ?? 1.5)}% discount applied)` : ''}</span>
            </div>
          </div>

          {/* Referral card */}
          <div className="bg-white border border-divider p-5">
            <div className="flex items-center gap-2 mb-3">
              <Gift className="w-4 h-4 text-sienna" />
              <h3 className="font-body font-semibold text-sm text-espresso">Referral Programme</h3>
            </div>
            <p className="font-body text-xs text-muted leading-relaxed mb-3">
              Refer another breeder to Chihuahua South Africa using your code. When they make their first sale, you earn a <strong>{(adminSettings?.referralDiscount ?? 1.5)}% commission discount</strong> on all your future sales.
            </p>
            {kennel?.referralCode ? (
              <div className="flex items-center gap-2 bg-cream border border-divider px-3 py-2">
                <code className="flex-1 font-mono text-sm font-semibold text-espresso">{kennel.referralCode}</code>
                <button
                  onClick={() => navigator.clipboard.writeText(kennel.referralCode)}
                  className="font-body text-xs text-sienna hover:underline"
                >
                  Copy
                </button>
              </div>
            ) : (
              <p className="font-body text-xs text-muted italic">Referral code assigned after first sale.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
