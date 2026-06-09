import { useState, useEffect } from 'react'
import { useApp } from '../../context/AppContext'
import { Save, Check, Copy, Upload, Landmark } from 'lucide-react'

const SA_BANKS = [
  'ABSA Bank', 'Capitec Bank', 'FNB (First National Bank)', 'Nedbank',
  'Standard Bank', 'African Bank', 'Bidvest Bank', 'Discovery Bank',
  'Investec', 'TymeBank', 'Other',
]

export default function SellerProfile() {
  const { sellerUser, updateSellerProfile } = useApp()
  const kennel = sellerUser?.kennel

  const [form, setForm] = useState({
    name: kennel?.name ?? '',
    description: kennel?.description ?? '',
    location: kennel?.location ?? '',
    contact: kennel?.contact ?? '',
    phone: kennel?.phone ?? '',
    bankName: kennel?.bankName ?? '',
    accountHolder: kennel?.accountHolder ?? '',
    accountNumber: kennel?.accountNumber ?? '',
    branchCode: kennel?.branchCode ?? '',
    accountType: kennel?.accountType ?? '',
  })
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)
  const [logoPreview, setLogoPreview] = useState(null)

  // Re-populate form if kennel data arrives after initial mount (page refresh)
  useEffect(() => {
    if (!kennel) return
    setForm({
      name: kennel.name ?? '',
      description: kennel.description ?? '',
      location: kennel.location ?? '',
      contact: kennel.contact ?? '',
      phone: kennel.phone ?? '',
      bankName: kennel.bankName ?? '',
      accountHolder: kennel.accountHolder ?? '',
      accountNumber: kennel.accountNumber ?? '',
      branchCode: kennel.branchCode ?? '',
      accountType: kennel.accountType ?? '',
    })
  }, [kennel?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }))

  const handleSave = (e) => {
    e.preventDefault()
    updateSellerProfile(form)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(kennel?.referralCode ?? '')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleLogoUpload = (e) => {
    const file = e.target.files[0]
    if (file) setLogoPreview(URL.createObjectURL(file))
  }

  const hasChanges = Object.keys(form).some(k => form[k] !== (kennel?.[k] ?? ''))

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h2 className="font-display text-3xl font-semibold text-espresso mb-1">Kennel Profile</h2>
        <p className="font-body text-sm text-muted">This information is displayed publicly on your kennel listing.</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Logo */}
        <div className="bg-white border border-divider p-6">
          <h3 className="font-body font-semibold text-sm text-espresso mb-4">Kennel Logo</h3>
          <div className="flex items-center gap-5">
            <div
              className="w-20 h-20 flex items-center justify-center text-white font-bold text-lg overflow-hidden flex-shrink-0"
              style={{ backgroundColor: kennel?.color ?? '#8B7355' }}
            >
              {logoPreview
                ? <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" />
                : kennel?.initials ?? '??'
              }
            </div>
            <div>
              <p className="font-body text-sm text-espresso font-semibold mb-1">{kennel?.name}</p>
              <p className="font-body text-xs text-muted mb-3">{logoPreview ? 'Custom logo uploaded' : 'Using initials placeholder'}</p>
              <label className="flex items-center gap-2 btn-outline text-xs tracking-widest uppercase cursor-pointer py-2 px-4">
                <Upload className="w-3.5 h-3.5" />
                Upload Logo
                <input type="file" accept="image/*" className="sr-only" onChange={handleLogoUpload} />
              </label>
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="bg-white border border-divider p-6 space-y-4">
          <h3 className="font-body font-semibold text-sm text-espresso mb-2">Kennel Information</h3>

          <div>
            <label className="label">Kennel Name *</label>
            <input className="input-field" required value={form.name} onChange={set('name')} />
          </div>

          <div>
            <label className="label">Registry</label>
            <input className="input-field bg-cream" readOnly value={kennel?.registry ?? ''} />
          </div>

          <div>
            <label className="label">Location *</label>
            <input className="input-field" required value={form.location} onChange={set('location')} placeholder="City, Province" />
          </div>

          <div>
            <label className="label">Kennel Description *</label>
            <textarea
              className="input-field"
              required
              rows={4}
              value={form.description}
              onChange={set('description')}
              placeholder="Tell buyers about your kennel, breeding philosophy, and what makes your dogs special..."
            />
          </div>
        </div>

        {/* Contact */}
        <div className="bg-white border border-divider p-6 space-y-4">
          <h3 className="font-body font-semibold text-sm text-espresso mb-2">Contact Details</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Email *</label>
              <input type="email" className="input-field" required value={form.contact} onChange={set('contact')} />
            </div>
            <div>
              <label className="label">Phone *</label>
              <input type="tel" className="input-field" required value={form.phone} onChange={set('phone')} />
            </div>
          </div>
        </div>

        {/* Banking details */}
        <div className="bg-white border border-divider p-6 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Landmark className="w-4 h-4 text-sienna" />
            <h3 className="font-body font-semibold text-sm text-espresso">Banking Details</h3>
          </div>
          <p className="font-body text-xs text-muted leading-relaxed">
            Your payout will be sent via EFT to this account when the admin releases your payment after delivery is confirmed.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Bank Name *</label>
              <select className="input-field" value={form.bankName} onChange={set('bankName')}>
                <option value="">Select your bank</option>
                {SA_BANKS.map(b => <option key={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Account Type *</label>
              <div className="flex border border-divider overflow-hidden">
                {['Cheque / Current', 'Savings', 'Transmission'].map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, accountType: t }))}
                    className={`flex-1 py-2.5 font-body text-xs font-semibold transition-colors ${form.accountType === t ? 'bg-espresso text-cream' : 'bg-white text-muted hover:text-espresso'}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="label">Account Holder Name *</label>
              <input className="input-field" value={form.accountHolder} onChange={set('accountHolder')} placeholder="Full name as on bank account" />
            </div>
            <div>
              <label className="label">Account Number *</label>
              <input className="input-field font-mono tracking-widest" value={form.accountNumber} onChange={set('accountNumber')} placeholder="e.g. 1234567890" inputMode="numeric" />
            </div>
            <div>
              <label className="label">Branch Code *</label>
              <input className="input-field font-mono" value={form.branchCode} onChange={set('branchCode')} placeholder="e.g. 632005" inputMode="numeric" />
              <p className="font-body text-[10px] text-muted mt-1">FNB: 250655 · ABSA: 632005 · Standard: 051001 · Nedbank: 198765 · Capitec: 470010</p>
            </div>
          </div>
          {form.bankName && form.accountNumber && (
            <div className="bg-sage/5 border border-sage/20 p-3 font-body text-xs text-sage-dark">
              ✓ Banking details saved — admin will EFT R[payout amount] to <strong>{form.accountHolder}</strong> at <strong>{form.bankName}</strong>, Acc: <strong>{form.accountNumber}</strong>
            </div>
          )}
        </div>

        {/* Referral */}
        <div className="bg-white border border-divider p-6">
          <h3 className="font-body font-semibold text-sm text-espresso mb-1">Your Referral Code</h3>
          <p className="font-body text-xs text-muted mb-4 leading-relaxed">
            Share this code with other breeders. When they sign up and make their first sale, you'll automatically receive a commission discount on all future sales.
          </p>
          {kennel?.referralCode ? (
            <div className="flex items-center gap-2 bg-cream border border-divider px-4 py-3">
              <code className="flex-1 font-mono text-sm font-semibold text-espresso tracking-widest">
                {kennel.referralCode}
              </code>
              <button
                type="button"
                onClick={handleCopy}
                className={`flex items-center gap-1.5 font-body text-xs font-medium px-3 py-1.5 transition-colors ${copied ? 'bg-sage text-white' : 'bg-espresso text-cream hover:bg-sienna'}`}
              >
                {copied ? <><Check className="w-3.5 h-3.5" /> Copied!</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
              </button>
            </div>
          ) : (
            <p className="font-body text-xs text-muted italic">Referral code will be generated after your first sale.</p>
          )}
        </div>

        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={!hasChanges}
            className={`flex items-center gap-2 px-6 py-3 font-body text-xs font-semibold tracking-widest uppercase transition-all ${
              saved ? 'bg-sage text-white' : hasChanges ? 'btn-primary' : 'bg-divider text-muted cursor-not-allowed'
            }`}
          >
            {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saved ? 'Profile Saved!' : 'Save Changes'}
          </button>
          {hasChanges && <p className="font-body text-xs text-muted">You have unsaved changes.</p>}
        </div>
      </form>
    </div>
  )
}
