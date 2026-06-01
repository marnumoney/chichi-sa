import { useApp } from '../../context/AppContext'
import { Trash2, Star } from 'lucide-react'

function Stars({ value }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(s => (
        <Star key={s} className={`w-3.5 h-3.5 ${s <= value ? 'fill-amber-400 text-amber-400' : 'text-divider'}`} />
      ))}
    </div>
  )
}

export default function AdminTestimonials() {
  const { testimonials, kennels, removeTestimonial } = useApp()

  return (
    <div>
      <div className="mb-8">
        <h2 className="font-display text-3xl font-semibold text-espresso mb-1">Reviews & Testimonials</h2>
        <p className="font-body text-sm text-muted">Remove inappropriate or fraudulent reviews. Approved reviews are visible on kennel pages.</p>
      </div>

      {testimonials.length === 0 ? (
        <div className="bg-white border border-divider p-12 text-center font-body text-sm text-muted">No reviews submitted yet.</div>
      ) : (
        <div className="bg-white border border-divider overflow-hidden">
          <table className="w-full font-body text-sm">
            <thead>
              <tr className="bg-cream border-b border-divider">
                {['Kennel', 'Reviewer', 'Rating', 'Review', 'Date', 'Actions'].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-widest">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-divider">
              {testimonials.map(t => {
                const kennel = kennels.find(k => k.id === t.kennelId)
                return (
                  <tr key={t.id} className="hover:bg-cream/30 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        {kennel && <div className="w-4 h-4 flex-shrink-0" style={{ backgroundColor: kennel.color }} />}
                        <span className="font-semibold text-espresso text-xs">{kennel?.name ?? '—'}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <p className="font-semibold text-espresso text-xs">{t.buyerName}</p>
                      <p className="text-[10px] text-muted">{t.buyerEmail}</p>
                    </td>
                    <td className="px-5 py-3"><Stars value={t.stars} /></td>
                    <td className="px-5 py-3 max-w-xs">
                      <p className="text-xs text-muted leading-relaxed line-clamp-2">{t.text}</p>
                    </td>
                    <td className="px-5 py-3 text-xs text-muted">{t.date}</td>
                    <td className="px-5 py-3">
                      <button onClick={() => removeTestimonial(t.id)}
                        className="flex items-center gap-1 text-muted hover:text-red-500 font-body text-xs transition-colors">
                        <Trash2 className="w-3.5 h-3.5" /> Remove
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
