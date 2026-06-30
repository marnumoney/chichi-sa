const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export async function uploadImage(file) {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${API}/images/upload`, { method: 'POST', body: form })
  if (!res.ok) {
    const msg = await res.text().catch(() => res.status)
    throw new Error(`Image upload failed (${res.status}): ${msg}`)
  }
  const { url } = await res.json()
  return `${API}${url}`
}

export async function uploadImages(files) {
  return Promise.all(Array.from(files).map(uploadImage))
}
