import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, MapPin, Phone, Mail, Check, ShieldCheck, MessageSquare } from 'lucide-react'
import { useApp } from '../context/AppContext'
import Modal from '../components/Modal'

const ADMIN_EMAIL = 'chihuahuasouthafrica@gmail.com'

function getAge(dob) {
  const now = new Date()
  const birth = new Date(dob)
  const weeks = Math.floor((now - birth) / (1000 * 60 * 60 * 24 * 7))
  const months = Math.floor((now - birth) / (1000 * 60 * 60 * 24 * 30.4))
  if (weeks < 20) return `${weeks} weeks`
  if (months < 24) return `${months} months`
  return `${Math.floor(months / 12)} years`
}

export default function PuppyDetailPage() {
  const { id } = useParams()
  const { puppies, kennels, adminSettings } = useApp()
  const navigate = useNavigate()
  const [imgIdx, setImgIdx] = useState(0)
  const [enquiryOpen, setEnquiryOpen] = useState(false)
  const [successOpen, setSuccessOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [buyer, setBuyer] = useState({ name: '', email: '', phone: '', message: '' })
  const [errors, setErrors] = useState({})

  const puppy = puppies.find(p => p.id === id)
  if (!puppy) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <p className="font-display text-2xl text-espresso mb-4">Puppy not found.</p>
        <Link to="/" className="btn-primary text-xs tracking-widest uppercase">Back to Home</Link>
      </div>
    )
  }

  const kennel = kennels.find(k => k.id === puppy.kennelId)
  const commission = kennel?.commission ?? adminSettings?.defaultCommission ?? 8
  const commissionAmt = Math.round(puppy.price * commission / 100)
  const sellerPayout = puppy.price - commissionAmt
  const isSold = puppy.sold

  const setB = (key) => (e) => {
    setBuyer(b => ({ ...b, [key]: e.target.value }))
    setErrors(err => ({ ...err, [key]: '' }))
  }

  const validate = () => {
    const e = {}
    if (!buyer.name.trim()) e.name = 'Required'
    if (!buyer.email.includes('@')) e.email = 'Valid email required'
    if (!buyer.phone.trim()) e.phone = 'Required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleEnquire = async (e) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      await fetch(`https://formsubmit.co/ajax/${ADMIN_EMAIL}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          _subject: `Puppy Enquiry — ${puppy.name} (${kennel?.name})`,
          'Puppy': puppy.name,
          'Kennel': kennel?.name,
          'Price': `R${puppy.price.toLocaleString()}`,
          'Buyer Name': buyer.name,
          'Buyer Email': buyer.email,
          'Buyer Phone': buyer.phone,
          'Message': buyer.message || '(no message)',
        }),
      })
    } catch (_) {}
    setLoading(false)
    setEnquiryOpen(false)
    setSuccessOpen(true)
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-8">
        <Link to="/" className="font-body text-xs text-muted hover:text-sienna transition-colors">Home</Link>
        <span className="text-divider">/</span>
        <Link to="/kennels" className="font-body text-xs text-muted hover:text-sienna transition-colors">Kennels</Link>
        <span className="text-divider">/</span>
        <span className="font-body text-xs text-espresso">{puppy.name}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 xl:gap-16 mb-12">
        {/* Image gallery */}
        <div>
          <div className={`relative aspect-square overflow-hidden bg-wheat mb-3 ${isSold ? 'grayscale' : ''}`}>
            <img
              src={puppy.images[imgIdx]}
              alt={puppy.name}
              onError={e => { e.target.src = `https://picsum.photos/seed/${puppy.id}${imgIdx}/600/600` }}
              className="w-full h-full object-cover"
            />
            {puppy.images.length > 1 && (
              <>
                <button onClick={() => setImgIdx(i => (i - 1 + puppy.images.length) % puppy.images.length)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-cream/90 hover:bg-cream flex items-center justify-center shadow transition-colors">
                  <ChevronLeft className="w-5 h-5 text-espresso" />
                </button>
                <button onClick={() => setImgIdx(i => (i + 1) % puppy.images.length)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-cream/90 hover:bg-cream flex items-center justify-center shadow transition-colors">
                  <ChevronRight className="w-5 h-5 text-espresso" />
                </button>
              </>
            )}
          </div>
          {puppy.images.length > 1 && (
            <div className="flex gap-2">
              {puppy.images.map((img, i) => (
                <button key={i} onClick={() => setImgIdx(i)}
                  className={`w-16 h-16 overflow-hidden border-2 transition-colors ${imgIdx === i ? 'border-sienna' : 'border-transparent'}`}>
                  <img src={img} alt="" className={`w-full h-full object-cover ${isSold ? 'grayscale' : ''}`} />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div>
          <div className="flex flex-wrap gap-2 mb-4">
            <span className={kennel?.registry === 'KUSA' ? 'badge-kusa py-1 px-3' : 'badge-canine py-1 px-3'}>{kennel?.registry}</span>
            <span className={`text-[10px] font-bold tracking-widest uppercase py-1 px-3 ${puppy.gender === 'Male' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700'}`}>{puppy.gender}</span>
            {puppy.breedingRights !== undefined && (
              <span className={`text-[10px] font-bold tracking-widest uppercase py-1 px-3 ${puppy.breedingRights ? 'bg-sage/15 text-sage-dark' : 'bg-espresso/10 text-espresso'}`}>
                {puppy.breedingRights ? 'Full Breeding Rights' : 'Non-Breeding · Pet Only'}
              </span>
            )}
          </div>

          <h1 className="font-display text-4xl md:text-5xl font-semibold text-espresso mb-1">{puppy.name}</h1>
          <p className="font-body text-muted mb-4">Chihuahua · {puppy.coatType ?? 'Smooth Coat'} · {puppy.color} · {getAge(puppy.dob)}</p>

          <div className="flex items-end gap-3 mb-2">
            <span className="font-display text-4xl font-semibold text-espresso">R{puppy.price.toLocaleString()}</span>
            <span className="font-body text-xs text-muted mb-1.5">ZAR incl. registration papers</span>
          </div>
          {puppy.breedingRights && puppy.breedingRightsPrice > 0 && (
            <div className="flex items-center gap-3 mb-6">
              <span className="font-body text-sm text-muted">+ Breeding rights:</span>
              <span className="font-display text-xl font-semibold text-sage-dark">R{Number(puppy.breedingRightsPrice).toLocaleString()}</span>
              <span className="font-body text-xs text-muted">(optional add-on)</span>
            </div>
          )}
          {(!puppy.breedingRights || !puppy.breedingRightsPrice) && <div className="mb-6" />}

          <p className="font-body text-sm text-muted leading-relaxed mb-6">{puppy.description}</p>

          {kennel && (
            <div className="flex items-center gap-3 p-4 bg-white border border-divider mb-6">
              <div className="w-10 h-10 flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ backgroundColor: kennel.color }}>
                {kennel.initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-body font-semibold text-sm text-espresso">{kennel.name}</p>
                <div className="flex items-center gap-1 text-muted mt-0.5">
                  <MapPin className="w-3 h-3" />
                  <span className="font-body text-xs">{kennel.location}</span>
                </div>
              </div>
              <span className="font-body text-[10px] text-muted italic">Contact shared after purchase</span>
            </div>
          )}

          <div className="flex items-center gap-2 mb-6">
            <ShieldCheck className="w-4 h-4 text-sage" />
            <span className="font-body text-xs text-muted">Reg. No: <strong className="text-espresso">{puppy.registrationNo}</strong></span>
          </div>

          {isSold ? (
            <div className="w-full py-4 bg-divider text-center font-body text-sm text-muted tracking-widest uppercase">This puppy has been sold</div>
          ) : (
            <>
              <button
                onClick={() => setEnquiryOpen(true)}
                className="w-full py-4 bg-sienna text-cream font-body font-semibold text-sm tracking-widest uppercase hover:bg-sienna-dark transition-colors flex items-center justify-center gap-2"
              >
                <MessageSquare className="w-4 h-4" />
                Enquire About This Puppy
              </button>
              <div className="flex items-center justify-center gap-4 mt-3">
                <span className="font-body text-xs text-muted">We'll connect you with the breeder directly</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Pedigree */}
      <div className="mb-12">
        <h2 className="font-display text-2xl font-semibold text-espresso mb-2">Pedigree</h2>
        <p className="font-body text-xs text-muted mb-4">Sire and Dam listed. Full pedigree history available on request after purchase.</p>
        <div className="overflow-x-auto">
          <table className="w-full border border-divider bg-white text-sm font-body">
            <tbody>
              {[
                ['Sire (Father)', puppy.pedigree.sire],
                ['Dam (Mother)', puppy.pedigree.dam],
              ].map(([label, value]) => (
                <tr key={label} className="border-b border-divider last:border-0">
                  <td className="px-5 py-3 font-medium text-muted text-xs tracking-wide w-64 bg-cream/40">{label}</td>
                  <td className="px-5 py-3 text-espresso font-semibold">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Parent Photos */}
      {(puppy.sireImage || puppy.damImage) && (
        <div className="mb-12">
          <h2 className="font-display text-2xl font-semibold text-espresso mb-5">Parent Photos</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {puppy.sireImage && (
              <div>
                <p className="label mb-2">Sire (Father)</p>
                <img src={puppy.sireImage} alt="Sire" className="w-full h-64 object-cover border border-divider" />
              </div>
            )}
            {puppy.damImage && (
              <div>
                <p className="label mb-2">Dam (Mother)</p>
                <img src={puppy.damImage} alt="Dam" className="w-full h-64 object-cover border border-divider" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Health certs */}
      <div className="mb-12">
        <h2 className="font-display text-2xl font-semibold text-espresso mb-5">Health Certifications</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {puppy.health.map(cert => (
            <div key={cert} className="flex items-center gap-3 p-3 bg-white border border-divider">
              <div className="w-5 h-5 bg-sage/20 flex items-center justify-center flex-shrink-0"><Check className="w-3 h-3 text-sage-dark" /></div>
              <span className="font-body text-sm text-espresso">{cert}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Enquiry Modal ── */}
      <Modal open={enquiryOpen} onClose={() => !loading && setEnquiryOpen(false)} title="Enquire About This Puppy" maxWidth="max-w-lg">
        <form onSubmit={handleEnquire} className="space-y-4">
          <div className="bg-cream border border-divider p-4 flex items-center gap-3">
            <img src={puppy.images[0]} alt={puppy.name} className="w-12 h-12 object-cover flex-shrink-0" onError={e => { e.target.src = `https://picsum.photos/seed/${puppy.id}/80/80` }} />
            <div>
              <p className="font-display text-lg font-semibold text-espresso">{puppy.name}</p>
              <p className="font-body text-xs text-muted">Chihuahua · {puppy.coatType} · {kennel?.name} · R{puppy.price.toLocaleString()}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Full Name</label>
              <input className={`input-field ${errors.name ? 'border-red-400' : ''}`} placeholder="Your full name" value={buyer.name} onChange={setB('name')} />
              {errors.name && <p className="font-body text-[10px] text-red-500 mt-1">{errors.name}</p>}
            </div>
            <div>
              <label className="label">Email Address</label>
              <input type="email" className={`input-field ${errors.email ? 'border-red-400' : ''}`} placeholder="your@email.com" value={buyer.email} onChange={setB('email')} />
              {errors.email && <p className="font-body text-[10px] text-red-500 mt-1">{errors.email}</p>}
            </div>
          </div>

          <div>
            <label className="label">Phone Number</label>
            <input type="tel" className={`input-field ${errors.phone ? 'border-red-400' : ''}`} placeholder="+27 82 000 0000" value={buyer.phone} onChange={setB('phone')} />
            {errors.phone && <p className="font-body text-[10px] text-red-500 mt-1">{errors.phone}</p>}
          </div>

          <div>
            <label className="label">Message (optional)</label>
            <textarea rows={3} className="input-field resize-none" placeholder="Any questions about the puppy?" value={buyer.message} onChange={setB('message')} />
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-4 font-body font-semibold text-sm tracking-widest uppercase flex items-center justify-center gap-2 transition-colors ${loading ? 'bg-muted text-cream cursor-not-allowed' : 'bg-sienna text-white hover:bg-sienna-dark'}`}
          >
            <MessageSquare className="w-4 h-4" />
            {loading ? 'Sending...' : 'Send Enquiry'}
          </button>
          <p className="font-body text-xs text-muted text-center">We'll be in touch within 24 hours.</p>
        </form>
      </Modal>

      {/* ── Success Modal ── */}
      <Modal open={successOpen} onClose={() => { setSuccessOpen(false); navigate('/') }} title="Enquiry Sent!">
        <div className="text-center space-y-4">
          <div className="w-14 h-14 bg-sage/20 mx-auto flex items-center justify-center">
            <Check className="w-7 h-7 text-sage-dark" />
          </div>
          <div>
            <p className="font-display text-2xl font-semibold text-espresso mb-1">Thank You!</p>
            <p className="font-body text-sm text-muted">Your enquiry about <strong className="text-espresso">{puppy.name}</strong> has been received. We'll be in touch within 24 hours.</p>
          </div>
          <div className="bg-white border border-divider p-4 text-left space-y-1">
            <p className="font-body text-xs font-semibold uppercase tracking-widest text-muted mb-2">Breeder</p>
            <p className="font-body text-sm font-semibold text-espresso">{kennel?.name}</p>
            <a href={`tel:${kennel?.phone}`} className="flex items-center gap-1.5 font-body text-sm text-sienna hover:underline"><Phone className="w-3.5 h-3.5" />{kennel?.phone}</a>
            <a href={`mailto:${kennel?.contact}`} className="flex items-center gap-1.5 font-body text-sm text-sienna hover:underline"><Mail className="w-3.5 h-3.5" />{kennel?.contact}</a>
          </div>
          <button onClick={() => { setSuccessOpen(false); navigate('/') }} className="w-full btn-primary text-xs tracking-widest uppercase py-3">
            Back to Home
          </button>
        </div>
      </Modal>
    </div>
  )
}
