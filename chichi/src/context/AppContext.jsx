import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const AppContext = createContext(null)

function toCamel(str) {
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
}

function normalize(val) {
  if (Array.isArray(val)) return val.map(normalize)
  if (val && typeof val === 'object') {
    return Object.fromEntries(Object.entries(val).map(([k, v]) => [toCamel(k), normalize(v)]))
  }
  return val
}

function toSnake(str) {
  return str.replace(/([A-Z])/g, c => `_${c.toLowerCase()}`)
}

function denormalize(val) {
  if (Array.isArray(val)) return val.map(denormalize)
  if (val && typeof val === 'object') {
    return Object.fromEntries(Object.entries(val).map(([k, v]) => [toSnake(k), denormalize(v)]))
  }
  return val
}

function getToken() {
  return localStorage.getItem('token')
}

function authHeaders() {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function apiFetch(path, options = {}) {
  const body = options.body && typeof options.body === 'object'
    ? JSON.stringify(denormalize(options.body))
    : options.body
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    ...options,
    body,
  })
  return res
}

export function AppProvider({ children }) {
  const [kennels, setKennels] = useState([])
  const [puppies, setPuppies] = useState([])
  const [sellers, setSellers] = useState([])
  const [transactions, setTransactions] = useState([])
  const [testimonials, setTestimonials] = useState([])
  const [adminSettings, setAdminSettings] = useState({})
  const [legalContent, setLegalContent] = useState('')
  const [adminUser, setAdminUser] = useState(null)
  const [sellerUser, setSellerUser] = useState(null)

  // ── Public data loaders ───────────────────────────────────────────────────
  const loadKennels = useCallback(async () => {
    const res = await apiFetch('/kennels')
    if (res.ok) setKennels(normalize(await res.json()))
  }, [])

  const loadPuppies = useCallback(async () => {
    const res = await apiFetch('/puppies')
    if (res.ok) setPuppies(normalize(await res.json()))
  }, [])

  const loadTestimonials = useCallback(async () => {
    const res = await apiFetch('/testimonials')
    if (res.ok) setTestimonials(normalize(await res.json()))
  }, [])

  useEffect(() => {
    loadKennels()
    loadPuppies()
    loadTestimonials()
  }, [loadKennels, loadPuppies, loadTestimonials])

  // ── Bootstrap: restore session from localStorage ──────────────────────────
  useEffect(() => {
    const token = getToken()
    const role = localStorage.getItem('role')
    if (!token) return
    if (role === 'admin') {
      setAdminUser({ email: localStorage.getItem('adminEmail') || '', name: 'Admin' })
    }
    if (role === 'seller') {
      apiFetch('/seller/me').then(async res => {
        if (res.ok) {
          const data = normalize(await res.json())
          setSellerUser({ ...data.seller, kennel: data.kennel })
        } else {
          localStorage.removeItem('token')
          localStorage.removeItem('role')
        }
      })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Admin data loaders ────────────────────────────────────────────────────
  const loadAdminData = useCallback(async () => {
    const [kRes, sRes, tRes, txRes, setRes, legRes] = await Promise.all([
      apiFetch('/admin/kennels'),
      apiFetch('/admin/sellers'),
      apiFetch('/admin/testimonials'),
      apiFetch('/admin/transactions'),
      apiFetch('/admin/settings'),
      apiFetch('/admin/legal'),
    ])
    if (kRes.ok) setKennels(normalize(await kRes.json()))
    if (sRes.ok) setSellers(normalize(await sRes.json()))
    if (tRes.ok) setTestimonials(normalize(await tRes.json()))
    if (txRes.ok) setTransactions(normalize(await txRes.json()))
    if (setRes.ok) setAdminSettings(normalize(await setRes.json()))
    if (legRes.ok) { const d = normalize(await legRes.json()); setLegalContent(d.content) }
  }, [])

  // ── Auth ──────────────────────────────────────────────────────────────────
  const loginAdmin = async (email, password) => {
    const res = await apiFetch('/auth/admin/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    if (!res.ok) return false
    const { token } = await res.json()
    localStorage.setItem('token', token)
    localStorage.setItem('role', 'admin')
    localStorage.setItem('adminEmail', email)
    setAdminUser({ email, name: 'Admin' })
    await loadAdminData()
    return true
  }

  const loginSeller = async (email, password) => {
    const res = await apiFetch('/auth/seller/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    if (!res.ok) {
      const err = await res.json()
      return { success: false, error: err.detail || 'Invalid credentials.' }
    }
    const raw = await res.json()
    const { token } = raw
    // API returns { token, seller: { ...fields, kennel: {...} } }
    // kennel is nested inside seller — normalize handles the whole tree
    const seller = normalize(raw.seller)
    localStorage.setItem('token', token)
    localStorage.setItem('role', 'seller')
    setSellerUser(seller)
    return { success: true }
  }

  const logoutAdmin = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('role')
    localStorage.removeItem('adminEmail')
    setAdminUser(null)
  }

  const logoutSeller = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('role')
    setSellerUser(null)
  }

  const signupSeller = async (formData) => {
    const res = await apiFetch('/auth/seller/signup', {
      method: 'POST',
      body: JSON.stringify(formData),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.detail || 'Signup failed')
    return normalize(data)
  }

  // ── Public purchase ───────────────────────────────────────────────────────
  const purchasePuppy = async (puppyId, buyerDetails) => {
    const res = await apiFetch('/transactions', {
      method: 'POST',
      body: JSON.stringify({
        puppy_id: puppyId,
        buyer_name: buyerDetails?.name ?? 'Anonymous',
        buyer_email: buyerDetails?.email ?? '',
      }),
    })
    if (!res.ok) return null
    const txn = normalize(await res.json())
    await loadPuppies()
    return txn
  }

  // ── Seller actions ────────────────────────────────────────────────────────
  const addPuppy = async (puppyData) => {
    await apiFetch('/seller/puppies', {
      method: 'POST',
      body: JSON.stringify(puppyData),
    })
    await loadPuppies()
  }

  const delistPuppy = async (puppyId) => {
    await apiFetch(`/seller/puppies/${puppyId}`, { method: 'DELETE' })
    await loadPuppies()
  }

  const updateSellerProfile = async (updates) => {
    const res = await apiFetch('/seller/profile', {
      method: 'PUT',
      body: JSON.stringify(updates),
    })
    if (res.ok) {
      const kennel = normalize(await res.json())
      setSellerUser(prev => ({ ...prev, kennel }))
      await loadKennels()
    }
  }

  // ── Admin — kennels ───────────────────────────────────────────────────────
  const adminAddKennel = async (data) => {
    const res = await apiFetch('/admin/kennels', {
      method: 'POST',
      body: JSON.stringify(data),
    })
    const kennel = normalize(await res.json())
    await loadAdminData()
    return kennel
  }

  const adminEditKennel = async (kennelId, updates) => {
    await apiFetch(`/admin/kennels/${kennelId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    })
    await loadAdminData()
  }

  const adminRemoveKennel = async (kennelId) => {
    await apiFetch(`/admin/kennels/${kennelId}`, { method: 'DELETE' })
    await loadAdminData()
  }

  const approveKennel = async (kennelId) => {
    await adminEditKennel(kennelId, { status: 'approved' })
  }

  const rejectKennel = async (kennelId) => {
    await adminEditKennel(kennelId, { status: 'rejected' })
  }

  const updateKennelCommission = async (kennelId, commission) => {
    await adminEditKennel(kennelId, { commission: Number(commission) })
  }

  // ── Admin — sellers ───────────────────────────────────────────────────────
  const adminAddSeller = async (data) => {
    const res = await apiFetch('/admin/sellers', {
      method: 'POST',
      body: JSON.stringify(data),
    })
    const seller = normalize(await res.json())
    await loadAdminData()
    return seller
  }

  const adminEditSeller = async (sellerId, updates) => {
    await apiFetch(`/admin/sellers/${sellerId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    })
    await loadAdminData()
  }

  const adminRemoveSeller = async (sellerId) => {
    await apiFetch(`/admin/sellers/${sellerId}`, { method: 'DELETE' })
    await loadAdminData()
  }

  const approveSeller = async (sellerId) => {
    await apiFetch(`/admin/sellers/${sellerId}/approve`, { method: 'PATCH' })
    await loadAdminData()
  }

  const payMembership = async (sellerId) => {
    await apiFetch(`/admin/sellers/${sellerId}/pay-membership`, { method: 'PATCH' })
    await loadAdminData()
  }

  // ── Admin — puppies ───────────────────────────────────────────────────────
  const adminRemovePuppy = async (puppyId) => {
    await apiFetch(`/admin/puppies/${puppyId}`, { method: 'DELETE' })
    await loadAdminData()
    await loadPuppies()
  }

  // ── Admin — testimonials ──────────────────────────────────────────────────
  const addTestimonial = async (data) => {
    await apiFetch('/admin/testimonials', {
      method: 'POST',
      body: JSON.stringify(data),
    })
    await loadTestimonials()
  }

  const removeTestimonial = async (id) => {
    await apiFetch(`/admin/testimonials/${id}`, { method: 'DELETE' })
    await loadTestimonials()
  }

  // ── Admin — transactions ──────────────────────────────────────────────────
  const releasePayment = async (txnId) => {
    await apiFetch(`/admin/transactions/${txnId}/release`, { method: 'POST' })
    await loadAdminData()
  }

  const markSellerPaid = async (txnId) => {
    await releasePayment(txnId)
  }

  const markCommissionPaid = async (txnId) => {
    await releasePayment(txnId)
  }

  // ── Admin — settings & legal ──────────────────────────────────────────────
  const updateAdminSettings = async (settings) => {
    const res = await apiFetch('/admin/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    })
    if (res.ok) setAdminSettings(normalize(await res.json()))
  }

  const updateLegal = async (content) => {
    const res = await apiFetch('/admin/legal', {
      method: 'PUT',
      body: JSON.stringify({ content }),
    })
    if (res.ok) { const d = normalize(await res.json()); setLegalContent(d.content) }
  }

  return (
    <AppContext.Provider value={{
      kennels, puppies, sellers, adminSettings, legalContent, transactions, testimonials,
      addTestimonial, removeTestimonial,
      adminUser, sellerUser,
      loginAdmin, loginSeller, logoutAdmin, logoutSeller,
      purchasePuppy, releasePayment, markSellerPaid, markCommissionPaid,
      approveSeller, approveKennel, rejectKennel,
      updateKennelCommission, addPuppy, delistPuppy,
      updateLegal, updateAdminSettings, signupSeller, updateSellerProfile,
      payMembership,
      adminRemovePuppy, adminAddKennel, adminEditKennel, adminRemoveKennel,
      adminAddSeller, adminEditSeller, adminRemoveSeller,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export const useApp = () => useContext(AppContext)
