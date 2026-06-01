import { useState } from 'react'
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { LayoutDashboard, FileText, Building2, Wallet, Users, Package, Star, Megaphone, Settings, LogOut, Menu, X } from 'lucide-react'
import { LogoCompact } from '../../components/Logo'

const navItems = [
  { path: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { path: '/admin/wallet', label: 'Wallet', icon: Wallet },
  { path: '/admin/kennels', label: 'Kennels', icon: Building2 },
  { path: '/admin/users', label: 'Users', icon: Users },
  { path: '/admin/puppies', label: 'All Listings', icon: Package },
  { path: '/admin/testimonials', label: 'Reviews', icon: Star },
  { path: '/admin/broadcast', label: 'Broadcast', icon: Megaphone },
  { path: '/admin/settings', label: 'Settings', icon: Settings },
  { path: '/admin/legal', label: 'Legal & Rules', icon: FileText },
]

export default function AdminLayout() {
  const { adminUser, logoutAdmin, sellers } = useApp()
  const location = useLocation()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const pendingCount = sellers.filter(s => s.status === 'pending_verification').length

  const handleLogout = () => {
    logoutAdmin()
    navigate('/admin/login')
  }

  const isActive = (path, exact) => exact ? location.pathname === path : location.pathname.startsWith(path)
  const currentLabel = navItems.find(n => isActive(n.path, n.exact))?.label ?? 'Admin'

  const SidebarContent = () => (
    <>
      <div className="px-4 py-5 border-b border-cream/10">
        <LogoCompact light />
        <p className="font-body text-[9px] text-cream/30 tracking-widest uppercase mt-2 ml-0.5">Admin Panel</p>
      </div>
      <nav className="flex-1 py-4 overflow-y-auto">
        {navItems.map(({ path, label, icon: Icon, exact }) => {
          const active = isActive(path, exact)
          return (
            <Link key={path} to={path} onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-5 py-2.5 font-body text-sm transition-all relative ${
                active ? 'text-cream bg-sienna/20 border-r-2 border-sienna font-semibold' : 'text-cream/50 hover:text-cream hover:bg-cream/5'
              }`}>
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span>{label}</span>
              {label === 'Kennels' && pendingCount > 0 && (
                <span className="ml-auto bg-sienna text-white text-[9px] font-bold px-1.5 py-0.5 min-w-[18px] text-center">{pendingCount}</span>
              )}
            </Link>
          )
        })}
      </nav>
      <div className="px-5 py-4 border-t border-cream/10">
        <p className="font-body text-xs text-cream/40 truncate mb-3">{adminUser?.email}</p>
        <button onClick={handleLogout} className="flex items-center gap-2 text-cream/50 hover:text-cream font-body text-xs transition-colors">
          <LogOut className="w-3.5 h-3.5" /> Logout
        </button>
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
        <div className="bg-white border-b border-divider px-4 md:px-8 py-4 flex items-center justify-between sticky top-0 z-40">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden text-espresso hover:text-sienna transition-colors">
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="font-body text-sm font-semibold text-espresso uppercase tracking-widest">{currentLabel}</h1>
          </div>
          <Link to="/" className="font-body text-xs text-muted hover:text-sienna transition-colors">View Site</Link>
        </div>
        <div className="p-4 md:p-8 flex-1">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
