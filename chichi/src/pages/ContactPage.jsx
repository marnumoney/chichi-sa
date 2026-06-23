import { useState } from 'react'
import { CheckCircle, Loader2 } from 'lucide-react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' })
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState(false)

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(false)
    try {
      const res = await fetch(`${API}/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) setError(true)
    } catch { setError(true) }
    setLoading(false)
    setSent(true)
  }

  if (sent) {
    return (
      <div className="max-w-lg mx-auto px-4 py-24 text-center">
        <div className="w-14 h-14 bg-sage/20 mx-auto flex items-center justify-center mb-5">
          <CheckCircle className="w-8 h-8 text-sage-dark" />
        </div>
        <h1 className="font-display text-3xl font-semibold text-espresso mb-3">Message Sent!</h1>
        <p className="font-body text-sm text-muted">Thank you for reaching out. We'll get back to you within 1–2 business days.</p>
        {error && <p className="font-body text-xs text-amber-600 mt-3">Email delivery issue — please also reach us at chihuahuasouthafrica@gmail.com</p>}
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
      <div className="mb-10">
        <h1 className="font-display text-4xl font-semibold text-espresso mb-3">Contact Us</h1>
        <p className="font-body text-sm text-muted leading-relaxed">
          Have a question about a puppy, a kennel, or the platform? Send us a message and we'll get back to you promptly.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="bg-white border border-divider p-4 sm:p-8 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="label">Your Name *</label>
            <input required className="input-field" value={form.name} onChange={set('name')} placeholder="Full name" />
          </div>
          <div>
            <label className="label">Email Address *</label>
            <input required type="email" className="input-field" value={form.email} onChange={set('email')} placeholder="your@email.com" />
          </div>
        </div>
        <div>
          <label className="label">Subject *</label>
          <select required className="input-field" value={form.subject} onChange={set('subject')}>
            <option value="">Select a topic</option>
            <option>Question about a puppy listing</option>
            <option>Question about a kennel</option>
            <option>Membership or registration</option>
            <option>Payment or transaction query</option>
            <option>General enquiry</option>
            <option>Other</option>
          </select>
        </div>
        <div>
          <label className="label">Message *</label>
          <textarea required rows={5} className="input-field" value={form.message} onChange={set('message')} placeholder="How can we help you?" />
        </div>
        <button type="submit" disabled={loading}
          className={`w-full py-4 flex items-center justify-center gap-2 font-body font-semibold text-xs tracking-widest uppercase transition-colors ${loading ? 'bg-muted text-cream cursor-not-allowed' : 'btn-primary'}`}>
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {loading ? 'Sending...' : 'Send Message'}
        </button>
      </form>
    </div>
  )
}
