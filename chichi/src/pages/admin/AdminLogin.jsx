import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { Eye, EyeOff } from 'lucide-react'
import { Logo } from '../../components/Logo'

export default function AdminLogin() {
  const { loginAdmin } = useApp()
  const navigate = useNavigate()
  const [email, setEmail] = useState('admin@chihuahuasa.co.za')
  const [password, setPassword] = useState('admin123')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (await loginAdmin(email, password)) {
      navigate('/admin')
    } else {
      setError('Invalid credentials.')
    }
  }

  return (
    <div className="min-h-screen bg-espresso flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center mb-10">
          <Logo light size="lg" />
        </div>

        <div className="bg-cream p-8">
          <h1 className="font-display text-2xl font-semibold text-espresso mb-1">Admin Login</h1>
          <p className="font-body text-xs text-muted mb-6 tracking-wide">Back office access only</p>

          <div className="bg-sage/10 border border-sage/30 px-3 py-2 mb-5 font-body text-xs text-sage-dark leading-relaxed">
            <strong>Demo:</strong> admin@chihuahuasa.co.za / admin123
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
                  className="input-field pr-10"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-espresso" onClick={() => setShowPw(!showPw)}>
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            {error && <p className="font-body text-xs text-red-600">{error}</p>}
            <button type="submit" className="w-full btn-primary text-xs tracking-widest uppercase py-3.5 mt-2">
              Sign In
            </button>
          </form>
        </div>

        <div className="text-center mt-6">
          <Link to="/" className="font-body text-xs text-cream/50 hover:text-cream transition-colors">
            ← Back to Chihuahua South Africa
          </Link>
        </div>
      </div>
    </div>
  )
}
