import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { CheckCircle, Shield } from 'lucide-react'
import { LogoCompact } from '../components/Logo'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export default function PayMembership() {
  const [params] = useSearchParams()
  const { payMembership } = useApp()

  const sellerId = params.get('seller')

  const [seller, setSeller] = useState(null)
  const [kennel, setKennel] = useState(null)
  const [membershipFee, setMembershipFee] = useState(null)
  const [defaultCommission, setDefaultCommission] = useState(8)
  const [notFound, setNotFound] = useState(false)
  const [paid, setPaid] = useState(params.get('paid') === 'true')
  const [loading, setLoading] = useState(false)
  const [verifying, setVerifying] = useState(params.get('paid') === 'true')

  useEffect(() => {
    if (!sellerId) { setNotFound(true); return }
    fetch(`${API}/sellers/${sellerId}/payment-info`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => {
        if (!data.seller || !data.kennel) { setNotFound(true); return }
        setSeller(data.seller)
        setKennel(data.kennel)
        setMembershipFee(data.membership_fee ?? 1200)
        setDefaultCommission(data.default_commission ?? 8)
      })
      .catch(() => setNotFound(true))
  }, [sellerId])

  useEffect(() => {
    if (!paid || !sellerId) return
    const checkoutId = sessionStorage.getItem(`yoco_checkout_${sellerId}`)
    if (!checkoutId) { setVerifying(false); return }
    fetch(`${API}/yoco/verify-membership`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ checkout_id: checkoutId, seller_id: sellerId }),
    })
      .then(() => sessionStorage.removeItem(`yoco_checkout_${sellerId}`))
      .catch(() => {})
      .finally(() => setVerifying(false))
  }, [paid, sellerId])

  const handleYoco = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/yoco/membership-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seller_id: sellerId }),
      })
      if (!res.ok) throw new Error('Payment provider error')
      const { redirect_url, checkout_id } = await res.json()
      sessionStorage.setItem(`yoco_checkout_${sellerId}`, checkout_id)
      window.location.href = redirect_url
    } catch (_) {
      setLoading(false)
    }
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center p-4">
        <div className="text-center">
          <p className="font-display text-2xl text-espresso mb-4">Invalid payment link.</p>
          <Link to="/" className="btn-primary text-xs tracking-widest uppercase">Go to Home</Link>
        </div>
      </div>
    )
  }

  if (!seller || !kennel || membershipFee === null) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center p-4">
        <p className="font-body text-sm text-muted">Loading…</p>
      </div>
    )
  }

  if (paid && verifying) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center p-4">
        <p className="font-body text-sm text-muted">Confirming payment…</p>
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
          <h1 className="font-display text-3xl font-semibold text-espresso mb-2">Payment Confirmed!</h1>
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
              <span className="text-muted">Amount</span>
              <span className="font-semibold text-espresso">R{membershipFee.toLocaleString()}</span>
            </div>
            <div className="flex justify-between font-body text-sm">
              <span className="text-muted">Valid until</span>
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
      <div className="bg-espresso py-4 px-4">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <LogoCompact light />
          <div className="flex items-center gap-1.5 font-body text-xs text-cream/60">
            <Shield className="w-3.5 h-3.5" />
            Secure Payment via Yoco
          </div>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 py-10">
        {/* Summary */}
        <div className="bg-white border border-divider p-5 mb-6">
          <p className="font-body text-xs text-muted uppercase tracking-widest mb-3">Payment Summary</p>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="font-body font-semibold text-espresso">Annual Membership Fee</p>
              <p className="font-body text-xs text-muted mt-0.5">{kennel.name} · {kennel.registry} · Valid 12 months</p>
            </div>
            <span className="font-display text-2xl font-semibold text-espresso">R{membershipFee.toLocaleString()}</span>
          </div>
          <div className="border-t border-divider pt-3 space-y-1.5 font-body text-xs text-muted">
            <div className="flex items-center gap-2"><Shield className="w-3.5 h-3.5 text-sage" /> List unlimited Chihuahua puppies for 12 months</div>
            <div className="flex items-center gap-2"><Shield className="w-3.5 h-3.5 text-sage" /> Verified kennel badge on all listings</div>
            <div className="flex items-center gap-2"><Shield className="w-3.5 h-3.5 text-sage" /> {defaultCommission}% commission on sales (standard rate)</div>
          </div>
        </div>

        {/* Yoco button */}
        <div className="bg-white border border-divider p-6 mb-6 text-center space-y-4">
          <p className="font-body text-xs text-muted uppercase tracking-widest">Secure Payment via</p>
          <p className="font-display text-2xl font-bold text-espresso tracking-widest">YOCO</p>
          <p className="font-body text-sm text-muted leading-relaxed">
            You'll be redirected to Yoco to complete your payment securely. Once paid, your seller portal will be activated automatically.
          </p>
        </div>

        <button
          onClick={handleYoco}
          disabled={loading}
          className={`w-full py-4 font-body font-semibold text-sm tracking-widest uppercase flex items-center justify-center gap-2 transition-colors ${loading ? 'bg-muted text-cream cursor-not-allowed' : 'bg-sienna text-white hover:bg-sienna-dark'}`}
        >
          <CheckCircle className="w-4 h-4" />
          {loading ? 'Redirecting to Yoco...' : `Pay R${membershipFee.toLocaleString()} via Yoco`}
        </button>
        <p className="font-body text-xs text-muted text-center mt-3">
          🔒 Secure SA payments. Your portal activates automatically on payment confirmation.
        </p>
      </div>
    </div>
  )
}
