import { createClient } from '@supabase/supabase-js'

let _supabase = null
function getClient() {
  if (!_supabase) _supabase = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY
  )
  return _supabase
}

const BUCKET = 'chichi'

export async function uploadCert(file) {
  const ext = file.name.split('.').pop() || 'pdf'
  const path = `docs/${crypto.randomUUID()}.${ext}`
  const supabase = getClient()
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '31536000',
    upsert: false,
  })
  if (error) throw new Error(error.message)
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}
