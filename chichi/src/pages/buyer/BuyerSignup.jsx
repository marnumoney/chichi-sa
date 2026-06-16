import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { Logo } from '../../components/Logo'

export default function BuyerSignup() {
  const { signupBuyer } = useApp()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (form.password.length < 8) { setError('Password must be at least 8 characters.'); return }
    setLoading(true)
    setError('')
    try {
      await signupBuyer(form)
      navigate('/buyer')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-cream flex flex-col items-center justify-center px-4 py-16">
      <Link to="/" className="mb-10"><Logo /></Link>
      <div className="w-full max-w-md bg-white border border-divider p-8">
        <h1 className="font-display text-2xl font-semibold text-espresso mb-1">Create Buyer Account</h1>
        <p className="font-body text-sm text-muted mb-7">Register to purchase puppies and track your orders.</p>

        {error && <p className="font-body text-sm text-red-600 bg-red-50 border border-red-200 px-4 py-3 mb-5">{error}</p>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Full Name *</label>
            <input required className="input-field" placeholder="Your full name" value={form.name} onChange={set('name')} />
          </div>
          <div>
            <label className="label">Email Address *</label>
            <input required type="email" className="input-field" placeholder="your@email.com" value={form.email} onChange={set('email')} />
          </div>
          <div>
            <label className="label">Phone Number</label>
            <input type="tel" className="input-field" placeholder="0821234567" value={form.phone} onChange={set('phone')} />
          </div>
          <div>
            <label className="label">Password *</label>
            <input required type="password" className="input-field" placeholder="Minimum 8 characters" value={form.password} onChange={set('password')} />
          </div>
          <button type="submit" disabled={loading}
            className={`w-full py-3.5 font-body text-xs font-semibold tracking-widest uppercase ${loading ? 'bg-muted text-cream cursor-not-allowed' : 'btn-primary'}`}>
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <p className="font-body text-sm text-muted text-center mt-6">
          Already have an account?{' '}
          <Link to="/buyer/login" className="text-sienna hover:underline font-semibold">Sign in</Link>
        </p>
        <p className="font-body text-xs text-muted text-center mt-3">
          Are you a breeder?{' '}
          <Link to="/seller/signup" className="text-sienna hover:underline">Apply as a seller</Link>
        </p>
      </div>
    </div>
  )
}
