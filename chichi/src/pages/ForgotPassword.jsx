import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Logo } from '../components/Logo'
import { Check } from 'lucide-react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export default function ForgotPassword() {
  const [searchParams] = useSearchParams()
  const type = searchParams.get('type') || 'buyer'
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    await fetch(`${API}/auth/${type}/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    setSent(true)
    setLoading(false)
  }

  const backLink = type === 'seller' ? '/seller/login' : '/buyer/login'
  const label = type === 'seller' ? 'Breeder' : 'Buyer'

  return (
    <div className="min-h-screen bg-cream flex flex-col items-center justify-center px-4 py-16">
      <Link to="/" className="mb-10"><Logo /></Link>
      <div className="w-full max-w-md bg-white border border-divider p-8">
        {sent ? (
          <div className="text-center space-y-4">
            <div className="w-12 h-12 bg-sage/20 mx-auto flex items-center justify-center">
              <Check className="w-6 h-6 text-sage-dark" />
            </div>
            <h1 className="font-display text-2xl font-semibold text-espresso">Check your email</h1>
            <p className="font-body text-sm text-muted">
              If <strong className="text-espresso">{email}</strong> is registered, you'll receive a reset link shortly. It's valid for 1 hour.
            </p>
            <p className="font-body text-xs text-muted">Didn't get it? Check your spam folder.</p>
            <Link to={backLink} className="block w-full btn-primary text-xs tracking-widest uppercase py-3 text-center mt-4">
              Back to Login
            </Link>
          </div>
        ) : (
          <>
            <h1 className="font-display text-2xl font-semibold text-espresso mb-1">Forgot Password</h1>
            <p className="font-body text-sm text-muted mb-7">
              Enter your {label} account email and we'll send you a reset link.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Email Address</label>
                <input required type="email" className="input-field" placeholder="your@email.com"
                  value={email} onChange={e => setEmail(e.target.value)} />
              </div>
              <button type="submit" disabled={loading}
                className={`w-full py-3.5 font-body text-xs font-semibold tracking-widest uppercase ${loading ? 'bg-muted text-cream cursor-not-allowed' : 'btn-primary'}`}>
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>
            <p className="font-body text-sm text-muted text-center mt-6">
              <Link to={backLink} className="text-sienna hover:underline">Back to Login</Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
