const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export async function uploadCert(file) {
  const fd = new FormData()
  fd.append('file', file)
  const res = await fetch(`${API}/upload-doc`, {
    method: 'POST',
    body: fd,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || 'Document upload failed')
  }
  const data = await res.json()
  return `${API}${data.url}`
}
