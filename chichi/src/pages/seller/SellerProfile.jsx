import { useState, useEffect } from 'react'
import { useApp } from '../../context/AppContext'
import { Save, Check, Copy, Upload, Landmark, FileText, X, FileCheck, ExternalLink } from 'lucide-react'
import { uploadImage } from '../../utils/storage'
import { uploadCert } from '../../utils/uploadCert'

const SA_BANKS = [
  'ABSA Bank', 'Capitec Bank', 'FNB (First National Bank)', 'Nedbank',
  'Standard Bank', 'African Bank', 'Bidvest Bank', 'Discovery Bank',
  'Investec', 'TymeBank', 'Other',
]

export default function SellerProfile() {
  const { sellerUser, updateSellerProfile, updateSellerDocuments } = useApp()
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
  const [logoPreview, setLogoPreview] = useState(kennel?.logo ?? null)
  const [logoUploading, setLogoUploading] = useState(false)
  const [logoError, setLogoError] = useState('')
  const [docsSaved, setDocsSaved] = useState(false)
  const [docsUploading, setDocsUploading] = useState(false)
  const [docsError, setDocsError] = useState('')
  const [newKennelCert, setNewKennelCert] = useState(null)
  const [newSireCerts, setNewSireCerts] = useState([])
  const [newDamCerts, setNewDamCerts] = useState([])

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
    setLogoPreview(kennel.logo ?? null)
  }, [kennel?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }))

  const handleSave = async (e) => {
    e.preventDefault()
    await updateSellerProfile(form)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(kennel?.referralCode ?? '')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setLogoPreview(URL.createObjectURL(file))
    setLogoUploading(true)
    setLogoError('')
    try {
      const url = await uploadImage(file)
      await updateSellerProfile({ logo: url })
      setLogoPreview(url)
    } catch (err) {
      setLogoPreview(kennel?.logo ?? null)
      setLogoError(err?.message || 'Logo upload failed. Please try again.')
    } finally {
      setLogoUploading(false)
    }
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
              className="w-20 h-20 overflow-hidden flex-shrink-0 flex items-center justify-center text-white font-bold text-lg"
              style={{ backgroundColor: kennel?.color ?? '#8B7355' }}
            >
              {logoPreview
                ? <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" />
                : <span>{kennel?.initials ?? '??'}</span>
              }
            </div>
            <div>
              <p className="font-body text-sm text-espresso font-semibold mb-1">{kennel?.name}</p>
              <p className="font-body text-xs text-muted mb-3">{logoPreview ? 'Custom logo saved' : 'Using initials placeholder'}</p>
              <label className={`flex items-center gap-2 btn-outline text-xs tracking-widest uppercase cursor-pointer py-2 px-4 ${logoUploading ? 'opacity-60 pointer-events-none' : ''}`}>
                <Upload className="w-3.5 h-3.5" />
                {logoUploading ? 'Saving…' : 'Upload Logo'}
                <input type="file" accept="image/*" className="sr-only" onChange={handleLogoUpload} disabled={logoUploading} />
              </label>
              {logoError && <p className="font-body text-xs text-red-600 mt-2">{logoError}</p>}
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
              ✓ Banking details on file — admin will EFT your payout to <strong>{form.accountHolder}</strong> at <strong>{form.bankName}</strong> · Acc: <strong className="font-mono">{form.accountNumber}</strong>
            </div>
          )}
        </div>

        {/* Documents */}
        <div className="bg-white border border-divider p-6 space-y-5">
          <div>
            <h3 className="font-body font-semibold text-sm text-espresso mb-1">Registration Documents</h3>
            <p className="font-body text-xs text-muted">Upload or replace your kennel certificate and parent registration documents. Admin uses these to verify your account.</p>
          </div>

          {/* Existing docs */}
          {(() => {
            const docs = sellerUser?.documents || {}
            const existing = [
              docs.kennelCert && { url: docs.kennelCert, label: 'Kennel Certificate' },
              ...(docs.sireCerts || []).map((u, i) => ({ url: u, label: `Sire Certificate ${i + 1}` })),
              ...(docs.damCerts || []).map((u, i) => ({ url: u, label: `Dam Certificate ${i + 1}` })),
            ].filter(Boolean)
            return existing.length > 0 ? (
              <div>
                <p className="font-body text-xs font-semibold uppercase tracking-widest text-muted mb-2">Current Documents</p>
                <div className="space-y-1.5">
                  {existing.map((d, i) => {
                    const isPdf = /\.pdf(\?|$)/i.test(d.url)
                    return (
                      <a key={i} href={d.url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 px-3 py-2 border border-divider hover:border-sienna hover:bg-cream transition-colors group">
                        <FileText className="w-4 h-4 text-muted group-hover:text-sienna flex-shrink-0" />
                        <span className="font-body text-xs text-espresso flex-1">{d.label}</span>
                        {isPdf && <span className="font-body text-[9px] font-bold tracking-widest uppercase text-muted group-hover:text-sienna">PDF</span>}
                        <ExternalLink className="w-3 h-3 text-muted group-hover:text-sienna" />
                      </a>
                    )
                  })}
                </div>
              </div>
            ) : (
              <p className="font-body text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2">No documents on file. Please upload your certificates below.</p>
            )
          })()}

          {/* Upload new */}
          <div className="space-y-4">
            <p className="font-body text-xs font-semibold uppercase tracking-widest text-muted">Upload / Replace Documents</p>

            {/* Kennel cert */}
            <div>
              <label className="label">Kennel Registration Certificate</label>
              {newKennelCert ? (
                <div className="flex items-center gap-3 border border-sage/40 bg-sage/5 px-4 py-3">
                  <FileCheck className="w-4 h-4 text-sage-dark flex-shrink-0" />
                  <span className="font-body text-sm text-espresso flex-1 truncate">{newKennelCert.name}</span>
                  <button type="button" onClick={() => setNewKennelCert(null)} className="text-muted hover:text-red-500"><X className="w-4 h-4" /></button>
                </div>
              ) : (
                <label className="flex items-center gap-3 border-2 border-dashed border-divider hover:border-sienna/40 px-4 py-3 cursor-pointer transition-colors">
                  <Upload className="w-4 h-4 text-muted flex-shrink-0" />
                  <span className="font-body text-sm text-muted">Click to upload certificate</span>
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="sr-only" onChange={e => setNewKennelCert(e.target.files[0] || null)} />
                </label>
              )}
            </div>

            {/* Sire certs */}
            <div>
              <label className="label">Sire (Father) Certificates</label>
              <label className="flex items-center gap-3 border-2 border-dashed border-divider hover:border-sienna/40 px-4 py-3 cursor-pointer transition-colors">
                <Upload className="w-4 h-4 text-muted flex-shrink-0" />
                <span className="font-body text-sm text-muted">Click to add sire certificate(s)</span>
                <input type="file" accept=".pdf,.jpg,.jpeg,.png" multiple className="sr-only"
                  onChange={e => setNewSireCerts(prev => [...prev, ...Array.from(e.target.files)])} />
              </label>
              {newSireCerts.map((f, i) => (
                <div key={i} className="flex items-center gap-3 border border-sage/40 bg-sage/5 px-3 py-2 mt-1.5">
                  <FileCheck className="w-4 h-4 text-sage-dark flex-shrink-0" />
                  <span className="font-body text-xs text-espresso flex-1 truncate">{f.name}</span>
                  <button type="button" onClick={() => setNewSireCerts(p => p.filter((_, idx) => idx !== i))} className="text-muted hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>

            {/* Dam certs */}
            <div>
              <label className="label">Dam (Mother) Certificates</label>
              <label className="flex items-center gap-3 border-2 border-dashed border-divider hover:border-sienna/40 px-4 py-3 cursor-pointer transition-colors">
                <Upload className="w-4 h-4 text-muted flex-shrink-0" />
                <span className="font-body text-sm text-muted">Click to add dam certificate(s)</span>
                <input type="file" accept=".pdf,.jpg,.jpeg,.png" multiple className="sr-only"
                  onChange={e => setNewDamCerts(prev => [...prev, ...Array.from(e.target.files)])} />
              </label>
              {newDamCerts.map((f, i) => (
                <div key={i} className="flex items-center gap-3 border border-sage/40 bg-sage/5 px-3 py-2 mt-1.5">
                  <FileCheck className="w-4 h-4 text-sage-dark flex-shrink-0" />
                  <span className="font-body text-xs text-espresso flex-1 truncate">{f.name}</span>
                  <button type="button" onClick={() => setNewDamCerts(p => p.filter((_, idx) => idx !== i))} className="text-muted hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>

            {docsError && <p className="font-body text-xs text-red-700 bg-red-50 border border-red-200 px-3 py-2">{docsError}</p>}

            {(newKennelCert || newSireCerts.length > 0 || newDamCerts.length > 0) && (
              <button
                type="button"
                disabled={docsUploading}
                onClick={async () => {
                  setDocsUploading(true)
                  setDocsError('')
                  try {
                    const existing = sellerUser?.documents || {}
                    const [kennelUrl, ...sireUrls] = await Promise.all([
                      newKennelCert ? uploadCert(newKennelCert) : Promise.resolve(existing.kennelCert || null),
                      ...newSireCerts.map(uploadCert),
                    ])
                    const damUrls = await Promise.all(newDamCerts.map(uploadCert))
                    const documents = {
                      kennelCert: kennelUrl,
                      sireCerts: [...(existing.sireCerts || []), ...sireUrls.filter(Boolean)],
                      damCerts: [...(existing.damCerts || []), ...damUrls.filter(Boolean)],
                    }
                    await updateSellerDocuments(documents)
                    setNewKennelCert(null)
                    setNewSireCerts([])
                    setNewDamCerts([])
                    setDocsSaved(true)
                    setTimeout(() => setDocsSaved(false), 3000)
                  } catch {
                    setDocsError('Upload failed. Please try again.')
                  } finally {
                    setDocsUploading(false)
                  }
                }}
                className={`flex items-center gap-2 px-6 py-3 font-body text-xs font-semibold tracking-widest uppercase transition-all ${
                  docsSaved ? 'bg-sage text-white' : docsUploading ? 'bg-muted text-cream cursor-not-allowed' : 'btn-primary'
                }`}
              >
                {docsSaved ? <><Check className="w-4 h-4" /> Documents Saved!</> : docsUploading ? 'Uploading…' : <><Upload className="w-4 h-4" /> Save Documents</>}
              </button>
            )}
          </div>
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
