import { useApp } from '../../context/AppContext'
import { Link } from 'react-router-dom'
import { Building2, Package, Users, CheckCircle } from 'lucide-react'

function RandIcon() {
  return <span className="font-body font-bold text-base leading-none">R</span>
}

function StatCard({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="bg-white border border-divider p-5 flex items-start gap-4">
      <div className={`w-10 h-10 flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="font-body text-xs text-muted uppercase tracking-widest mb-0.5">{label}</p>
        <p className="font-display text-3xl font-semibold text-espresso leading-none">{value}</p>
        {sub && <p className="font-body text-xs text-muted mt-1">{sub}</p>}
      </div>
    </div>
  )
}

export default function AdminDashboard() {
  const { kennels, puppies, sellers, adminSettings, transactions } = useApp()

  const approved = kennels.filter(k => k.status === 'approved')
  const pending = sellers.filter(s => s.status === 'pending_verification')
  const totalPuppies = puppies.length
  const soldPuppies = puppies.filter(p => p.sold)

  const totalCommission = transactions.reduce((acc, t) => acc + t.commission, 0)
  const pendingPayouts = transactions.filter(t => !t.sellerPaid || !t.commissionPaid)
  const pendingPayoutTotal = pendingPayouts.reduce((acc, t) =>
    acc + (!t.sellerPaid ? t.sellerPayout : 0) + (!t.commissionPaid ? t.commission : 0), 0)

  function relativeTime(dateStr) {
    if (!dateStr) return ''
    const days = Math.floor((Date.now() - new Date(dateStr)) / 86400000)
    if (days < 0) return 'Recently'
    if (days === 0) return 'Today'
    if (days === 1) return '1 day ago'
    if (days < 7) return `${days} days ago`
    if (days < 14) return '1 week ago'
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`
    return `${Math.floor(days / 30)} months ago`
  }

  const recentActivity = [
    ...sellers.filter(s => s.joinedDate).map(s => ({
      msg: `${s.status === 'pending_verification' ? 'New seller application' : 'Seller joined'} — ${s.name}`,
      time: relativeTime(s.joinedDate),
      date: s.joinedDate,
      type: 'signup',
    })),
    ...transactions.map(t => ({
      msg: `${t.puppyName} (${t.kennelName}) — Sold via Chihuahua SA`,
      time: relativeTime(t.date),
      date: t.date,
      type: 'sale',
    })),
  ]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 6)

  return (
    <div>
      <div className="mb-8">
        <h2 className="font-display text-3xl font-semibold text-espresso mb-1">Overview</h2>
        <p className="font-body text-sm text-muted">Platform health at a glance</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-10">
        <StatCard
          icon={Building2}
          label="Active Kennels"
          value={approved.length}
          sub={`${kennels.filter(k => k.status === 'pending').length} pending approval`}
          color="bg-espresso/10 text-espresso"
        />
        <StatCard
          icon={Package}
          label="Total Listings"
          value={totalPuppies}
          sub={`${soldPuppies.length} sold · ${totalPuppies - soldPuppies.length} available`}
          color="bg-sienna/10 text-sienna"
        />
        <StatCard
          icon={RandIcon}
          label="Commission Earned"
          value={`R${totalCommission.toLocaleString()}`}
          sub={`R${pendingPayoutTotal.toLocaleString()} breeder payouts pending`}
          color="bg-sage/10 text-sage-dark"
        />
        <StatCard
          icon={Users}
          label="Pending Verifications"
          value={pending.length}
          sub="New seller applications"
          color="bg-amber-100 text-amber-700"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending applications */}
        <div className="bg-white border border-divider">
          <div className="flex items-center justify-between px-5 py-4 border-b border-divider">
            <h3 className="font-body font-semibold text-sm text-espresso">Pending Applications</h3>
            {pending.length > 0 && (
              <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5">{pending.length}</span>
            )}
          </div>
          <div className="divide-y divide-divider">
            {pending.length === 0 ? (
              <p className="px-5 py-8 text-center font-body text-sm text-muted">No pending applications.</p>
            ) : (
              pending.map(s => (
                <div key={s.id} className="flex items-center justify-between px-5 py-3.5">
                  <div>
                    <p className="font-body text-sm font-semibold text-espresso">{s.name}</p>
                    <p className="font-body text-xs text-muted">{s.email} · Applied {s.joinedDate}</p>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest bg-amber-100 text-amber-700 px-2 py-1">
                    Pending
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent activity */}
        <div className="bg-white border border-divider">
          <div className="px-5 py-4 border-b border-divider">
            <h3 className="font-body font-semibold text-sm text-espresso">Recent Activity</h3>
          </div>
          <div className="divide-y divide-divider">
            {recentActivity.map((item, i) => (
              <div key={i} className="flex items-start gap-3 px-5 py-3.5">
                <div className={`w-2 h-2 mt-1.5 flex-shrink-0 ${item.type === 'sale' ? 'bg-sage' : item.type === 'signup' ? 'bg-amber-400' : 'bg-espresso'}`} />
                <div>
                  <p className="font-body text-sm text-espresso">{item.msg}</p>
                  <p className="font-body text-xs text-muted">{item.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Wallet summary shortcut */}
      {pendingPayouts.length > 0 && (
        <div className="mt-6 flex items-center justify-between bg-amber-50 border border-amber-200 px-5 py-4">
          <div>
            <p className="font-body font-semibold text-sm text-amber-800">{pendingPayouts.length} payment{pendingPayouts.length > 1 ? 's' : ''} held in escrow</p>
            <p className="font-body text-xs text-amber-700">R{pendingPayoutTotal.toLocaleString()} awaiting release to sellers</p>
          </div>
          <Link to="/admin/wallet" className="bg-amber-500 text-white font-body text-xs font-semibold tracking-widest uppercase px-4 py-2 hover:bg-amber-600 transition-colors">
            Go to Wallet →
          </Link>
        </div>
      )}

      {/* Settings summary */}
      <div className="mt-6 bg-white border border-divider p-5">
        <h3 className="font-body font-semibold text-sm text-espresso mb-4">Current Settings</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Default Commission', value: adminSettings.defaultCommission != null ? `${adminSettings.defaultCommission}%` : '—' },
            { label: 'Annual Membership', value: adminSettings.membershipFeeAnnual != null ? `R${adminSettings.membershipFeeAnnual}` : '—' },
            { label: 'Referral Discount', value: adminSettings.referralDiscount != null ? `${adminSettings.referralDiscount}% off` : '—' },
            { label: 'Active Registries', value: 'KUSA + Canine SA' },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="font-body text-xs text-muted uppercase tracking-widest mb-1">{label}</p>
              <p className="font-body font-semibold text-espresso">{value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
