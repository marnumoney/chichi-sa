import { useState } from 'react'
import { Link } from 'react-router-dom'
import { MapPin, Star } from 'lucide-react'
import { useApp } from '../context/AppContext'
import PuppyCard from '../components/PuppyCard'

function StarRating({ value, onChange, interactive = false }) {
  const [hover, setHover] = useState(0)
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(s => (
        <button key={s} type={interactive ? 'button' : 'button'}
          disabled={!interactive}
          onMouseEnter={() => interactive && setHover(s)}
          onMouseLeave={() => interactive && setHover(0)}
          onClick={() => interactive && onChange && onChange(s)}
          className={`${interactive ? 'cursor-pointer' : 'cursor-default'}`}>
          <Star className={`w-4 h-4 ${(hover || value) >= s ? 'fill-amber-400 text-amber-400' : 'text-divider'}`} />
        </button>
      ))}
    </div>
  )
}

function KennelSection({ kennel, puppies, testimonials, transactions, addTestimonial }) {
  const kennelPuppies = puppies.filter(p => p.kennelId === kennel.id && !p.sold)
  const available = kennelPuppies.length
  const kennelTestimonials = testimonials.filter(t => t.kennelId === kennel.id)
  const avgRating = kennelTestimonials.length > 0
    ? (kennelTestimonials.reduce((a, t) => a + t.stars, 0) / kennelTestimonials.length).toFixed(1)
    : null

  const [showReviewForm, setShowReviewForm] = useState(false)
  const [reviewForm, setReviewForm] = useState({ buyerName: '', buyerEmail: '', stars: 0, text: '' })
  const [reviewSubmitted, setReviewSubmitted] = useState(false)

  const handleSubmitReview = async (e) => {
    e.preventDefault()
    if (!reviewForm.stars) return
    await addTestimonial({ kennelId: kennel.id, ...reviewForm })
    setReviewSubmitted(true)
    setShowReviewForm(false)
    setReviewForm({ buyerName: '', buyerEmail: '', stars: 0, text: '' })
  }

  return (
    <div className="mb-14">
      <div className="flex flex-col sm:flex-row gap-5 items-start p-6 bg-white border border-divider mb-5">
        <div className="w-16 h-16 flex-shrink-0 overflow-hidden" style={{ backgroundColor: kennel.color }}>
          {kennel.logo
            ? <img src={kennel.logo} alt={kennel.name} className="w-full h-full object-cover" />
            : <span className="w-full h-full flex items-center justify-center text-white font-bold text-lg font-body">{kennel.initials}</span>
          }
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h3 className="font-display text-2xl font-semibold text-espresso">{kennel.name}</h3>
            <span className={kennel.registry === 'KUSA' ? 'badge-kusa' : 'badge-canine'}>{kennel.registry}</span>
          </div>
          {avgRating && (
            <div className="flex items-center gap-2 mb-2">
              <StarRating value={Math.round(Number(avgRating))} />
              <span className="font-body text-xs text-muted">{avgRating} · {kennelTestimonials.length} review{kennelTestimonials.length !== 1 ? 's' : ''}</span>
            </div>
          )}
          <p className="font-body text-sm text-muted leading-relaxed mb-2 max-w-2xl">{kennel.description}</p>
          <div className="flex items-center gap-1.5 text-muted">
            <MapPin className="w-3.5 h-3.5 text-sienna" />
            <span className="font-body text-xs">{kennel.location}</span>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="font-display text-3xl font-semibold text-espresso">{available}</div>
          <div className="font-body text-xs text-muted tracking-wide">Available</div>
        </div>
      </div>

      {/* Puppy grid */}
      {kennelPuppies.length === 0 ? (
        <p className="font-body text-sm text-muted italic px-1">No puppies listed yet.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
          {kennelPuppies.map(p => <PuppyCard key={p.id} puppy={p} />)}
        </div>
      )}

      {/* Testimonials */}
      {(kennelTestimonials.length > 0 || reviewSubmitted) && (
        <div className="mb-4 space-y-3">
          <h4 className="font-body font-semibold text-sm text-espresso uppercase tracking-widest">Buyer Reviews</h4>
          {kennelTestimonials.map(t => (
            <div key={t.id} className="bg-white border border-divider p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="font-body font-semibold text-sm text-espresso">{t.buyerName}</span>
                  <span className="font-body text-xs text-muted ml-2">{t.date}</span>
                </div>
                <StarRating value={t.stars} />
              </div>
              <p className="font-body text-sm text-muted leading-relaxed">{t.text}</p>
            </div>
          ))}
          {reviewSubmitted && <p className="font-body text-xs text-sage-dark">✓ Your review has been submitted and is pending admin approval.</p>}
        </div>
      )}

      {/* Review form */}
      {!showReviewForm ? (
        <button onClick={() => setShowReviewForm(true)}
          className="font-body text-xs text-sienna hover:underline transition-colors">
          + Leave a review for {kennel.name}
        </button>
      ) : (
        <form onSubmit={handleSubmitReview} className="bg-cream border border-divider p-5 space-y-3 mt-2">
          <h4 className="font-body font-semibold text-sm text-espresso">Leave a Review</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Your Name *</label>
              <input required className="input-field text-xs py-2" value={reviewForm.buyerName} onChange={e => setReviewForm(f => ({ ...f, buyerName: e.target.value }))} placeholder="Full name" />
            </div>
            <div>
              <label className="label">Email *</label>
              <input required type="email" className="input-field text-xs py-2" value={reviewForm.buyerEmail} onChange={e => setReviewForm(f => ({ ...f, buyerEmail: e.target.value }))} placeholder="Verified against purchase" />
            </div>
          </div>
          <div>
            <label className="label mb-2">Rating *</label>
            <StarRating value={reviewForm.stars} interactive onChange={s => setReviewForm(f => ({ ...f, stars: s }))} />
            {!reviewForm.stars && <p className="font-body text-[10px] text-red-500 mt-1">Please select a star rating</p>}
          </div>
          <div>
            <label className="label">Your Experience</label>
            <textarea rows={3} className="input-field text-xs" value={reviewForm.text} onChange={e => setReviewForm(f => ({ ...f, text: e.target.value }))} placeholder="Share your experience with this kennel..." />
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => setShowReviewForm(false)} className="btn-secondary text-xs tracking-widest uppercase py-2 px-4">Cancel</button>
            <button type="submit" className="btn-primary text-xs tracking-widest uppercase py-2 px-4">Submit Review</button>
          </div>
          <p className="font-body text-[10px] text-muted">Reviews are moderated before publishing.</p>
        </form>
      )}
    </div>
  )
}

function KennelSkeleton() {
  return (
    <div className="animate-pulse space-y-4 py-8 border-b border-divider">
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-divider" />
        <div className="space-y-2 flex-1">
          <div className="h-4 bg-divider rounded w-48" />
          <div className="h-3 bg-divider rounded w-32" />
        </div>
      </div>
      <div className="h-3 bg-divider rounded w-3/4" />
      <div className="h-3 bg-divider rounded w-1/2" />
    </div>
  )
}

export default function KennelsPage() {
  const { kennels, puppies, testimonials, transactions, addTestimonial, loadingPublic } = useApp()
  const [tab, setTab] = useState('KUSA')
  const approved = kennels.filter(k => k.status === 'approved')
  const kusaKennels = approved.filter(k => k.registry === 'KUSA')
  const canineKennels = approved.filter(k => k.registry === 'Canine SA')
  const shown = tab === 'KUSA' ? kusaKennels : canineKennels

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-10">
        <h1 className="font-display text-4xl md:text-5xl font-semibold text-espresso mb-3">Our Independent Trading Kennels</h1>
        <p className="font-body text-sm text-muted max-w-xl">
          Browse South Africa's finest registered Chihuahua kennels. Every breeder is verified with KUSA or Canine SA before listing.
        </p>
      </div>

      <div className="flex gap-0 mb-10 border-b-2 border-divider">
        <button onClick={() => setTab('KUSA')}
          className={`tab-btn ${tab === 'KUSA' ? 'text-sienna border-b-2 border-sienna -mb-[2px]' : 'text-muted hover:text-espresso'}`}>
          KUSA
          <span className={`ml-2 text-[10px] py-0.5 px-1.5 font-bold ${tab === 'KUSA' ? 'bg-espresso text-cream' : 'bg-divider text-muted'}`}>{kusaKennels.length}</span>
        </button>
        <button onClick={() => setTab('Canine SA')}
          className={`tab-btn ${tab === 'Canine SA' ? 'text-sage border-b-2 border-sage -mb-[2px]' : 'text-muted hover:text-espresso'}`}>
          Canine SA
          <span className={`ml-2 text-[10px] py-0.5 px-1.5 font-bold ${tab === 'Canine SA' ? 'bg-sage text-white' : 'bg-divider text-muted'}`}>{canineKennels.length}</span>
        </button>
      </div>

      <div className={`flex items-start gap-3 p-4 mb-8 border-l-4 ${tab === 'KUSA' ? 'border-espresso bg-espresso/5' : 'border-sage bg-sage/5'}`}>
        <div>
          <p className="font-body font-semibold text-sm text-espresso mb-1">
            {tab === 'KUSA' ? 'Kennel Union of Southern Africa (KUSA)' : 'Canine SA'}
          </p>
          <p className="font-body text-xs text-muted leading-relaxed">
            {tab === 'KUSA'
              ? "KUSA is South Africa's premier kennel registry, affiliated with the FCI (Fédération Cynologique Internationale). KUSA Chihuahua pedigrees conform to FCI Standard No. 218 and are internationally recognised."
              : "Canine SA is South Africa's alternative registry for responsible Chihuahua breeders outside of the FCI umbrella, with its own breed standards, registration system, and show schedule."}
          </p>
        </div>
      </div>

      {loadingPublic ? (
        [1, 2].map(i => <KennelSkeleton key={i} />)
      ) : shown.length === 0 ? (
        <p className="font-body text-sm text-muted text-center py-16">No approved kennels in this registry yet.</p>
      ) : (
        shown.map(kennel => (
          <KennelSection key={kennel.id} kennel={kennel} puppies={puppies}
            testimonials={testimonials} transactions={transactions} addTestimonial={addTestimonial} />
        ))
      )}
    </div>
  )
}
