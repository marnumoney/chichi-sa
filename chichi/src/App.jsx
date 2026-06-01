import { Routes, Route, Navigate } from 'react-router-dom'
import { useApp } from './context/AppContext'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import HomePage from './pages/HomePage'
import KennelsPage from './pages/KennelsPage'
import PuppyDetailPage from './pages/PuppyDetailPage'
import AdminLogin from './pages/admin/AdminLogin'
import AdminLayout from './pages/admin/AdminLayout'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminLegal from './pages/admin/AdminLegal'
import AdminKennels from './pages/admin/AdminKennels'
import AdminWallet from './pages/admin/AdminWallet'
import AdminUsers from './pages/admin/AdminUsers'
import AdminPuppies from './pages/admin/AdminPuppies'
import AdminTestimonials from './pages/admin/AdminTestimonials'
import AdminBroadcast from './pages/admin/AdminBroadcast'
import AdminSettings from './pages/admin/AdminSettings'
import ContactPage from './pages/ContactPage'
import LegalPage from './pages/LegalPage'
import SellerSignup from './pages/seller/SellerSignup'
import SellerLogin from './pages/seller/SellerLogin'
import SellerLayout from './pages/seller/SellerLayout'
import SellerDashboard from './pages/seller/SellerDashboard'
import SellerPuppies from './pages/seller/SellerPuppies'
import SellerProfile from './pages/seller/SellerProfile'
import PayMembership from './pages/PayMembership'

function ProtectedAdmin({ children }) {
  const { adminUser } = useApp()
  return adminUser ? children : <Navigate to="/admin/login" replace />
}

function ProtectedSeller({ children }) {
  const { sellerUser } = useApp()
  return sellerUser ? children : <Navigate to="/seller/login" replace />
}

function PublicLayout({ children }) {
  return (
    <>
      <Navbar />
      {children}
      <Footer />
    </>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<PublicLayout><HomePage /></PublicLayout>} />
      <Route path="/kennels" element={<PublicLayout><KennelsPage /></PublicLayout>} />
      <Route path="/puppies/:id" element={<PublicLayout><PuppyDetailPage /></PublicLayout>} />

      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin" element={<ProtectedAdmin><AdminLayout /></ProtectedAdmin>}>
        <Route index element={<AdminDashboard />} />
        <Route path="wallet" element={<AdminWallet />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="puppies" element={<AdminPuppies />} />
        <Route path="testimonials" element={<AdminTestimonials />} />
        <Route path="broadcast" element={<AdminBroadcast />} />
        <Route path="settings" element={<AdminSettings />} />
        <Route path="legal" element={<AdminLegal />} />
        <Route path="kennels" element={<AdminKennels />} />
      </Route>

      <Route path="/pay/membership" element={<PayMembership />} />
      <Route path="/seller/signup" element={<SellerSignup />} />
      <Route path="/seller/login" element={<SellerLogin />} />
      <Route path="/seller" element={<ProtectedSeller><SellerLayout /></ProtectedSeller>}>
        <Route index element={<SellerDashboard />} />
        <Route path="puppies" element={<SellerPuppies />} />
        <Route path="profile" element={<SellerProfile />} />
      </Route>

      <Route path="/contact" element={<PublicLayout><ContactPage /></PublicLayout>} />
      <Route path="/legal" element={<PublicLayout><LegalPage /></PublicLayout>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
