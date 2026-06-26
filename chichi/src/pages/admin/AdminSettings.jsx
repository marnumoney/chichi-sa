import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { Check, Plus, Copy, Trash2 } from 'lucide-react'

function genCode() {
  return 'DISC-' + Math.random().toString(36).slice(2, 8).toUpperCase()
}

export default function AdminSettings() {
  const { adminSettings, updateAdminSettings, sellers, kennels } = useApp()
  const [fees, setFees] = useState({
    defaultCommission: adminSettings?.defaultCommission ?? 8,
    membershipFeeAnnual: adminSettings?.membershipFeeAnnual ?? 1200,
    referralDiscount: adminSettings?.referralDiscount ?? 1.5,
  })
  const [feesSaved, setFeesSaved] = useState(false)
  const [codes, setCodes] = useState([])
  const [newCodeKennel, setNewCodeKennel] = useState('')
  const [copiedCode, setCopiedCode] = useState(null)

  const saveFees = async (e) => {
    e.preventDefault()
    await updateAdminSettings({
      defaultCommission: Number(fees.defaultCommission),
      membershipFeeAnnual: Number(fees.membershipFeeAnnual),
      referralDiscount: Number(fees.referralDiscount),
    })
    setFeesSaved(true)
    setTimeout(() => setFeesSaved(false), 2500)
  }

  const generateCode = () => {
    if (!newCodeKennel) return
    const seller = sellers.find(s => s.kennelId === newCodeKennel)
    const kennel = kennels.find(k => k.id === newCodeKennel)
    const code = genCode()
    setCodes(prev => [...prev, {
      id: `dc${Date.now()}`,
      code,
      kennelId: newCodeKennel,
      kennelName: kennel?.name ?? '—',
      sellerName: seller?.name ?? '—',
      used: false,
      createdDate: new Date().toISOString().split('T')[0],
    }])
    setNewCodeKennel('')
  }

  const copyCode = (code) => {
    navigator.clipboard.writeText(code)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  const removeCode = (id) => setCodes(prev => prev.filter(c => c.id !== id))

  return (
    <div>
      <div className="mb-8">
        <h2 className="font-display text-3xl font-semibold text-espresso mb-1">Settings</h2>
        <p className="font-body text-sm text-muted">Manage platform fees, commission rates, and one-time discount codes.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Fee settings */}
        <div className="bg-white border border-divider p-6">
          <h3 className="font-body font-semibold text-sm text-espresso mb-5">Platform Fees</h3>
          <form onSubmit={saveFees} className="space-y-4">
            <div>
              <label className="label">Default Commission (%)</label>
              <input type="number" min="0" max="50" step="0.5" className="input-field"
                value={fees.defaultCommission} onChange={e => setFees(f => ({ ...f, defaultCommission: e.target.value }))} />
              <p className="font-body text-[10px] text-muted mt-1">Applied to all new kennels. Existing kennels keep their individual rate.</p>
            </div>
            <div>
              <label className="label">Annual Membership Fee (R)</label>
              <input type="number" min="0" className="input-field"
                value={fees.membershipFeeAnnual} onChange={e => setFees(f => ({ ...f, membershipFeeAnnual: e.target.value }))} />
            </div>
            <div>
              <label className="label">Referral Discount (%)</label>
              <input type="number" min="0" max="10" step="0.5" className="input-field"
                value={fees.referralDiscount} onChange={e => setFees(f => ({ ...f, referralDiscount: e.target.value }))} />
              <p className="font-body text-[10px] text-muted mt-1">Commission reduction for sellers who refer new breeders.</p>
            </div>
            <div className="bg-cream border border-divider p-3 font-body text-xs text-muted space-y-1">
              <p>Preview: On a <strong>R10,000</strong> sale at current rates:</p>
              <p>Commission: <strong className="text-sienna">R{(10000 * fees.defaultCommission / 100).toLocaleString()}</strong></p>
              <p>Seller receives: <strong className="text-sage-dark">R{(10000 * (1 - fees.defaultCommission / 100)).toLocaleString()}</strong></p>
            </div>
            <button type="submit" className={`flex items-center gap-2 px-6 py-2.5 font-body text-xs font-semibold tracking-widest uppercase ${feesSaved ? 'bg-sage text-white' : 'btn-primary'}`}>
              {feesSaved ? <><Check className="w-3.5 h-3.5" /> Saved!</> : 'Save Fee Settings'}
            </button>
          </form>
        </div>

        {/* Discount codes */}
        <div className="bg-white border border-divider p-6">
          <h3 className="font-body font-semibold text-sm text-espresso mb-2">One-Time Membership Discount Codes</h3>
          <p className="font-body text-xs text-muted mb-5 leading-relaxed">
            Generate a single-use code tied to a specific kennel. The code gives that breeder a free membership — it cannot be shared or reused. The breeder's referral code can still be used separately for commission discounts.
          </p>

          <div className="flex gap-2 mb-5">
            <select className="input-field flex-1 py-2 text-xs" value={newCodeKennel} onChange={e => setNewCodeKennel(e.target.value)}>
              <option value="">Select kennel to generate code for</option>
              {kennels.filter(k => k.status === 'approved').map(k => (
                <option key={k.id} value={k.id}>{k.name}</option>
              ))}
            </select>
            <button onClick={generateCode} disabled={!newCodeKennel}
              className={`flex items-center gap-1.5 px-4 py-2 font-body text-xs font-semibold tracking-widest uppercase ${newCodeKennel ? 'btn-primary' : 'bg-divider text-muted cursor-not-allowed'}`}>
              <Plus className="w-3.5 h-3.5" /> Generate
            </button>
          </div>

          {codes.length === 0 ? (
            <p className="font-body text-xs text-muted italic text-center py-6">No discount codes generated yet.</p>
          ) : (
            <div className="space-y-2">
              {codes.map(c => (
                <div key={c.id} className={`border p-3 space-y-2 ${c.used ? 'border-divider opacity-50' : 'border-sage/30 bg-sage/5'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-body text-xs font-semibold text-espresso">{c.kennelName}</p>
                      <p className="font-body text-[10px] text-muted">{c.sellerName} · Created {c.createdDate}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      {c.used ? (
                        <span className="text-[10px] font-bold uppercase tracking-widest bg-red-100 text-red-600 px-2 py-0.5">Used</span>
                      ) : (
                        <span className="text-[10px] font-bold uppercase tracking-widest bg-sage/15 text-sage-dark px-2 py-0.5">Active</span>
                      )}
                      <button onClick={() => removeCode(c.id)} className="text-muted hover:text-red-500 transition-colors p-1">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  {!c.used && (
                    <div className="flex items-center gap-2 bg-cream border border-divider px-3 py-2">
                      <code className="flex-1 font-mono text-sm font-semibold text-espresso tracking-widest">{c.code}</code>
                      <button onClick={() => copyCode(c.code)}
                        className={`flex items-center gap-1 font-body text-[10px] font-bold uppercase px-2.5 py-1 transition-colors ${copiedCode === c.code ? 'bg-sage text-white' : 'bg-espresso text-cream hover:bg-sienna'}`}>
                        {copiedCode === c.code ? <><Check className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
