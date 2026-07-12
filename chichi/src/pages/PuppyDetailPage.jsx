import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, MapPin, Phone, Mail, Check, ShieldCheck, Lock, UserCircle } from 'lucide-react'
import { useApp } from '../context/AppContext'
import Modal from '../components/Modal'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

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
  const [searchParams] = useSearchParams()
  const { puppies, kennels, adminSettings, buyerUser, loadPuppies, loadingPublic } = useApp()
  const navigate = useNavigate()
  const [imgIdx, setImgIdx] = useState(0)
  const [payOpen, setPayOpen] = useState(false)
  const [successOpen, setSuccessOpen] = useState(!!searchParams.get('purchased'))
  const [loading, setLoading] = useState(false)
  const [payError, setPayError] = useState('')
  const [buyer, setBuyer] = useState({ name: buyerUser?.name || '', email: buyerUser?.email || '' })
  const [errors, setErrors] = useState({})
  const [payOption, setPayOption] = useState('full')

  const purchasedKind = searchParams.get('purchased') // 'full' | 'deposit' | 'balance' | 'true' (legacy)

  useEffect(() => {
    if (!searchParams.get('purchased')) return
    // sessionStorage is primary; Yoco may also append checkoutId to the success URL
    const checkoutId = sessionStorage.getItem(`yoco_checkout_puppy_${id}`)
                       || searchParams.get('checkoutId')
    if (checkoutId) {
      fetch(`${API}/yoco/verify-puppy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checkout_id: checkoutId,
          puppy_id: id,
          buyer_id: buyerUser?.id || '',
          buyer_name: buyerUser?.name || '',
          buyer_email: buyerUser?.email || '',
        }),
      })
        .then(res => { if (res.ok) sessionStorage.removeItem(`yoco_checkout_puppy_${id}`) })
        .catch(() => {})
        .finally(() => loadPuppies())
    } else {
      loadPuppies()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const puppy = puppies.find(p => p.id === id)
  if (!puppy) {
    if (loadingPublic) {
      return (
        <div className="max-w-2xl mx-auto px-4 py-24 text-center">
          <p className="font-body text-sm text-muted">Loading…</p>
        </div>
      )
    }
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
  const status = puppy.status || (puppy.sold ? 'sold' : 'available')
  const isSold = status === 'sold'
  const isBooked = status === 'booked'
  const isMyBooking = isBooked && buyerUser && buyerUser.id === puppy.bookedBy
  const depositAmount = Math.round(puppy.price * 0.5)
  const payAmount = payOption === 'full' ? puppy.price
    : payOption === 'deposit' ? depositAmount
    : puppy.price - depositAmount
  const payLabel = payOption === 'deposit' ? 'Pay 50% Deposit'
    : payOption === 'balance' ? 'Pay Remaining Balance' : 'Pay'

  const setB = (key) => (e) => {
    setBuyer(b => ({ ...b, [key]: e.target.value }))
    setErrors(err => ({ ...err, [key]: '' }))
  }

  const validate = () => {
    const e = {}
    if (!buyer.name.trim()) e.name = 'Required'
    if (!buyer.email.includes('@')) e.email = 'Valid email required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handlePay = async (e) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    setPayError('')
    try {
      const res = await fetch(`${API}/yoco/puppy-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ puppy_id: puppy.id, buyer_name: buyer.name, buyer_email: buyer.email, buyer_id: buyerUser?.id || '', payment_option: payOption }),
      })
      if (!res.ok) throw new Error('Payment provider error. Please try again.')
      const { redirect_url, checkout_id } = await res.json()
      sessionStorage.setItem(`yoco_checkout_puppy_${puppy.id}`, checkout_id)
      window.location.href = redirect_url
    } catch (err) {
      setPayError(err.message || 'Payment failed. Please try again.')
      setLoading(false)
    }
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
              <div className="w-10 h-10 flex-shrink-0 overflow-hidden" style={{ backgroundColor: kennel.color }}>
                {kennel.logo
                  ? <img src={kennel.logo} alt={kennel.name} className="w-full h-full object-cover" />
                  : <span className="w-full h-full flex items-center justify-center text-white text-xs font-bold">{kennel.initials}</span>
                }
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
          ) : isBooked && isMyBooking ? (
            <>
              <div className="w-full py-3 mb-3 bg-amber-50 border border-amber-200 text-center font-body text-xs text-amber-700 tracking-widest uppercase">Reserved for you — deposit paid</div>
              <button
                onClick={() => { setPayOption('balance'); setPayOpen(true) }}
                className="w-full py-4 bg-sienna text-cream font-body font-semibold text-sm tracking-widest uppercase hover:bg-sienna-dark transition-colors flex items-center justify-center gap-2"
              >
                <Lock className="w-4 h-4" />
                Pay Remaining Balance · R{(puppy.price - depositAmount).toLocaleString()}
              </button>
            </>
          ) : isBooked ? (
            <div className="w-full py-4 bg-amber-50 border border-amber-200 text-center font-body text-sm text-amber-700 tracking-widest uppercase">This puppy is reserved</div>
          ) : buyerUser ? (
            <>
              <button
                onClick={() => { setPayOption('full'); setPayOpen(true) }}
                className="w-full py-4 bg-sienna text-cream font-body font-semibold text-sm tracking-widest uppercase hover:bg-sienna-dark transition-colors flex items-center justify-center gap-2"
              >
                <Lock className="w-4 h-4" />
                Buy Now · R{puppy.price.toLocaleString()}
              </button>
              <button
                onClick={() => { setPayOption('deposit'); setPayOpen(true) }}
                className="w-full mt-3 py-4 border-2 border-sienna text-sienna font-body font-semibold text-sm tracking-widest uppercase hover:bg-sienna hover:text-cream transition-colors flex items-center justify-center gap-2"
              >
                <Lock className="w-4 h-4" />
                Reserve · 50% Deposit · R{depositAmount.toLocaleString()}
              </button>
              <div className="flex items-center justify-center gap-4 mt-3">
                <span className="font-body text-xs text-muted">🔒 Secure SA payments via Yoco</span>
              </div>
              <p className="font-body text-[11px] text-muted text-center mt-2">Pay a 50% deposit to reserve this puppy — the balance is payable here before collection.</p>
            </>
          ) : (
            <div className="border border-divider p-5 text-center space-y-3">
              <UserCircle className="w-8 h-8 text-muted mx-auto" />
              <p className="font-body text-sm text-espresso font-semibold">Create an account to purchase</p>
              <p className="font-body text-xs text-muted">A free buyer account lets you purchase puppies and track your orders.</p>
              <div className="flex gap-3 justify-center">
                <Link to="/buyer/signup" state={{ from: `/puppies/${id}` }}
                  className="btn-primary text-xs tracking-widest uppercase py-2.5 px-5">
                  Create Account
                </Link>
                <Link to="/buyer/login" state={{ from: `/puppies/${id}` }}
                  className="btn-secondary text-xs tracking-widest uppercase py-2.5 px-5">
                  Sign In
                </Link>
              </div>
            </div>
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
                <img src={puppy.sireImage} alt="Sire" className="w-full aspect-[4/3] object-contain bg-cream border border-divider" />
              </div>
            )}
            {puppy.damImage && (
              <div>
                <p className="label mb-2">Dam (Mother)</p>
                <img src={puppy.damImage} alt="Dam" className="w-full aspect-[4/3] object-contain bg-cream border border-divider" />
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

      {/* ── Payment Modal ── */}
      <Modal open={payOpen} onClose={() => !loading && setPayOpen(false)} title={payOption === 'deposit' ? 'Reserve via Yoco' : 'Purchase via Yoco'} maxWidth="max-w-lg">
        <form onSubmit={handlePay} className="space-y-4">
          <div className="bg-cream border border-divider p-4 flex items-center gap-3">
            <img src={puppy.images[0]} alt={puppy.name} className="w-12 h-12 object-cover flex-shrink-0" onError={e => { e.target.src = `https://picsum.photos/seed/${puppy.id}/80/80` }} />
            <div>
              <p className="font-display text-lg font-semibold text-espresso">{puppy.name}</p>
              <p className="font-body text-xs text-muted">Chihuahua · {puppy.coatType} · {kennel?.name}</p>
            </div>
            <span className="ml-auto font-display text-xl font-semibold text-espresso">R{payAmount.toLocaleString()}</span>
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

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-4 font-body font-semibold text-sm tracking-widest uppercase flex items-center justify-center gap-2 transition-colors ${loading ? 'bg-muted text-cream cursor-not-allowed' : 'bg-sienna text-white hover:bg-sienna-dark'}`}
          >
            <Lock className="w-4 h-4" />
            {loading ? 'Redirecting to Yoco...' : `${payLabel} R${payAmount.toLocaleString()} via Yoco`}
          </button>
          {payError && <p className="font-body text-xs text-red-600 text-center">{payError}</p>}
          <p className="font-body text-xs text-muted text-center">You will be redirected to Yoco to complete your payment securely.</p>
        </form>
      </Modal>

      {/* ── Success Modal ── */}
      <Modal open={successOpen} onClose={() => { setSuccessOpen(false); navigate('/') }} title={purchasedKind === 'deposit' ? 'Deposit Received!' : 'Payment Successful!'}>
        <div className="text-center space-y-4">
          <div className="w-14 h-14 bg-sage/20 mx-auto flex items-center justify-center">
            <Check className="w-7 h-7 text-sage-dark" />
          </div>
          <div>
            <p className="font-display text-2xl font-semibold text-espresso mb-1">Thank You!</p>
            <p className="font-body text-sm text-muted">
              {purchasedKind === 'deposit'
                ? <>Your 50% deposit for <strong className="text-espresso">{puppy.name}</strong> is confirmed — this puppy is now reserved for you. Pay the balance here anytime before collection.</>
                : <>Your purchase of <strong className="text-espresso">{puppy.name}</strong> is confirmed. The breeder will be in touch shortly.</>}
            </p>
          </div>
          <div className="bg-white border border-divider p-4 text-left space-y-1">
            <p className="font-body text-xs font-semibold uppercase tracking-widest text-muted mb-2">Breeder Contact</p>
            <p className="font-body text-sm font-semibold text-espresso">{kennel?.name}</p>
            {kennel?.phone && <a href={`tel:${kennel.phone}`} className="flex items-center gap-1.5 font-body text-sm text-sienna hover:underline"><Phone className="w-3.5 h-3.5" />{kennel.phone}</a>}
            {kennel?.contact && <a href={`mailto:${kennel.contact}`} className="flex items-center gap-1.5 font-body text-sm text-sienna hover:underline"><Mail className="w-3.5 h-3.5" />{kennel.contact}</a>}
          </div>
          <button onClick={() => { setSuccessOpen(false); navigate('/') }} className="w-full btn-primary text-xs tracking-widest uppercase py-3">
            Back to Home
          </button>
        </div>
      </Modal>
    </div>
  )
}
