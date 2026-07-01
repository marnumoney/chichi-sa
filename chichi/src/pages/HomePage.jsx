import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Search, ChevronRight, Shield, Award, Star } from 'lucide-react'
import { useApp } from '../context/AppContext'
import PuppyCard from '../components/PuppyCard'

const COAT_TYPES = ['All', 'Smooth Coat', 'Long Coat']

export default function HomePage() {
  const { puppies, kennels } = useApp()
  const [search, setSearch] = useState('')
  const [coat, setCoat] = useState('All')
  const [registry, setRegistry] = useState('All')
  const [gender, setGender] = useState('All')

  const approvedKennels = kennels.filter(k => k.status === 'approved')

  const filtered = useMemo(() => {
    return puppies.filter(p => {
      const kennel = kennels.find(k => k.id === p.kennelId)
      if (!kennel || kennel.status !== 'approved') return false
      if (coat !== 'All' && p.coatType !== coat) return false
      if (registry !== 'All' && kennel?.registry !== registry) return false
      if (gender !== 'All' && p.gender !== gender) return false
      if (search && !p.name.toLowerCase().includes(search.toLowerCase()) &&
          !p.color.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [puppies, kennels, coat, registry, gender, search])

  const allShown = filtered.filter(p => !p.sold)

  return (
    <div>
      {/* ── Hero ── */}
      <section className="relative overflow-hidden min-h-[82vh] flex items-center">
        {/* Background photo */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('https://images.pexels.com/photos/39317/chihuahua-dog-puppy-cute-39317.jpeg?auto=compress&cs=tinysrgb&w=1600')" }}
        />
        {/* Gradient overlay — dark left for text, fades right to reveal photo */}
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to right, rgba(30,20,12,0.88) 0%, rgba(30,20,12,0.65) 45%, rgba(30,20,12,0.25) 100%)' }}
        />
        {/* Bottom fade to blend into next section */}
        <div className="absolute bottom-0 left-0 right-0 h-24"
          style={{ background: 'linear-gradient(to top, #2A1F14 0%, transparent 100%)' }} />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 w-full">
          <div className="max-w-2xl">
            <div className="flex gap-2 mb-6">
              <span className="bg-white/15 backdrop-blur-sm text-white text-[10px] font-bold tracking-widest uppercase px-3 py-1 border border-white/20">KUSA Verified</span>
              <span className="bg-sage/40 backdrop-blur-sm text-white text-[10px] font-bold tracking-widest uppercase px-3 py-1 border border-sage/30">Canine SA Verified</span>
            </div>
            <h1 className="font-display text-5xl md:text-6xl lg:text-7xl font-semibold text-white leading-[1.05] mb-6 text-balance drop-shadow-lg">
              South Africa's Home<br />of the
              <em className="text-sienna-light font-light not-italic"> Chihuahua.</em>
            </h1>
            <p className="font-body text-base md:text-lg text-white/75 leading-relaxed mb-8 max-w-lg">
              Browse Chihuahua puppies from verified KUSA and Canine SA registered kennels.
              Smooth coat, long coat, and rare colour specialists — all approved.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link to="/kennels" className="btn-primary text-xs tracking-widest uppercase text-center">
                Browse Kennels
              </Link>
              <Link to="/seller/signup" className="border border-white/50 text-white font-body font-medium text-xs tracking-widest uppercase px-6 py-3 hover:bg-white/10 transition-colors text-center">
                List Your Chi's
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Trust bar ── */}
      <section className="bg-espresso py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
            {[
              { icon: Shield, text: 'Verified Chi Breeders' },
              { icon: Award, text: 'Registered Pedigrees' },
              { icon: Star, text: 'Health Tested' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <Icon className="w-4 h-4 text-sienna-light flex-shrink-0" />
                <span className="font-body text-xs text-cream/70 tracking-wide font-medium">{text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Puppy listings ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <h2 className="section-title">Available Puppies</h2>
            {allShown.length > 0 && (
              <p className="font-body text-sm text-muted mt-1">{allShown.length} available</p>
            )}
          </div>
          <Link to="/kennels" className="flex items-center gap-1 text-sienna font-body text-sm font-medium hover:gap-2 transition-all">
            View by Kennel <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-8 p-3 sm:p-4 bg-white border border-divider">
          {/* Search */}
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
            <input
              type="text"
              placeholder="Search name or colour..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input-field pl-9 py-2 text-xs"
            />
          </div>
          {/* Registry */}
          <div className="flex gap-1">
            {['All', 'KUSA', 'Canine SA'].map(r => (
              <button
                key={r}
                onClick={() => setRegistry(r)}
                className={`px-3 py-2 font-body text-xs font-medium tracking-wide transition-colors ${registry === r ? 'bg-espresso text-cream' : 'bg-white border border-divider text-muted hover:text-espresso'}`}
              >
                {r}
              </button>
            ))}
          </div>
          {/* Gender */}
          <div className="flex gap-1">
            {['All', 'Female', 'Male'].map(g => (
              <button
                key={g}
                onClick={() => setGender(g)}
                className={`px-3 py-2 font-body text-xs font-medium tracking-wide transition-colors ${
                  gender === g
                    ? g === 'Female' ? 'bg-pink-500 text-white' : g === 'Male' ? 'bg-blue-600 text-white' : 'bg-espresso text-cream'
                    : 'bg-white border border-divider text-muted hover:text-espresso'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
          {/* Coat type */}
          <div className="flex gap-1">
            {COAT_TYPES.map(c => (
              <button
                key={c}
                onClick={() => setCoat(c)}
                className={`px-3 py-2 font-body text-xs font-medium tracking-wide transition-colors ${coat === c ? 'bg-sienna text-white' : 'bg-white border border-divider text-muted hover:text-espresso'}`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        {allShown.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-divider">
            {search || coat !== 'All' || registry !== 'All' || gender !== 'All' ? (
              <p className="font-body text-sm text-muted">No puppies match your search.</p>
            ) : (
              <>
                <p className="font-display text-xl font-semibold text-espresso mb-2">Listings coming soon</p>
                <p className="font-body text-sm text-muted max-w-sm mx-auto">Our first verified breeders are joining the marketplace. Check back shortly for available Chihuahuas.</p>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {allShown.map(p => <PuppyCard key={p.id} puppy={p} />)}
          </div>
        )}
      </section>

      {/* ── Featured Kennels — only shown when breeders exist ── */}
      {approvedKennels.length > 0 && (
        <section className="bg-white border-t border-divider py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-end justify-between mb-8">
              <h2 className="section-title">Our Independent Trading Kennels</h2>
              <Link to="/kennels" className="flex items-center gap-1 text-sienna font-body text-sm font-medium hover:gap-2 transition-all">
                See all <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {approvedKennels.map(kennel => (
                <Link key={kennel.id} to="/kennels" className="p-4 border border-divider hover:border-sienna/40 hover:shadow-sm transition-all group text-center">
                  <div
                    className="w-12 h-12 mx-auto mb-3 flex items-center justify-center text-white font-bold text-sm font-body overflow-hidden"
                    style={{ backgroundColor: kennel.color }}
                  >
                    {kennel.logo
                      ? <img src={kennel.logo} alt={kennel.name} className="w-full h-full object-cover" />
                      : kennel.initials
                    }
                  </div>
                  <p className="font-body text-xs font-semibold text-espresso group-hover:text-sienna transition-colors leading-tight">{kennel.name}</p>
                  <p className="font-body text-[10px] text-muted mt-0.5">{kennel.registry}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── How It Works ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-12">
          <h2 className="section-title mb-3">How It Works</h2>
          <p className="font-body text-sm text-muted max-w-lg mx-auto">
            A simple, secure process for connecting families with exceptional breeders.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { num: '01', title: 'Browse & Discover', desc: 'Explore Chihuahuas from KUSA and Canine SA registered kennels across South Africa. Filter by coat type, registry, and colour.' },
            { num: '02', title: 'Purchase Securely', desc: 'Buy directly through the platform via Yoco. Funds are released to the breeder by the Chihuahua South Africa team once delivery is confirmed.' },
            { num: '03', title: 'Connect & Collect', desc: 'Once purchased, you\'re directly connected with the breeder to arrange collection or transport to your home.' },
          ].map(({ num, title, desc }) => (
            <div key={num} className="relative pl-6 border-l-2 border-divider">
              <span className="font-display text-5xl font-bold text-divider select-none absolute -left-4 -top-3">{num}</span>
              <h3 className="font-display text-xl font-semibold text-espresso mb-2 mt-4">{title}</h3>
              <p className="font-body text-sm text-muted leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section className="bg-sienna py-14">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="font-display text-3xl md:text-4xl font-semibold text-cream mb-4">
            Are you a registered Chihuahua breeder?
          </h2>
          <p className="font-body text-sm text-cream/80 mb-8 max-w-lg mx-auto">
            Join to list your Chihuahua puppies and reach thousands of serious buyers across South Africa.
            KUSA and Canine SA breeders welcome.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/seller/signup" className="bg-cream text-sienna-dark font-body font-semibold text-xs tracking-widest uppercase px-8 py-3.5 hover:bg-wheat transition-colors">
              Apply to Join
            </Link>
            <Link to="/seller/login" className="border border-cream/50 text-cream font-body text-xs tracking-widest uppercase px-8 py-3.5 hover:bg-white/10 transition-colors">
              Seller Login
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
