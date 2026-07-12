import { Link } from 'react-router-dom'
import { MapPin } from 'lucide-react'
import { useApp } from '../context/AppContext'

function getAge(dob) {
  const now = new Date()
  const birth = new Date(dob)
  const weeks = Math.floor((now - birth) / (1000 * 60 * 60 * 24 * 7))
  const months = Math.floor((now - birth) / (1000 * 60 * 60 * 24 * 30.4))
  if (weeks < 20) return `${weeks}w old`
  if (months < 24) return `${months}mo old`
  return `${Math.floor(months / 12)}yr old`
}

function KennelAvatar({ kennel, size = 'sm' }) {
  const dim = size === 'sm' ? 'w-7 h-7 text-[9px]' : 'w-10 h-10 text-xs'
  if (kennel?.logo) {
    return (
      <div className={`${dim} overflow-hidden flex-shrink-0`}>
        <img src={kennel.logo} alt={kennel.name} className="w-full h-full object-cover" />
      </div>
    )
  }
  return (
    <div
      className={`${dim} flex items-center justify-center text-white font-bold flex-shrink-0`}
      style={{ backgroundColor: kennel?.color || '#8B7355' }}
    >
      {kennel?.initials || '??'}
    </div>
  )
}

export default function PuppyCard({ puppy }) {
  const { kennels } = useApp()
  const kennel = kennels.find(k => k.id === puppy.kennelId)
  const status = puppy.status || (puppy.sold ? 'sold' : 'available')
  const isSold = status === 'sold'
  const isBooked = status === 'booked'

  return (
    <div className={`card overflow-hidden flex flex-col transition-shadow hover:shadow-md group ${isSold ? 'opacity-70' : ''}`}>
      {/* Image */}
      <div className="relative overflow-hidden aspect-[4/3]">
        <img
          src={puppy.images[0]}
          alt={puppy.name}
          onError={e => { e.target.src = `https://picsum.photos/seed/${puppy.id}/400/300` }}
          className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 ${isSold ? 'grayscale' : ''}`}
        />
        {/* Badges */}
        <div className="absolute top-2.5 left-2.5 flex gap-1.5">
          {kennel?.registry === 'KUSA' ? (
            <span className="badge-kusa">KUSA</span>
          ) : (
            <span className="badge-canine">Canine SA</span>
          )}
          {isSold && <span className="badge-sold">Sold</span>}
          {isBooked && <span className="badge-booked">Booked</span>}
          {!isSold && !isBooked && <span className="badge-available">Available</span>}
        </div>
        {/* Gender tag */}
        <div className={`absolute top-2.5 right-2.5 text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 ${puppy.gender === 'Male' ? 'bg-blue-600 text-white' : 'bg-pink-500 text-white'}`}>
          {puppy.gender}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col flex-1">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-display text-xl font-semibold text-espresso leading-tight">{puppy.name}</h3>
          <span className="font-display text-lg font-semibold text-sienna whitespace-nowrap">
            R{puppy.price.toLocaleString()}
          </span>
        </div>
        <p className="font-body text-xs text-muted mb-2">Chihuahua · {puppy.coatType ?? 'Smooth Coat'} · {puppy.color} · {getAge(puppy.dob)}</p>
        {puppy.breedingRights !== undefined && (
          <span className={`inline-block text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 mb-3 ${puppy.breedingRights ? 'bg-sage/15 text-sage-dark' : 'bg-espresso/10 text-espresso'}`}>
            {puppy.breedingRights ? 'Full Breeding Rights' : 'Non-Breeding · Pet Only'}
          </span>
        )}

        {/* Kennel */}
        <div className="flex items-center gap-2 mb-4">
          <KennelAvatar kennel={kennel} />
          <div className="min-w-0">
            <p className="font-body text-xs font-semibold text-espresso truncate">{kennel?.name}</p>
            <div className="flex items-center gap-1">
              <MapPin className="w-2.5 h-2.5 text-muted flex-shrink-0" />
              <p className="font-body text-[10px] text-muted truncate">{kennel?.location}</p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-auto">
          {isSold ? (
            <button
              disabled
              className="w-full py-2.5 bg-divider text-muted text-xs font-body font-semibold tracking-widest uppercase cursor-not-allowed"
            >
              Sold
            </button>
          ) : (
            <Link
              to={`/puppies/${puppy.id}`}
              className="block w-full py-2.5 bg-espresso text-cream text-xs font-body font-semibold tracking-widest uppercase text-center transition-colors hover:bg-sienna"
            >
              View Details
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
