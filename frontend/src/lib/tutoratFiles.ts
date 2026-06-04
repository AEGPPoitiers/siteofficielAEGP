import { apiGet, apiPost, apiDelete } from './api'

/**
 * Helpers pour les fichiers de documents tutorat stockés dans Backblaze B2
 * (bucket privé). Les octets ne sont jamais publics : on demande au backend
 * FastAPI une URL signée à durée de vie courte pour télécharger, prévisualiser
 * ou uploader.
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

// --- Écriture (réservé BDE côté backend) -----------------------------------

type PresignUpload = { upload_url: string; file_key: string; expires_in: number }

/** Demande au backend une URL signée d'upload (la file_key est générée serveur). */
export async function presignUpload(input: {
  node_id: string
  file_name: string
  content_type: string
}): Promise<PresignUpload> {
  return apiPost<PresignUpload>('/tutorat/presign-upload', input)
}

/**
 * Envoie le fichier directement à B2 via l'URL signée (PUT). Le `Content-Type`
 * DOIT être identique à celui passé au presign, sinon B2 rejette la signature.
 */
export async function uploadToB2(
  uploadUrl: string,
  file: File,
  contentType: string,
): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: file,
  })
  if (!res.ok) {
    throw new Error(`Échec de l'envoi du fichier vers le stockage (${res.status})`)
  }
}

/** Supprime un objet B2 (cleanup après suppression d'une row, réservé BDE). */
export async function deleteObject(fileKey: string): Promise<void> {
  await apiDelete(`/tutorat/object?key=${encodeURIComponent(fileKey)}`)
}
