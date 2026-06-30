import { useState, useEffect, useRef } from 'react'
import { lockScroll, unlockScroll } from '../../utils/bodyScroll'
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { sendRenewalEmail } from '../../utils/email'
import { LayoutDashboard, Package, User, FileText, LogOut, Menu, X, ScrollText, Check } from 'lucide-react'
import { LogoCompact } from '../../components/Logo'

const navItems = [
  { path: '/seller', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { path: '/seller/puppies', label: 'My Puppies', icon: Package },
  { path: '/seller/profile', label: 'Kennel Profile', icon: User },
  { path: '/seller/terms', label: 'Terms & Rules', icon: FileText },
]

function TermsAgreementGate({ termsContent, onAgree }) {
  const [agreed, setAgreed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const scrollRef = useRef(null)

  const handleScroll = () => {
    const el = scrollRef.current
    if (!el) return
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40) setScrolled(true)
  }

  const handleAgree = async () => {
    if (!agreed) return
    setLoading(true)
    try { await onAgree() } finally { setLoading(false) }
  }

  function renderLines(lines) {
    return lines.map((line, i) => {
      if (!line.trim()) return <div key={i} className="h-2" />
      if (line.startsWith('- ')) return <li key={i} className="ml-5 list-disc font-body text-sm text-muted leading-relaxed">{line.slice(2)}</li>
      if (line.startsWith('## ')) return <h2 key={i} className="font-display text-lg font-semibold text-espresso mt-6 mb-2">{line.slice(3)}</h2>
      if (line.startsWith('# ')) return <h1 key={i} className="font-display text-2xl font-semibold text-espresso mt-6 mb-3">{line.slice(2)}</h1>
      const parts = line.split(/\*\*(.+?)\*\*/)
      return <p key={i} className="font-body text-sm text-muted leading-relaxed">{parts.map((p, j) => j % 2 === 1 ? <strong key={j} className="font-semibold text-espresso">{p}</strong> : p)}</p>
    })
  }

  return (
    <div className="fixed inset-0 z-[200] bg-espresso/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-cream w-full max-w-2xl flex flex-col shadow-2xl max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-divider flex items-center gap-3 flex-shrink-0">
          <ScrollText className="w-5 h-5 text-sienna flex-shrink-0" />
          <div>
            <h2 className="font-display text-xl font-semibold text-espresso">Terms &amp; Rules Agreement</h2>
            <p className="font-body text-xs text-muted mt-0.5">Please read and agree before accessing your portal.</p>
          </div>
        </div>

        {/* Scrollable terms */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-6 py-5 space-y-1 border-b border-divider"
        >
          {termsContent
            ? renderLines(termsContent.split('\n'))
            : <p className="font-body text-sm text-muted">Loading terms…</p>
          }
          {!scrolled && (
            <p className="font-body text-xs text-sienna pt-4 text-center">↓ Scroll to read all terms</p>
          )}
        </div>

        {/* Agreement footer */}
        <div className="px-6 py-5 flex-shrink-0 space-y-4">
          <div
            onClick={() => setAgreed(a => !a)}
            className={`flex items-start gap-3 p-3 border cursor-pointer transition-colors ${agreed ? 'border-sage bg-sage/5' : 'border-divider hover:border-sage/40'}`}
          >
            <div className={`w-5 h-5 flex-shrink-0 border flex items-center justify-center mt-0.5 transition-colors ${agreed ? 'border-sage bg-sage' : 'border-divider'}`}>
              {agreed && <Check className="w-3 h-3 text-white" />}
            </div>
            <p className="font-body text-sm text-espresso leading-snug">
              I have read and I agree to the <strong>Terms &amp; Rules</strong> of Chihuahua South Africa. I understand my obligations as a listed breeder.
            </p>
          </div>
          <button
            onClick={handleAgree}
            disabled={!agreed || loading}
            className={`w-full py-3.5 font-body text-xs font-semibold tracking-widest uppercase transition-colors ${agreed && !loading ? 'btn-primary' : 'bg-divider text-muted cursor-not-allowed'}`}
          >
            {loading ? 'Saving…' : 'Confirm Agreement & Enter Portal'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function SellerLayout() {
  const { sellerUser, logoutSeller, agreeToTerms, termsContent } = useApp()
  const location = useLocation()
  const navigate = useNavigate()
  const kennel = sellerUser?.kennel
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    lockScroll()
    return () => unlockScroll()
  }, [])

  useEffect(() => {
    if (!sellerUser || !kennel?.membershipExpiry) return
    const daysLeft = Math.ceil((new Date(kennel.membershipExpiry) - new Date()) / (1000 * 60 * 60 * 24))
    if (daysLeft > 30) return
    const key = `renewal_sent_${sellerUser.id}`
    const lastSent = localStorage.getItem(key)
    const daysSince = lastSent ? Math.floor((Date.now() - Number(lastSent)) / 86400000) : Infinity
    if (daysSince < 7) return
    localStorage.setItem(key, String(Date.now()))
    sendRenewalEmail(sellerUser, kennel.name)
  }, [sellerUser, kennel])

  const daysLeft = kennel?.membershipExpiry
    ? Math.ceil((new Date(kennel.membershipExpiry) - new Date()) / (1000 * 60 * 60 * 24))
    : null

  const handleLogout = () => {
    logoutSeller()
    navigate('/seller/login')
  }

  const isActive = (path, exact) => exact ? location.pathname === path : location.pathname.startsWith(path)
  const currentLabel = navItems.find(n => isActive(n.path, n.exact))?.label ?? 'Seller Portal'

  const SidebarContent = () => (
    <>
      <div className="px-4 py-5 border-b border-cream/10">
        <LogoCompact light />
        {kennel && (
          <div className="flex items-center gap-2 mt-3">
            <div className="w-6 h-6 flex-shrink-0 overflow-hidden"
              style={{ backgroundColor: kennel.color || '#8B7355' }}>
              {kennel.logo
                ? <img src={kennel.logo} alt={kennel.name} className="w-full h-full object-cover" />
                : <span className="w-full h-full flex items-center justify-center text-white text-[8px] font-bold">{kennel.initials ?? '??'}</span>
              }
            </div>
            <div className="min-w-0">
              <p className="font-body text-[10px] font-semibold text-cream/80 truncate leading-tight">{kennel.name}</p>
              <p className="font-body text-[8px] text-cream/40">{kennel.registry}</p>
            </div>
          </div>
        )}
      </div>
      <nav className="flex-1 py-4 overflow-y-auto">
        {navItems.map(({ path, label, icon: Icon, exact }) => {
          const active = isActive(path, exact)
          return (
            <Link key={path} to={path} onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-5 py-2.5 font-body text-sm transition-all ${
                active ? 'text-cream bg-sienna/20 border-r-2 border-sienna font-semibold' : 'text-cream/50 hover:text-cream hover:bg-cream/5'
              }`}>
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>
      <div className="px-5 py-4 border-t border-cream/10">
        {daysLeft !== null && daysLeft <= 60 && (
          <div className={`text-[10px] font-body mb-3 px-2 py-1.5 ${daysLeft <= 14 ? 'bg-red-900/30 text-red-300' : 'bg-amber-900/20 text-amber-300'}`}>
            {daysLeft <= 0 ? 'Membership expired!' : `Expires in ${daysLeft} days`}
          </div>
        )}
        <p className="font-body text-xs text-cream/40 truncate mb-2">{sellerUser?.name}</p>
        <div className="flex gap-4">
          <Link to="/" className="font-body text-[10px] text-cream/30 hover:text-cream/60 transition-colors">View site</Link>
          <button onClick={handleLogout} className="flex items-center gap-1.5 text-cream/40 hover:text-cream font-body text-[10px] transition-colors">
            <LogOut className="w-3 h-3" /> Logout
          </button>
        </div>
      </div>
    </>
  )

  const needsAgreement = sellerUser && !sellerUser.termsAgreedAt

  return (
    <>
    {needsAgreement && <TermsAgreementGate termsContent={termsContent} onAgree={agreeToTerms} />}
    <div className="flex h-screen bg-cream overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 bg-espresso flex-col flex-shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-espresso/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <aside className="relative w-64 bg-espresso flex flex-col h-full z-10">
            <div className="absolute top-4 right-4">
              <button onClick={() => setSidebarOpen(false)} className="text-cream/60 hover:text-cream">
                <X className="w-5 h-5" />
              </button>
            </div>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main */}
      <main className="flex-1 min-h-0 overflow-y-auto flex flex-col">
        <div className="bg-white border-b border-divider px-4 md:px-8 py-4 flex items-center sticky top-0 z-40">
          <button onClick={() => setSidebarOpen(true)} className="md:hidden text-espresso hover:text-sienna transition-colors mr-3">
            <Menu className="w-5 h-5" />
          </button>
          <p className="font-body text-sm font-semibold text-espresso uppercase tracking-widest">{currentLabel}</p>
        </div>
        <div className="p-4 md:p-8 flex-1">
          <Outlet />
        </div>
      </main>
    </div>
    </>
  )
}
