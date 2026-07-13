import { Link } from 'react-router-dom'
import { ChihuahuaMark } from './Logo'

export default function Footer() {
  return (
    <footer className="bg-espresso text-cream/70">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          <div className="md:col-span-1">
            <div className="flex items-center gap-2.5 mb-4">
              <ChihuahuaMark size="sm" />
              <div className="leading-none">
                <div className="font-display text-xl font-semibold text-cream">Chihuahua</div>
                <div className="font-body text-[8px] tracking-[0.2em] uppercase text-cream/50 font-semibold">South Africa</div>
              </div>
            </div>
            <p className="font-body text-sm leading-relaxed mb-4">
              South Africa's premier marketplace for verified KUSA and Canine SA Chihuahua breeders.
            </p>
            <div className="flex gap-2">
              <span className="bg-cream/10 text-cream/80 text-[9px] font-bold tracking-widest uppercase px-2.5 py-1">KUSA</span>
              <span className="bg-sage/30 text-[#7FB08D] text-[9px] font-bold tracking-widest uppercase px-2.5 py-1">CANINE SA</span>
            </div>
          </div>

          <div>
            <h4 className="font-body text-xs tracking-[0.2em] uppercase font-semibold text-cream mb-4">Browse</h4>
            <ul className="space-y-2.5 font-body text-sm">
              <li><Link to="/" className="hover:text-sienna-light transition-colors">All Puppies</Link></li>
              <li><Link to="/kennels" className="hover:text-sienna-light transition-colors">KUSA Kennels</Link></li>
              <li><Link to="/kennels" className="hover:text-sienna-light transition-colors">Canine SA Kennels</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-body text-xs tracking-[0.2em] uppercase font-semibold text-cream mb-4">For Breeders</h4>
            <ul className="space-y-2.5 font-body text-sm">
              <li><Link to="/seller/signup" className="hover:text-sienna-light transition-colors">Join the Marketplace</Link></li>
              <li><Link to="/seller/login" className="hover:text-sienna-light transition-colors">Seller Portal</Link></li>
              <li><Link to="/admin/login" className="hover:text-sienna-light transition-colors">Admin Login</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-body text-xs tracking-[0.2em] uppercase font-semibold text-cream mb-4">Legal</h4>
            <ul className="space-y-2.5 font-body text-sm">
              <li><Link to="/legal" className="hover:text-sienna-light transition-colors">Terms & Conditions</Link></li>
              <li><Link to="/contact" className="hover:text-sienna-light transition-colors">Contact Us</Link></li>
              <li><Link to="/buyer-protection" className="hover:text-sienna-light transition-colors">Buyer Protection</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-cream/10 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="font-body text-xs text-cream/50">© 2026 Chihuahua South Africa. All rights reserved.</p>
          <p className="font-body text-xs text-cream/50">Verified Chihuahua breeders. Registered pedigrees. Trusted marketplace.</p>
        </div>
      </div>
    </footer>
  )
}
