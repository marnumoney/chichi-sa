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

// Retries up to `retries` times with a 15s per-attempt timeout — handles Render cold starts
async function publicFetch(path, retries = 3) {
  for (let i = 0; i <= retries; i++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15000)
    try {
      const res = await fetch(`${API}${path}`, {
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
      })
      clearTimeout(timer)
      return res
    } catch {
      clearTimeout(timer)
      if (i === retries) return null
      await new Promise(r => setTimeout(r, 2000 * (i + 1)))
    }
  }
}

export function AppProvider({ children }) {
  const [kennels, setKennels] = useState([])
  const [puppies, setPuppies] = useState([])
  const [sellers, setSellers] = useState([])
  const [buyers, setBuyers] = useState([])
  const [transactions, setTransactions] = useState([])
  const [testimonials, setTestimonials] = useState([])
  const [adminSettings, setAdminSettings] = useState({})
  const [legalContent, setLegalContent] = useState('')
  const [adminUser, setAdminUser] = useState(null)
  const [sellerUser, setSellerUser] = useState(null)
  const [buyerUser, setBuyerUser] = useState(null)
  const [loadingPublic, setLoadingPublic] = useState(true)

  // ── Public data loaders ───────────────────────────────────────────────────
  const loadKennels = useCallback(async () => {
    const res = await publicFetch('/kennels')
    if (res?.ok) setKennels(normalize(await res.json()))
  }, [])

  const loadPuppies = useCallback(async () => {
    const res = await publicFetch('/puppies')
    if (res?.ok) setPuppies(normalize(await res.json()))
  }, [])

  const loadTestimonials = useCallback(async () => {
    const res = await publicFetch('/testimonials')
    if (res?.ok) setTestimonials(normalize(await res.json()))
  }, [])

  const loadLegalContent = useCallback(async () => {
    const res = await publicFetch('/legal')
    if (res?.ok) { const data = await res.json(); setLegalContent(data.content ?? '') }
  }, [])

  useEffect(() => {
    Promise.all([loadKennels(), loadPuppies(), loadTestimonials(), loadLegalContent()])
      .finally(() => setLoadingPublic(false))
  }, [loadKennels, loadPuppies, loadTestimonials, loadLegalContent])

  // ── Bootstrap: restore session from localStorage ──────────────────────────
  useEffect(() => {
    const token = getToken()
    const role = localStorage.getItem('role')
    if (!token) return
    if (role === 'admin') {
      setAdminUser({ email: localStorage.getItem('adminEmail') || '', name: 'Admin' })
      loadAdminData()
    }
    if (role === 'seller') {
      apiFetch('/seller/me').then(async res => {
        if (res.ok) {
          const data = normalize(await res.json())
          setSellerUser({ ...data.seller, kennel: data.kennel })
        } else {
          localStorage.removeItem('token')
          localStorage.removeItem('role')
          return
        }
      })
      apiFetch('/seller/transactions').then(async res => {
        if (res.ok) setTransactions(normalize(await res.json()))
      })
    }
    if (role === 'buyer') {
      apiFetch('/buyer/me').then(async res => {
        if (res.ok) {
          const data = normalize(await res.json())
          setBuyerUser(data.buyer)
        } else {
          localStorage.removeItem('token')
          localStorage.removeItem('role')
        }
      })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Admin data loaders ────────────────────────────────────────────────────
  const loadAdminData = useCallback(async () => {
    const [kRes, sRes, tRes, txRes, setRes, legRes, bRes] = await Promise.all([
      apiFetch('/admin/kennels'),
      apiFetch('/admin/sellers'),
      apiFetch('/admin/testimonials'),
      apiFetch('/admin/transactions'),
      apiFetch('/admin/settings'),
      apiFetch('/admin/legal'),
      apiFetch('/admin/buyers'),
    ])
    if (kRes.ok) setKennels(normalize(await kRes.json()))
    if (sRes.ok) setSellers(normalize(await sRes.json()))
    if (tRes.ok) setTestimonials(normalize(await tRes.json()))
    if (txRes.ok) setTransactions(normalize(await txRes.json()))
    if (setRes.ok) setAdminSettings(normalize(await setRes.json()))
    if (legRes.ok) { const d = normalize(await legRes.json()); setLegalContent(d.content) }
    if (bRes.ok) setBuyers(normalize(await bRes.json()))
  }, [])

  // ── Auth ──────────────────────────────────────────────────────────────────
  const loginAdmin = async (email, password) => {
    const res = await apiFetch('/auth/admin/login', {
      method: 'POST',
      body: { email, password },
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
      body: { email, password },
    })
    if (!res.ok) {
      const err = await res.json()
      return { success: false, error: err.detail || 'Invalid credentials.' }
    }
    const raw = await res.json()
    const { token } = raw
    const seller = normalize(raw.seller)
    localStorage.setItem('token', token)
    localStorage.setItem('role', 'seller')
    setSellerUser(seller)
    apiFetch('/seller/transactions').then(async r => {
      if (r.ok) setTransactions(normalize(await r.json()))
    })
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
    setTransactions([])
  }

  const signupBuyer = async (data) => {
    const res = await apiFetch('/auth/buyer/signup', { method: 'POST', body: data })
    const json = await res.json()
    if (!res.ok) throw new Error(json.detail || 'Signup failed')
    const { token, buyer } = normalize(json)
    localStorage.setItem('token', token)
    localStorage.setItem('role', 'buyer')
    setBuyerUser(buyer)
    return buyer
  }

  const loginBuyer = async (email, password) => {
    const res = await apiFetch('/auth/buyer/login', { method: 'POST', body: { email, password } })
    if (!res.ok) {
      const err = await res.json()
      return { success: false, error: err.detail || 'Invalid credentials.' }
    }
    const { token, buyer } = normalize(await res.json())
    localStorage.setItem('token', token)
    localStorage.setItem('role', 'buyer')
    setBuyerUser(buyer)
    return { success: true }
  }

  const logoutBuyer = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('role')
    setBuyerUser(null)
  }

  const signupSeller = async (formData) => {
    const res = await apiFetch('/auth/seller/signup', {
      method: 'POST',
      body: formData,
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.detail || 'Signup failed')
    return normalize(data)
  }

  // ── Public purchase ───────────────────────────────────────────────────────
  const purchasePuppy = async (puppyId, buyerDetails) => {
    const res = await apiFetch('/transactions', {
      method: 'POST',
      body: {
        puppy_id: puppyId,
        buyer_name: buyerDetails?.name ?? 'Anonymous',
        buyer_email: buyerDetails?.email ?? '',
      },
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
      body: puppyData,
    })
    await loadPuppies()
  }

  const delistPuppy = async (puppyId) => {
    await apiFetch(`/seller/puppies/${puppyId}`, { method: 'DELETE' })
    await loadPuppies()
  }

  const updateSellerDocuments = async (documents) => {
    const res = await apiFetch('/seller/documents', { method: 'PUT', body: documents })
    if (res.ok) {
      const saved = normalize(await res.json())
      setSellerUser(prev => ({ ...prev, documents: saved }))
    }
  }

  const updateSellerProfile = async (updates) => {
    const res = await apiFetch('/seller/profile', {
      method: 'PUT',
      body: updates,
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
      body: data,
    })
    const kennel = normalize(await res.json())
    await loadAdminData()
    return kennel
  }

  const adminEditKennel = async (kennelId, updates) => {
    await apiFetch(`/admin/kennels/${kennelId}`, {
      method: 'PUT',
      body: updates,
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
      body: data,
    })
    const seller = normalize(await res.json())
    await loadAdminData()
    return seller
  }

  const adminEditSeller = async (sellerId, updates) => {
    await apiFetch(`/admin/sellers/${sellerId}`, {
      method: 'PUT',
      body: updates,
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
    await apiFetch('/testimonials', {
      method: 'POST',
      body: data,
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
    await apiFetch(`/admin/transactions/${txnId}/mark-seller-paid`, { method: 'POST' })
    await loadAdminData()
  }

  const markCommissionPaid = async (txnId) => {
    await apiFetch(`/admin/transactions/${txnId}/mark-commission-paid`, { method: 'POST' })
    await loadAdminData()
  }

  // ── Admin — settings & legal ──────────────────────────────────────────────
  const updateAdminSettings = async (settings) => {
    const res = await apiFetch('/admin/settings', {
      method: 'PUT',
      body: settings,
    })
    if (res.ok) setAdminSettings(normalize(await res.json()))
  }

  const updateLegal = async (content) => {
    const res = await apiFetch('/admin/legal', {
      method: 'PUT',
      body: { content },
    })
    if (res.ok) { const d = normalize(await res.json()); setLegalContent(d.content) }
  }

  return (
    <AppContext.Provider value={{
      kennels, puppies, sellers, buyers, adminSettings, legalContent, transactions, testimonials, loadingPublic,
      loadPuppies,
      buyerUser, signupBuyer, loginBuyer, logoutBuyer,
      addTestimonial, removeTestimonial,
      adminUser, sellerUser,
      loginAdmin, loginSeller, logoutAdmin, logoutSeller,
      purchasePuppy, releasePayment, markSellerPaid, markCommissionPaid,
      approveSeller, approveKennel, rejectKennel,
      updateKennelCommission, addPuppy, delistPuppy,
      updateLegal, updateAdminSettings, signupSeller, updateSellerProfile, updateSellerDocuments,
      payMembership,
      loadAdminData,
      adminRemovePuppy, adminAddKennel, adminEditKennel, adminRemoveKennel,
      adminAddSeller, adminEditSeller, adminRemoveSeller,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export const useApp = () => useContext(AppContext)
