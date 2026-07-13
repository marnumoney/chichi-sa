const LOGO_SRC = '/logo.jpg'

export function ChihuahuaMark({ size = 'md', className = '' }) {
  const sizes = {
    sm: 'h-9 w-9',
    md: 'h-12 w-12',
    lg: 'h-16 w-16',
  }
  return (
    <div className={`${sizes[size]} flex-shrink-0 overflow-hidden ${className}`}
      style={{ borderRadius: '6px', boxShadow: '0 2px 8px rgba(0,0,0,0.25)' }}>
      <img src={LOGO_SRC} alt="Chihuahua South Africa" className="w-full h-full object-cover" />
    </div>
  )
}

/** Full horizontal logo — large mark + text */
export function Logo({ light = false, size = 'md' }) {
  const textColor = light ? 'text-cream' : 'text-espresso'
  const subColor = light ? 'text-cream/60' : 'text-muted'
  const displaySize = size === 'sm' ? 'text-lg' : size === 'lg' ? 'text-3xl' : 'text-xl'
  const markSize = size === 'lg' ? 'lg' : size === 'sm' ? 'sm' : 'md'

  return (
    <div className="flex items-center gap-3">
      <ChihuahuaMark size={markSize} />
      <div className="leading-none">
        <div className={`font-display ${displaySize} font-semibold ${textColor} tracking-wide leading-tight`}>
          Chihuahua
        </div>
        <div className={`font-body text-[9px] tracking-[0.22em] uppercase font-semibold ${subColor} mt-0.5`}>
          South Africa
        </div>
      </div>
    </div>
  )
}

/** Compact stacked logo for narrow sidebars */
export function LogoCompact({ light = false }) {
  const textColor = light ? 'text-cream' : 'text-espresso'
  const subColor = light ? 'text-cream/50' : 'text-muted'
  return (
    <div className="flex items-center gap-2.5">
      <ChihuahuaMark size="sm" />
      <div className="leading-none">
        <div className={`font-display text-base font-semibold ${textColor} leading-tight`}>Chihuahua</div>
        <div className={`font-body text-[8px] tracking-[0.2em] uppercase font-semibold ${subColor}`}>South Africa</div>
      </div>
    </div>
  )
}
