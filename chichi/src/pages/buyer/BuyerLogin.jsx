import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { Logo } from '../../components/Logo'

export default function BuyerLogin() {
  const { loginBuyer } = useApp()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const from = location.state?.from || '/buyer'
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const result = await loginBuyer(form.email, form.password)
    if (result.success) {
      navigate(from, { replace: true })
    } else {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-cream flex flex-col items-center justify-center px-4 py-16">
      <Link to="/" className="mb-10"><Logo /></Link>
      <div className="w-full max-w-md bg-white border border-divider p-8">
        <h1 className="font-display text-2xl font-semibold text-espresso mb-1">Buyer Login</h1>
        <p className="font-body text-sm text-muted mb-7">Sign in to purchase puppies and view your orders.</p>

        {error && <p className="font-body text-sm text-red-600 bg-red-50 border border-red-200 px-4 py-3 mb-5">{error}</p>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Email Address</label>
            <input required type="email" className="input-field" placeholder="your@email.com" value={form.email} onChange={set('email')} />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="label mb-0">Password</label>
              <Link to="/forgot-password?type=buyer" className="font-body text-xs text-sienna hover:underline">Forgot password?</Link>
            </div>
            <input required type="password" className="input-field" placeholder="Your password" value={form.password} onChange={set('password')} />
          </div>
          <button type="submit" disabled={loading}
            className={`w-full py-3.5 font-body text-xs font-semibold tracking-widest uppercase ${loading ? 'bg-muted text-cream cursor-not-allowed' : 'btn-primary'}`}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="font-body text-sm text-muted text-center mt-6">
          New here?{' '}
          <Link to="/buyer/signup" className="text-sienna hover:underline font-semibold">Create an account</Link>
        </p>
      </div>
    </div>
  )
}
