import { useState } from 'react'
import { useSearchParams, Link, useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { Lock, CheckCircle, CreditCard, Shield } from 'lucide-react'
import { LogoCompact } from '../components/Logo'


function formatCard(val) {
  return val.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim()
}
function formatExpiry(val) {
  const digits = val.replace(/\D/g, '').slice(0, 4)
  return digits.length > 2 ? digits.slice(0, 2) + '/' + digits.slice(2) : digits
}

export default function PayMembership() {
  const [params] = useSearchParams()
  const { sellers, kennels, payMembership, adminSettings } = useApp()
  const navigate = useNavigate()

  const sellerId = params.get('seller')
  const seller = sellers.find(s => s.id === sellerId)
  const kennel = kennels.find(k => k.id === seller?.kennelId)
  const membershipFee = adminSettings?.membershipFeeAnnual ?? 1200
  const defaultCommission = adminSettings?.defaultCommission ?? 8

  const [form, setForm] = useState({ name: '', card: '', expiry: '', cvv: '' })
  const [paid, setPaid] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({})

  const set = (key) => (e) => {
    let val = e.target.value
    if (key === 'card') val = formatCard(val)
    if (key === 'expiry') val = formatExpiry(val)
    if (key === 'cvv') val = val.replace(/\D/g, '').slice(0, 4)
    setForm(f => ({ ...f, [key]: val }))
    setErrors(err => ({ ...err, [key]: '' }))
  }

  const validate = () => {
    const e = {}
    if (!form.name.trim()) e.name = 'Required'
    if (form.card.replace(/\s/g, '').length < 16) e.card = 'Enter a valid 16-digit card number'
    if (form.expiry.length < 5) e.expiry = 'Enter MM/YY'
    if (form.cvv.length < 3) e.cvv = 'Enter 3–4 digits'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handlePay = (e) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    setTimeout(() => {
      payMembership(sellerId)
      setLoading(false)
      setPaid(true)
    }, 1800)
  }

  if (!seller || !kennel) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center p-4">
        <div className="text-center">
          <p className="font-display text-2xl text-espresso mb-4">Invalid payment link.</p>
          <Link to="/" className="btn-primary text-xs tracking-widest uppercase">Go to Home</Link>
        </div>
      </div>
    )
  }

  if (paid) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 bg-sage/20 mx-auto flex items-center justify-center mb-6">
            <CheckCircle className="w-9 h-9 text-sage-dark" />
          </div>
          <h1 className="font-display text-3xl font-semibold text-espresso mb-2">Payment Successful!</h1>
          <p className="font-body text-sm text-muted mb-6 leading-relaxed">
            Your Chihuahua South Africa membership for <strong className="text-espresso">{kennel.name}</strong> is now active.
            Your seller portal is ready — you can start listing Chihuahua puppies immediately.
          </p>
          <div className="bg-white border border-divider p-5 text-left mb-6 space-y-2">
            <div className="flex justify-between font-body text-sm">
              <span className="text-muted">Kennel</span>
              <span className="font-semibold text-espresso">{kennel.name}</span>
            </div>
            <div className="flex justify-between font-body text-sm">
              <span className="text-muted">Registry</span>
              <span className="font-semibold text-espresso">{kennel.registry}</span>
            </div>
            <div className="flex justify-between font-body text-sm">
              <span className="text-muted">Amount paid</span>
              <span className="font-semibold text-espresso">R{membershipFee.toLocaleString()}</span>
            </div>
            <div className="flex justify-between font-body text-sm">
              <span className="text-muted">Membership valid until</span>
              <span className="font-semibold text-sage-dark">
                {new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toLocaleDateString('en-ZA', { day: '2-digit', month: 'long', year: 'numeric' })}
              </span>
            </div>
          </div>
          <Link to="/seller/login" className="btn-primary text-xs tracking-widest uppercase block text-center py-4">
            Go to My Seller Portal →
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <div className="bg-espresso py-4 px-4">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <LogoCompact light />
          <div className="flex items-center gap-1.5 font-body text-xs text-cream/60">
            <Lock className="w-3.5 h-3.5" />
            Secure Payment
          </div>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 py-10">
        {/* Order summary */}
        <div className="bg-white border border-divider p-5 mb-6">
          <p className="font-body text-xs text-muted uppercase tracking-widest mb-3">Payment Summary</p>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="font-body font-semibold text-espresso">Annual Membership Fee</p>
              <p className="font-body text-xs text-muted mt-0.5">{kennel.name} · {kennel.registry} · Valid 12 months</p>
            </div>
            <span className="font-display text-2xl font-semibold text-espresso">
              R{membershipFee.toLocaleString()}
            </span>
          </div>
          <div className="border-t border-divider pt-3 space-y-1.5 font-body text-xs text-muted">
            <div className="flex items-center gap-2"><Shield className="w-3.5 h-3.5 text-sage" /> List unlimited Chihuahua puppies for 12 months</div>
            <div className="flex items-center gap-2"><Shield className="w-3.5 h-3.5 text-sage" /> Verified kennel badge on all listings</div>
            <div className="flex items-center gap-2"><Shield className="w-3.5 h-3.5 text-sage" /> {defaultCommission}% commission on sales (standard rate)</div>
          </div>
        </div>

        {/* Payment form */}
        <div className="bg-white border border-divider p-6">
          <div className="flex items-center gap-2 mb-5">
            <CreditCard className="w-4 h-4 text-muted" />
            <p className="font-body text-sm font-semibold text-espresso">Card Details</p>
            <div className="ml-auto flex gap-1.5">
              {['VISA', 'MC', 'AMEX'].map(b => (
                <span key={b} className="bg-cream border border-divider text-[9px] font-bold text-muted px-1.5 py-0.5">{b}</span>
              ))}
            </div>
          </div>

          <form onSubmit={handlePay} className="space-y-4">
            <div>
              <label className="label">Name on Card</label>
              <input
                className={`input-field ${errors.name ? 'border-red-400' : ''}`}
                placeholder="As it appears on your card"
                value={form.name}
                onChange={set('name')}
              />
              {errors.name && <p className="font-body text-xs text-red-500 mt-1">{errors.name}</p>}
            </div>

            <div>
              <label className="label">Card Number</label>
              <input
                className={`input-field font-mono tracking-widest ${errors.card ? 'border-red-400' : ''}`}
                placeholder="0000 0000 0000 0000"
                value={form.card}
                onChange={set('card')}
                inputMode="numeric"
              />
              {errors.card && <p className="font-body text-xs text-red-500 mt-1">{errors.card}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Expiry Date</label>
                <input
                  className={`input-field font-mono tracking-widest ${errors.expiry ? 'border-red-400' : ''}`}
                  placeholder="MM/YY"
                  value={form.expiry}
                  onChange={set('expiry')}
                  inputMode="numeric"
                />
                {errors.expiry && <p className="font-body text-xs text-red-500 mt-1">{errors.expiry}</p>}
              </div>
              <div>
                <label className="label">CVV</label>
                <input
                  className={`input-field font-mono tracking-widest ${errors.cvv ? 'border-red-400' : ''}`}
                  placeholder="000"
                  value={form.cvv}
                  onChange={set('cvv')}
                  inputMode="numeric"
                  type="password"
                />
                {errors.cvv && <p className="font-body text-xs text-red-500 mt-1">{errors.cvv}</p>}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-4 font-body font-semibold text-sm tracking-widest uppercase transition-all flex items-center justify-center gap-2 ${
                loading ? 'bg-muted text-cream cursor-not-allowed' : 'bg-sienna text-white hover:bg-sienna-dark'
              }`}
            >
              <Lock className="w-4 h-4" />
              {loading ? 'Processing...' : `Pay R${membershipFee.toLocaleString()}`}
            </button>
          </form>

          <p className="font-body text-xs text-muted text-center mt-4 leading-relaxed">
            🔒 This is a demo — no real payment is processed. Powered by Chihuahua South Africa.
          </p>
        </div>
      </div>
    </div>
  )
}
