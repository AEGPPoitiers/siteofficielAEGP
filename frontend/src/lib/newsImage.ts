import { supabase } from './supabase'

const BUCKET = 'news-images'

function getFileExtension(filename: string): string {
  const dot = filename.lastIndexOf('.')
  if (dot === -1 || dot === filename.length - 1) return 'jpg'
  return filename.slice(dot + 1).toLowerCase()
}

function extractStoragePath(publicUrl: string): string | null {
  const marker = `/${BUCKET}/`
  const idx = publicUrl.indexOf(marker)
  if (idx === -1) return null
  return publicUrl.slice(idx + marker.length)
}

export async function uploadNewsImage(
  file: File,
): Promise<{ url?: string; error?: string }> {
  const path = `${crypto.randomUUID()}.${getFileExtension(file.name)}`
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    })
  if (uploadError) {
    return { error: uploadError.message }
  }
  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return { url: publicUrl }
}

export async function removeNewsImage(
  publicUrl: string,
): Promise<{ error?: string }> {
  const path = extractStoragePath(publicUrl)
  if (!path) {
    return { error: `Path introuvable dans l'URL : ${publicUrl}` }
  }
  const { data, error } = await supabase.storage.from(BUCKET).remove([path])
  if (error) {
    return { error: error.message }
  }
  if (!data || data.length === 0) {
    return {
      error: `Aucun fichier supprimé pour path="${path}" (RLS bloque silencieusement ou fichier introuvable)`,
    }
  }
  return {}
}
