import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { Eye, EyeOff } from 'lucide-react'
import { Logo, ChihuahuaMark } from '../../components/Logo'

export default function SellerLogin() {
  const { loginSeller } = useApp()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    const result = await loginSeller(email, password)
    if (result.success) {
      navigate('/seller')
    } else {
      setError(result.error)
    }
  }

  return (
    <div className="min-h-screen bg-cream flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-espresso flex-col justify-center px-16 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10"
          style={{ background: 'radial-gradient(circle at 30% 70%, #B5651D 0%, transparent 60%)' }} />
        <div className="relative">
          <div className="mb-12">
            <Logo light size="lg" />
          </div>
          <h2 className="font-display text-4xl font-semibold text-cream leading-tight mb-4">
            Your Breeder<br />Portal
          </h2>
          <p className="font-body text-sm text-cream/60 leading-relaxed max-w-xs">
            Manage your Chihuahua kennel, upload puppies, track sales, and grow your breeding business — all in one place.
          </p>
          <div className="mt-10 space-y-3">
            {['Upload Chihuahua listings with full pedigrees', 'Track sales and commission payouts', 'Earn referral discounts', 'Manage your kennel profile'].map(f => (
              <div key={f} className="flex items-center gap-2 text-cream/70 font-body text-sm">
                <div className="w-1.5 h-1.5 bg-sienna flex-shrink-0" />
                {f}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <ChihuahuaMark />
            <div className="leading-none">
              <div className="font-display text-xl font-semibold text-espresso">Chihuahua</div>
              <div className="font-body text-[9px] tracking-[0.2em] uppercase text-muted font-semibold">South Africa</div>
            </div>
          </div>

          <h1 className="font-display text-3xl font-semibold text-espresso mb-1">Welcome back</h1>
          <p className="font-body text-sm text-muted mb-6">Sign in to your seller portal</p>

          <div className="bg-sienna/8 border border-sienna/20 px-3 py-2.5 mb-5 font-body text-xs text-sienna-dark leading-relaxed">
            <strong>Demo:</strong> info@littleroyalschis.co.za / seller123
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input type="email" required className="input-field" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  className="input-field pr-10"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-espresso" onClick={() => setShowPw(!showPw)}>
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            {error && <p className="font-body text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-2">{error}</p>}
            <button type="submit" className="w-full btn-primary text-xs tracking-widest uppercase py-3.5 mt-2">
              Sign In
            </button>
          </form>

          <div className="flex items-center justify-between mt-6 font-body text-xs text-muted">
            <Link to="/seller/signup" className="hover:text-sienna transition-colors">New breeder? Apply →</Link>
            <Link to="/" className="hover:text-sienna transition-colors">Back to site</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
