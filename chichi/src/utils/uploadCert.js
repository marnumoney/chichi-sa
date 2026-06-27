const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export async function uploadCert(file) {
  const fd = new FormData()
  fd.append('file', file)
  const res = await fetch(`${API}/certs/upload`, { method: 'POST', body: fd })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || 'Upload failed')
  }
  const { url } = await res.json()
  return `${API}${url}`
}
