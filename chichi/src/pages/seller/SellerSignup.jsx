import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { CheckCircle, Loader2, Upload, FileCheck, X, Eye, EyeOff } from 'lucide-react'
import { Logo } from '../../components/Logo'
import { uploadCert } from '../../utils/uploadCert'

const FORMSUBMIT_EMAIL = 'Chihuahuasouthafrica@gmail.com'

export default function SellerSignup() {
  const { signupSeller } = useApp()
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    kennelName: '',
    registry: 'KUSA',
    city: '',
    province: '',
    referralCode: '',
    password: '',
  })
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [sendError, setSendError] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [docs, setDocs] = useState({ kennelCert: null })
  const [sireCerts, setSireCerts] = useState([])
  const [damCerts, setDamCerts] = useState([])
  const kennelCertInputRef = useRef(null)
  const sireInputRef = useRef(null)
  const damInputRef = useRef(null)

  const set = (key) => (e) => setForm(prev => ({ ...prev, [key]: e.target.value }))

  const handleDoc = (key) => (e) => {
    const file = e.target.files[0]
    if (file) setDocs(d => ({ ...d, [key]: file }))
  }
  const removeDoc = (key) => setDocs(d => ({ ...d, [key]: null }))

  const handleSireCerts = (e) => {
    const files = Array.from(e.target.files)
    setSireCerts(prev => [...prev, ...files])
  }
  const removeSireCert = (i) => setSireCerts(prev => prev.filter((_, idx) => idx !== i))

  const handleDamCerts = (e) => {
    const files = Array.from(e.target.files)
    setDamCerts(prev => [...prev, ...files])
  }
  const removeDamCert = (i) => setDamCerts(prev => prev.filter((_, idx) => idx !== i))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setSendError(false)
    setSaveError('')

    // Upload all documents to Cloudinary first
    let documents = {}
    try {
      const [kennelUrl, ...sireUrls] = await Promise.all([
        docs.kennelCert ? uploadCert(docs.kennelCert) : Promise.resolve(null),
        ...sireCerts.map(uploadCert),
      ])
      const damUrls = await Promise.all(damCerts.map(uploadCert))
      documents = {
        kennel_cert: kennelUrl,
        sire_certs: sireUrls.filter(Boolean),
        dam_certs: damUrls.filter(Boolean),
      }
    } catch {
      setSaveError('Failed to upload documents. Please try again.')
      setLoading(false)
      return
    }

    try {
      await fetch(`https://formsubmit.co/ajax/${FORMSUBMIT_EMAIL}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          _subject: `New Chihuahua SA Breeder Application — ${form.kennelName}`,
          'Full Name': form.name,
          'Email': form.email,
          'Phone': form.phone,
          'Kennel Name': form.kennelName,
          'Registry': form.registry,
          'City': form.city,
          'Province': form.province,
          'Referral Code': form.referralCode || 'None',
          'Kennel Certificate': documents.kennel_cert || 'Not uploaded',
          'Sire Certificates': documents.sire_certs?.join(', ') || 'Not uploaded',
          'Dam Certificates': documents.dam_certs?.join(', ') || 'Not uploaded',
          'Applied': new Date().toLocaleDateString('en-ZA'),
        }),
      })
    } catch {
      setSendError(true)
    }

    try {
      await signupSeller({
        email: form.email,
        password: form.password,
        name: form.name,
        phone: form.phone,
        city: form.city,
        province: form.province,
        kennel_name: form.kennelName,
        registry: form.registry,
        documents,
      })
      setSubmitted(true)
    } catch (err) {
      setSaveError(err.message || 'Could not save your application. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 bg-sage/20 mx-auto flex items-center justify-center mb-5">
            <CheckCircle className="w-8 h-8 text-sage-dark" />
          </div>
          <h1 className="font-display text-3xl font-semibold text-espresso mb-3">Application Submitted!</h1>
          <p className="font-body text-sm text-muted mb-6 leading-relaxed max-w-sm mx-auto">
            Thank you for applying to Chihuahua South Africa. An admin will review your profile and credentials within <strong>2–3 business days</strong>.
            You'll receive an email once approved.
          </p>
          <div className="bg-white border border-divider p-5 text-left mb-6">
            <p className="font-body text-xs font-semibold uppercase tracking-widest text-muted mb-2">What happens next?</p>
            <p className="font-body text-sm text-muted leading-relaxed">
              Once approved you will receive a payment link for your membership.
            </p>
          </div>
          <Link to="/" className="btn-primary text-xs tracking-widest uppercase block text-center">Back to Home</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <div className="bg-espresso py-5 px-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Logo light />
          </Link>
          <Link to="/seller/login" className="font-body text-xs text-cream/60 hover:text-cream transition-colors">
            Already have an account? Login
          </Link>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="mb-8">
          <h1 className="font-display text-4xl font-semibold text-espresso mb-2">Join the Chihuahua Community</h1>
          <p className="font-body text-sm text-muted">Apply to list your puppies on South Africa's premier breeder marketplace. KUSA and Canine SA breeders welcome.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 bg-white border border-divider p-4 sm:p-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="label">Full Name *</label>
              <input type="text" required className="input-field" value={form.name} onChange={set('name')} placeholder="Your full name" />
            </div>
            <div>
              <label className="label">Email Address *</label>
              <input type="email" required className="input-field" value={form.email} onChange={set('email')} placeholder="breeder@example.co.za" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="label">Phone Number *</label>
              <input type="tel" required className="input-field" value={form.phone} onChange={set('phone')} placeholder="+27 82 000 0000" />
            </div>
            <div>
              <label className="label">City *</label>
              <input type="text" required className="input-field" value={form.city} onChange={set('city')} placeholder="e.g. Johannesburg" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="label">Province *</label>
              <select required className="input-field" value={form.province} onChange={set('province')}>
                <option value="">Select province…</option>
                <option>Gauteng</option>
                <option>Western Cape</option>
                <option>KwaZulu-Natal</option>
                <option>Eastern Cape</option>
                <option>Limpopo</option>
                <option>Mpumalanga</option>
                <option>North West</option>
                <option>Free State</option>
                <option>Northern Cape</option>
              </select>
            </div>
            <div>
              <label className="label">Kennel Name *</label>
              <input type="text" required className="input-field" value={form.kennelName} onChange={set('kennelName')} placeholder="Your registered kennel name" />
            </div>
          </div>

          <div>
            <label className="label">Registry *</label>
            <div className="flex gap-0 border border-divider overflow-hidden">
              {['KUSA', 'Canine SA'].map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, registry: r }))}
                  className={`flex-1 py-3 font-body text-xs font-semibold tracking-wide transition-colors ${form.registry === r ? 'bg-espresso text-cream' : 'bg-white text-muted hover:text-espresso'}`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Password *</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                required
                minLength={8}
                autoComplete="new-password"
                className="input-field pr-10"
                value={form.password}
                onChange={set('password')}
                placeholder="Minimum 8 characters"
              />
              <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-espresso" onClick={() => setShowPw(p => !p)}>
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="label">Referral Code <span className="text-muted font-normal normal-case tracking-normal">(optional — get a commission discount)</span></label>
            <input type="text" className="input-field" value={form.referralCode} onChange={set('referralCode')} placeholder="e.g. HVB2024" />
          </div>

          {/* Document uploads */}
          <div className="space-y-4">
            <div>
              <label className="label">Kennel Registration Certificate <span className="text-red-500">*</span></label>
              {docs.kennelCert ? (
                <div className="flex items-center gap-3 border border-sage/40 bg-sage/5 px-4 py-3">
                  <FileCheck className="w-4 h-4 text-sage-dark flex-shrink-0" />
                  <span className="font-body text-sm text-espresso flex-1 truncate">{docs.kennelCert.name}</span>
                  <button type="button" onClick={() => removeDoc('kennelCert')} className="text-muted hover:text-red-500 transition-colors flex-shrink-0">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div onClick={() => kennelCertInputRef.current?.click()} className="flex items-center gap-3 border-2 border-dashed border-divider hover:border-sienna/40 px-4 py-4 cursor-pointer transition-colors">
                  <Upload className="w-5 h-5 text-muted flex-shrink-0" />
                  <div>
                    <p className="font-body text-sm text-espresso">Upload kennel registration certificate</p>
                    <p className="font-body text-xs text-muted mt-0.5">PDF, JPG or PNG · Max 5MB</p>
                  </div>
                  <input ref={kennelCertInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" style={{display:'none'}} onChange={handleDoc('kennelCert')} />
                </div>
              )}
            </div>

            {/* Sire certificates */}
            <div>
              <label className="label">Sire (Father) Registration Certificates <span className="text-red-500">*</span></label>
              <p className="font-body text-xs text-muted mb-2">Upload one or more certificates for the sire(s)</p>
              <div onClick={() => sireInputRef.current?.click()} className="flex items-center gap-3 border-2 border-dashed border-divider hover:border-sienna/40 px-4 py-4 cursor-pointer transition-colors">
                <Upload className="w-5 h-5 text-muted flex-shrink-0" />
                <div>
                  <p className="font-body text-sm text-espresso">Click to add sire certificate(s)</p>
                  <p className="font-body text-xs text-muted mt-0.5">PDF, JPG or PNG · Multiple allowed</p>
                </div>
                <input ref={sireInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" multiple style={{display:'none'}} onChange={handleSireCerts} />
              </div>
              {sireCerts.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {sireCerts.map((file, i) => (
                    <div key={i} className="flex items-center gap-3 border border-sage/40 bg-sage/5 px-3 py-2">
                      <FileCheck className="w-4 h-4 text-sage-dark flex-shrink-0" />
                      <span className="font-body text-xs text-espresso flex-1 truncate">{file.name}</span>
                      <button type="button" onClick={() => removeSireCert(i)} className="text-muted hover:text-red-500 transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Dam certificates */}
            <div>
              <label className="label">Dam (Mother) Registration Certificates <span className="text-red-500">*</span></label>
              <p className="font-body text-xs text-muted mb-2">Upload one or more certificates for the dam(s)</p>
              <div onClick={() => damInputRef.current?.click()} className="flex items-center gap-3 border-2 border-dashed border-divider hover:border-sienna/40 px-4 py-4 cursor-pointer transition-colors">
                <Upload className="w-5 h-5 text-muted flex-shrink-0" />
                <div>
                  <p className="font-body text-sm text-espresso">Click to add dam certificate(s)</p>
                  <p className="font-body text-xs text-muted mt-0.5">PDF, JPG or PNG · Multiple allowed</p>
                </div>
                <input ref={damInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" multiple style={{display:'none'}} onChange={handleDamCerts} />
              </div>
              {damCerts.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {damCerts.map((file, i) => (
                    <div key={i} className="flex items-center gap-3 border border-sage/40 bg-sage/5 px-3 py-2">
                      <FileCheck className="w-4 h-4 text-sage-dark flex-shrink-0" />
                      <span className="font-body text-xs text-espresso flex-1 truncate">{file.name}</span>
                      <button type="button" onClick={() => removeDamCert(i)} className="text-muted hover:text-red-500 transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="bg-cream border border-divider p-4 font-body text-xs text-muted leading-relaxed">
            <p className="font-semibold text-espresso mb-1">What happens after signup?</p>
            Once approved you will receive a payment link for your membership.
          </div>

          {sendError && (
            <p className="font-body text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2">
              Could not send email notification, but your application was still saved. Admin will review it.
            </p>
          )}
          {saveError && (
            <p className="font-body text-xs text-red-700 bg-red-50 border border-red-200 px-3 py-2">{saveError}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className={`w-full text-xs tracking-widest uppercase py-4 flex items-center justify-center gap-2 font-body font-medium transition-colors ${loading ? 'bg-muted text-cream cursor-not-allowed' : 'btn-primary'}`}
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Submitting...' : 'Submit Application'}
          </button>
        </form>
      </div>
    </div>
  )
}
