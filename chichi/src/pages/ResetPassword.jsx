import { useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { Logo } from '../components/Logo'
import { Check } from 'lucide-react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const type = searchParams.get('type') || 'buyer'
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const loginLink = type === 'seller' ? '/seller/login' : '/buyer/login'

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }
    setLoading(true)
    setError('')
    const res = await fetch(`${API}/auth/${type}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    })
    if (res.ok) {
      setDone(true)
      setTimeout(() => navigate(loginLink), 3000)
    } else {
      const data = await res.json()
      setError(data.detail || 'Reset failed. The link may have expired.')
    }
    setLoading(false)
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-cream flex flex-col items-center justify-center px-4">
        <div className="bg-white border border-divider p-8 max-w-md w-full text-center">
          <p className="font-body text-sm text-red-600 mb-4">Invalid reset link.</p>
          <Link to={loginLink} className="btn-primary text-xs tracking-widest uppercase py-3 px-6">Back to Login</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-cream flex flex-col items-center justify-center px-4 py-16">
      <Link to="/" className="mb-10"><Logo /></Link>
      <div className="w-full max-w-md bg-white border border-divider p-8">
        {done ? (
          <div className="text-center space-y-4">
            <div className="w-12 h-12 bg-sage/20 mx-auto flex items-center justify-center">
              <Check className="w-6 h-6 text-sage-dark" />
            </div>
            <h1 className="font-display text-2xl font-semibold text-espresso">Password Updated!</h1>
            <p className="font-body text-sm text-muted">Redirecting you to login…</p>
          </div>
        ) : (
          <>
            <h1 className="font-display text-2xl font-semibold text-espresso mb-1">Set New Password</h1>
            <p className="font-body text-sm text-muted mb-7">Enter a new password for your account.</p>

            {error && <p className="font-body text-sm text-red-600 bg-red-50 border border-red-200 px-4 py-3 mb-5">{error}</p>}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">New Password</label>
                <input required type="password" className="input-field" placeholder="Minimum 8 characters"
                  value={password} onChange={e => setPassword(e.target.value)} />
              </div>
              <div>
                <label className="label">Confirm Password</label>
                <input required type="password" className="input-field" placeholder="Repeat new password"
                  value={confirm} onChange={e => setConfirm(e.target.value)} />
              </div>
              <button type="submit" disabled={loading}
                className={`w-full py-3.5 font-body text-xs font-semibold tracking-widest uppercase ${loading ? 'bg-muted text-cream cursor-not-allowed' : 'btn-primary'}`}>
                {loading ? 'Saving...' : 'Update Password'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
