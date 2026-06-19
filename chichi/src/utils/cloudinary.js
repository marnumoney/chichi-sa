const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'dzq8vzby8'
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'Chihuahua south africa'

/**
 * Upload a single File to Cloudinary using an unsigned upload preset.
 * Returns the secure CDN URL on success, throws on failure.
 */
export async function uploadImage(file) {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('upload_preset', UPLOAD_PRESET)
  fd.append('folder', 'chichi-puppies')

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
    method: 'POST',
    body: fd,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || 'Image upload failed')
  }
  const data = await res.json()
  return data.secure_url
}

/**
 * Upload multiple files concurrently. Returns array of secure URLs.
 * Any individual failure rejects the whole promise.
 */
export async function uploadImages(files) {
  return Promise.all(Array.from(files).map(uploadImage))
}

/**
 * Upload any file type (image, PDF, etc.) using auto resource type.
 * Use this for documents, kennel certs, etc.
 */
export async function uploadFile(file) {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('upload_preset', UPLOAD_PRESET)
  fd.append('folder', 'chichi-docs')

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`, {
    method: 'POST',
    body: fd,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || 'File upload failed')
  }
  const data = await res.json()
  return data.secure_url
}
