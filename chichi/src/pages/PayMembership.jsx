import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { CheckCircle, Shield, Copy, Check } from 'lucide-react'
import { LogoCompact } from '../components/Logo'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export default function PayMembership() {
  const [params] = useSearchParams()
  const { payMembership, adminSettings } = useApp()

  const sellerId = params.get('seller')
  const membershipFee = adminSettings?.membershipFeeAnnual ?? 1200
  const defaultCommission = adminSettings?.defaultCommission ?? 8

  const [seller, setSeller] = useState(null)
  const [kennel, setKennel] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const [paid, setPaid] = useState(false)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(null)

  useEffect(() => {
    if (!sellerId) { setNotFound(true); return }
    fetch(`${API}/sellers/${sellerId}/payment-info`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => {
        if (!data.seller || !data.kennel) { setNotFound(true); return }
        setSeller(data.seller)
        setKennel(data.kennel)
      })
      .catch(() => setNotFound(true))
  }, [sellerId])

  const copyToClipboard = (text, field) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(field)
      setTimeout(() => setCopied(null), 2000)
    })
  }

  const handleConfirm = () => {
    setLoading(true)
    payMembership(sellerId).then(() => {
      setLoading(false)
      setPaid(true)
    })
  }

  const bankDetails = [
    { label: 'Bank', value: adminSettings?.adminBankName || 'FNB' },
    { label: 'Account Holder', value: adminSettings?.adminAccountHolder || 'Chihuahua South Africa' },
    { label: 'Account Number', value: adminSettings?.adminAccountNumber || '—' },
    { label: 'Branch Code', value: adminSettings?.adminBranchCode || '—' },
    { label: 'Account Type', value: adminSettings?.adminAccountType || 'Cheque / Current' },
    { label: 'Reference', value: kennel?.name || sellerId },
  ]

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

  if (!seller || !kennel) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center p-4">
        <p className="font-body text-sm text-muted">Loading…</p>
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
            Secure EFT Payment
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

        {/* Banking details */}
        <div className="bg-white border border-divider p-6 mb-6">
          <p className="font-body text-xs font-semibold uppercase tracking-widest text-muted mb-4">EFT Banking Details</p>
          <div className="space-y-3">
            {bankDetails.map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between py-2 border-b border-divider last:border-0">
                <span className="font-body text-xs text-muted">{label}</span>
                <div className="flex items-center gap-2">
                  <span className="font-body text-sm font-semibold text-espresso font-mono">{value}</span>
                  {value && value !== '—' && (
                    <button
                      type="button"
                      onClick={() => copyToClipboard(value, label)}
                      className="text-muted hover:text-sienna transition-colors"
                    >
                      {copied === label ? <Check className="w-3.5 h-3.5 text-sage-dark" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <p className="font-body text-xs text-muted mt-4 p-3 bg-cream border border-divider leading-relaxed">
            Please use your kennel name <strong className="text-espresso">"{kennel.name}"</strong> as the payment reference. Once your EFT reflects, click the button below to notify us.
          </p>
        </div>

        {/* Confirm button */}
        <button
          onClick={handleConfirm}
          disabled={loading}
          className={`w-full py-4 font-body font-semibold text-sm tracking-widest uppercase flex items-center justify-center gap-2 transition-colors ${loading ? 'bg-muted text-cream cursor-not-allowed' : 'bg-sienna text-white hover:bg-sienna-dark'}`}
        >
          <CheckCircle className="w-4 h-4" />
          {loading ? 'Confirming...' : "I've Made My EFT Payment"}
        </button>
        <p className="font-body text-xs text-muted text-center mt-3">
          Your account will be activated once payment is verified. This usually takes 1–2 business days.
        </p>
      </div>
    </div>
  )
}
