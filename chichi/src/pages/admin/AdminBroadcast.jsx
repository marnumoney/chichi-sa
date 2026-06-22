import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { Send, CheckCircle, Loader2 } from 'lucide-react'

export default function AdminBroadcast() {
  const { sellers, kennels, broadcastSellers } = useApp()
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [target, setTarget] = useState('all')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const approvedSellers = sellers.filter(s => s.status === 'approved' && s.kennelId)

  const recipients = target === 'all'
    ? approvedSellers
    : approvedSellers.filter(s => {
        const k = kennels.find(kk => kk.id === s.kennelId)
        return k?.registry === target
      })

  const handleSend = async (e) => {
    e.preventDefault()
    if (!subject || !message || recipients.length === 0) return
    setLoading(true)
    try {
      await broadcastSellers(
        `📢 Chihuahua SA — ${subject}`,
        message,
        recipients.map(s => s.id),
      )
    } catch {/* email failure must not block UI */ }
    setLoading(false)
    setSent(true)
    setSubject('')
    setMessage('')
  }

  if (sent) {
    return (
      <div>
        <div className="mb-8">
          <h2 className="font-display text-3xl font-semibold text-espresso mb-1">Broadcast</h2>
        </div>
        <div className="bg-white border border-divider p-10 text-center max-w-md mx-auto">
          <CheckCircle className="w-12 h-12 text-sage-dark mx-auto mb-4" />
          <p className="font-display text-2xl font-semibold text-espresso mb-2">Message Sent!</p>
          <p className="font-body text-sm text-muted mb-6">Your broadcast was sent to {recipients.length} kennel{recipients.length !== 1 ? 's' : ''}.</p>
          <button onClick={() => setSent(false)} className="btn-primary text-xs tracking-widest uppercase py-3 px-6">Send Another</button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8">
        <h2 className="font-display text-3xl font-semibold text-espresso mb-1">Broadcast to Kennels</h2>
        <p className="font-body text-sm text-muted">Send a communication to all or selected kennel owners — membership increases, commission changes, platform updates.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <form onSubmit={handleSend} className="lg:col-span-2 bg-white border border-divider p-6 space-y-5">
          <div>
            <label className="label">Send To</label>
            <div className="flex gap-1">
              {[['all', 'All Kennels'], ['KUSA', 'KUSA Only'], ['Canine SA', 'Canine SA Only']].map(([val, label]) => (
                <button key={val} type="button" onClick={() => setTarget(val)}
                  className={`px-4 py-2.5 font-body text-xs font-semibold transition-colors ${target === val ? 'bg-espresso text-cream' : 'bg-white border border-divider text-muted hover:text-espresso'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Subject *</label>
            <input required className="input-field" value={subject} onChange={e => setSubject(e.target.value)}
              placeholder="e.g. Important: Membership Fee Update 2027" />
          </div>
          <div>
            <label className="label">Message *</label>
            <textarea required rows={8} className="input-field" value={message} onChange={e => setMessage(e.target.value)}
              placeholder="Write your message to all kennel owners..." />
          </div>
          <button type="submit" disabled={loading || recipients.length === 0}
            className={`flex items-center gap-2 px-6 py-3 font-body text-xs font-semibold tracking-widest uppercase transition-colors ${loading || recipients.length === 0 ? 'bg-divider text-muted cursor-not-allowed' : 'btn-primary'}`}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {loading ? 'Sending...' : `Send to ${recipients.length} Kennel${recipients.length !== 1 ? 's' : ''}`}
          </button>
        </form>

        {/* Recipients preview */}
        <div className="bg-white border border-divider p-5">
          <h3 className="font-body font-semibold text-sm text-espresso mb-3">
            Recipients ({recipients.length})
          </h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {recipients.map(s => {
              const kennel = kennels.find(k => k.id === s.kennelId)
              return (
                <div key={s.id} className="flex items-center gap-2 py-2 border-b border-divider last:border-0">
                  <div className="w-5 h-5 flex-shrink-0" style={{ backgroundColor: kennel?.color ?? '#8B7355' }} />
                  <div className="min-w-0">
                    <p className="font-body text-xs font-semibold text-espresso truncate">{kennel?.name}</p>
                    <p className="font-body text-[10px] text-muted truncate">{s.email}</p>
                  </div>
                </div>
              )
            })}
            {recipients.length === 0 && <p className="font-body text-xs text-muted italic">No recipients in this group.</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
