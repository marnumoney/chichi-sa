import { useState } from 'react'
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useRef } from 'react'
import { useApp } from '../../context/AppContext'
import { sendRenewalEmail } from '../../utils/email'
import { LayoutDashboard, Package, User, LogOut, Menu, X } from 'lucide-react'
import { LogoCompact } from '../../components/Logo'

const navItems = [
  { path: '/seller', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { path: '/seller/puppies', label: 'My Puppies', icon: Package },
  { path: '/seller/profile', label: 'Kennel Profile', icon: User },
]

export default function SellerLayout() {
  const { sellerUser, logoutSeller } = useApp()
  const location = useLocation()
  const navigate = useNavigate()
  const kennel = sellerUser?.kennel
  const renewalSent = useRef(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    if (!sellerUser || !kennel?.membershipExpiry || renewalSent.current) return
    const daysLeft = Math.ceil((new Date(kennel.membershipExpiry) - new Date()) / (1000 * 60 * 60 * 24))
    if (daysLeft <= 30) {
      renewalSent.current = true
      sendRenewalEmail(sellerUser, kennel.name)
    }
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
            <div className="w-6 h-6 flex items-center justify-center text-white text-[8px] font-bold flex-shrink-0"
              style={{ backgroundColor: kennel.color || '#8B7355' }}>
              {kennel.initials ?? '??'}
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

  return (
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
      <main className="flex-1 overflow-y-auto flex flex-col">
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
  )
}
