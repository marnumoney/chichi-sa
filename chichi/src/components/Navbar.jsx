import { useState, useRef, useEffect } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { Menu, X, ChevronDown, User, ShieldCheck, PenLine } from 'lucide-react'
import { Logo } from './Logo'
import { useApp } from '../context/AppContext'

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [portalOpen, setPortalOpen] = useState(false)
  const { adminUser, sellerUser, logoutAdmin, logoutSeller } = useApp()
  const dropdownRef = useRef(null)
  const navigate = useNavigate()

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setPortalOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleLogout = () => {
    if (adminUser) { logoutAdmin(); navigate('/') }
    if (sellerUser) { logoutSeller(); navigate('/') }
    setPortalOpen(false)
  }

  const activeUser = adminUser || sellerUser
  const activeLabel = adminUser ? 'Admin' : sellerUser ? sellerUser.kennel?.name || 'Seller' : null

  return (
    <header className="bg-cream/95 backdrop-blur border-b border-divider sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20 md:h-24">

          {/* Logo */}
          <Link to="/" className="group">
            <Logo />
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-8">
            <NavLink to="/" end className={({ isActive }) =>
              `font-body text-xs tracking-[0.15em] uppercase font-medium transition-colors pb-1 border-b-2 ${isActive ? 'text-sienna border-sienna' : 'text-muted border-transparent hover:text-espresso hover:border-divider'}`
            }>
              Browse Puppies
            </NavLink>
            <NavLink to="/kennels" className={({ isActive }) =>
              `font-body text-xs tracking-[0.15em] uppercase font-medium transition-colors pb-1 border-b-2 ${isActive ? 'text-sienna border-sienna' : 'text-muted border-transparent hover:text-espresso hover:border-divider'}`
            }>
              Kennels
            </NavLink>
            <NavLink to="/contact" className={({ isActive }) =>
              `font-body text-xs tracking-[0.15em] uppercase font-medium transition-colors pb-1 border-b-2 ${isActive ? 'text-sienna border-sienna' : 'text-muted border-transparent hover:text-espresso hover:border-divider'}`
            }>
              Contact Us
            </NavLink>
          </nav>

          {/* Desktop right side */}
          <div className="hidden md:flex items-center gap-4">
            {/* Portal dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setPortalOpen(!portalOpen)}
                className={`flex items-center gap-1.5 font-body text-xs tracking-widest uppercase font-medium transition-colors px-3 py-2 border ${
                  activeUser
                    ? 'border-sienna text-sienna bg-sienna/5'
                    : 'border-divider text-muted hover:border-espresso hover:text-espresso'
                }`}
              >
                {activeUser
                  ? <><ShieldCheck className="w-3.5 h-3.5" />{activeLabel}</>
                  : <><User className="w-3.5 h-3.5" />Portal</>
                }
                <ChevronDown className={`w-3 h-3 transition-transform ${portalOpen ? 'rotate-180' : ''}`} />
              </button>

              {portalOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-divider shadow-lg z-50">
                  {/* Admin section */}
                  <div className="px-3 py-2 border-b border-divider">
                    <p className="font-body text-[9px] text-muted uppercase tracking-widest font-semibold">Admin</p>
                  </div>
                  {adminUser ? (
                    <>
                      <Link to="/admin" onClick={() => setPortalOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 font-body text-sm text-espresso hover:bg-cream transition-colors">
                        <ShieldCheck className="w-4 h-4 text-sienna flex-shrink-0" />
                        Admin Dashboard
                      </Link>
                      <Link to="/admin/wallet" onClick={() => setPortalOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 font-body text-sm text-espresso hover:bg-cream transition-colors">
                        <ShieldCheck className="w-4 h-4 text-muted flex-shrink-0" />
                        Wallet
                      </Link>
                    </>
                  ) : (
                    <Link to="/admin/login" onClick={() => setPortalOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 font-body text-sm text-espresso hover:bg-cream transition-colors">
                      <ShieldCheck className="w-4 h-4 text-sienna flex-shrink-0" />
                      Admin Login
                    </Link>
                  )}

                  {/* Seller section */}
                  <div className="px-3 py-2 border-t border-b border-divider">
                    <p className="font-body text-[9px] text-muted uppercase tracking-widest font-semibold">Breeder</p>
                  </div>
                  {sellerUser ? (
                    <>
                      <Link to="/seller" onClick={() => setPortalOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 font-body text-sm text-espresso hover:bg-cream transition-colors">
                        <User className="w-4 h-4 text-sienna flex-shrink-0" />
                        My Dashboard
                      </Link>
                      <Link to="/seller/puppies" onClick={() => setPortalOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 font-body text-sm text-espresso hover:bg-cream transition-colors">
                        <User className="w-4 h-4 text-muted flex-shrink-0" />
                        My Puppies
                      </Link>
                    </>
                  ) : (
                    <>
                      <Link to="/seller/login" onClick={() => setPortalOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 font-body text-sm text-espresso hover:bg-cream transition-colors">
                        <User className="w-4 h-4 text-sienna flex-shrink-0" />
                        Seller Login
                      </Link>
                      <Link to="/seller/signup" onClick={() => setPortalOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 font-body text-sm text-espresso hover:bg-cream transition-colors">
                        <PenLine className="w-4 h-4 text-sage flex-shrink-0" />
                        Apply as Breeder
                      </Link>
                    </>
                  )}

                  {/* Logout */}
                  {activeUser && (
                    <div className="border-t border-divider">
                      <button onClick={handleLogout}
                        className="w-full text-left flex items-center gap-2.5 px-4 py-2.5 font-body text-sm text-red-500 hover:bg-red-50 transition-colors">
                        <X className="w-4 h-4 flex-shrink-0" />
                        Sign Out
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <Link to="/seller/signup" className="btn-primary text-xs py-2.5 px-5 tracking-widest uppercase">
              List Your Chi's
            </Link>
          </div>

          {/* Mobile toggle */}
          <button
            className="md:hidden p-2 text-espresso hover:text-sienna transition-colors"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-divider bg-cream">
          <div className="px-4 py-5 space-y-3">
            <NavLink to="/" end onClick={() => setMobileOpen(false)} className="block font-body text-sm tracking-widest uppercase text-muted font-medium py-1">Browse Puppies</NavLink>
            <NavLink to="/kennels" onClick={() => setMobileOpen(false)} className="block font-body text-sm tracking-widest uppercase text-muted font-medium py-1">Kennels</NavLink>
            <NavLink to="/contact" onClick={() => setMobileOpen(false)} className="block font-body text-sm tracking-widest uppercase text-muted font-medium py-1">Contact Us</NavLink>
            <div className="pt-3 border-t border-divider space-y-2">
              <p className="font-body text-[9px] text-muted uppercase tracking-widest font-semibold">Admin</p>
              {adminUser ? (
                <Link to="/admin" onClick={() => setMobileOpen(false)} className="block font-body text-sm text-espresso py-1">Admin Dashboard</Link>
              ) : (
                <Link to="/admin/login" onClick={() => setMobileOpen(false)} className="block font-body text-sm text-espresso py-1">Admin Login</Link>
              )}
            </div>
            <div className="pt-2 border-t border-divider space-y-2">
              <p className="font-body text-[9px] text-muted uppercase tracking-widest font-semibold">Breeder</p>
              {sellerUser ? (
                <Link to="/seller" onClick={() => setMobileOpen(false)} className="block font-body text-sm text-espresso py-1">My Dashboard</Link>
              ) : (
                <>
                  <Link to="/seller/login" onClick={() => setMobileOpen(false)} className="block font-body text-sm text-espresso py-1">Seller Login</Link>
                  <Link to="/seller/signup" onClick={() => setMobileOpen(false)} className="btn-primary text-xs py-3 px-5 text-center block tracking-widest uppercase">List Your Chi's</Link>
                </>
              )}
              {activeUser && (
                <button onClick={() => { handleLogout(); setMobileOpen(false) }} className="block font-body text-sm text-red-500 py-1">Sign Out</button>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
