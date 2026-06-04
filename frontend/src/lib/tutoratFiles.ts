import { apiGet } from './api'

/**
 * Helpers pour les fichiers de documents tutorat stockés dans Backblaze B2
 * (bucket privé). Les octets ne sont jamais publics : on demande au backend
 * FastAPI une URL signée à durée de vie courte pour télécharger ou prévisualiser.
 *
 * Les fonctions d'upload/suppression (réservées BDE) seront ajoutées avec la
 * partie admin.
 */

type SignedUrl = { url: string; expires_in: number }

type DocumentFile = {
  file_key: string
  file_name: string
  content_type?: string | null
}

/** URL signée forçant le téléchargement (Content-Disposition: attachment). */
export async function getDownloadUrl(doc: DocumentFile): Promise<string> {
  const params = new URLSearchParams({
    key: doc.file_key,
    disposition: 'attachment',
    file_name: doc.file_name,
  })
  const { url } = await apiGet<SignedUrl>(
    `/tutorat/download-url?${params.toString()}`,
  )
  return url
}

/** URL signée pour un aperçu inline (PDF lu dans le navigateur). */
export async function getPreviewUrl(doc: DocumentFile): Promise<string> {
  const params = new URLSearchParams({
    key: doc.file_key,
    disposition: 'inline',
    file_name: doc.file_name,
  })
  if (doc.content_type) params.set('content_type', doc.content_type)
  const { url } = await apiGet<SignedUrl>(
    `/tutorat/download-url?${params.toString()}`,
  )
  return url
}
