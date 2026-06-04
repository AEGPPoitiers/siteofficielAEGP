import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Textarea } from './ui/Textarea'
import { FieldError } from './ui/FieldError'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import {
  DOC_TYPES,
  DOC_TYPE_LABELS,
  type DocType,
  type TutoratNode,
  type TutoratDocument,
} from '../lib/tutorat'
import { presignUpload, uploadToB2, deleteObject } from '../lib/tutoratFiles'

const TITLE_MAX = 200
const DESCRIPTION_MAX = 5000
const FILE_MAX_BYTES = 50 * 1024 * 1024 // 50 Mo

type Props = {
  matiere: TutoratNode
  /** Document à modifier (sinon création). */
  existing?: TutoratDocument | null
  onDone: () => void
  onCancel: () => void
}

/**
 * Formulaire d'ajout / modification d'un document (réservé BDE).
 * À l'ajout, le fichier est obligatoire. À la modification, le fichier est
 * optionnel : sans nouveau fichier, seules les métadonnées changent.
 */
export function DocumentForm({ matiere, existing, onDone, onCancel }: Props) {
  const { user } = useAuth()
  const isEdit = !!existing

  const [title, setTitle] = useState(existing?.title ?? '')
  const [description, setDescription] = useState(existing?.description ?? '')
  const [docType, setDocType] = useState<DocType>(existing?.doc_type ?? 'cm')
  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0]
    e.target.value = ''
    if (!picked) return
    if (picked.size > FILE_MAX_BYTES) {
      setError('Le fichier ne doit pas dépasser 50 Mo.')
      return
    }
    setError(null)
    setFile(picked)
  }

  /** Upload du fichier vers B2 → renvoie les champs fichier de la row. */
  async function uploadFile(f: File) {
    const contentType = f.type || 'application/octet-stream'
    const { upload_url, file_key } = await presignUpload({
      node_id: matiere.id,
      file_name: f.name,
      content_type: contentType,
    })
    await uploadToB2(upload_url, f, contentType)
    return {
      file_key,
      file_name: f.name,
      file_size: f.size,
      content_type: contentType,
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    const t = title.trim()
    const d = description.trim()
    if (t.length === 0) {
      setError('Le titre est obligatoire.')
      return
    }
    if (t.length > TITLE_MAX) {
      setError(`Le titre ne doit pas dépasser ${TITLE_MAX} caractères.`)
      return
    }
    if (d.length > DESCRIPTION_MAX) {
      setError(`La description ne doit pas dépasser ${DESCRIPTION_MAX} caractères.`)
      return
    }
    if (!isEdit && !file) {
      setError('Un fichier est obligatoire.')
      return
    }
    if (!user) {
      setError('Session expirée, reconnecte-toi.')
      return
    }

    setSubmitting(true)
    try {
      const meta = { title: t, description: d || null, doc_type: docType }

      if (!isEdit) {
        // Création : upload puis insertion (cleanup B2 best-effort si l'insert échoue).
        const fileFields = await uploadFile(file as File)
        const { error: insertError } = await supabase
          .from('tutorat_documents')
          .insert({ node_id: matiere.id, ...meta, ...fileFields, uploaded_by: user.id })
        if (insertError) {
          await deleteObject(fileFields.file_key).catch(() => {})
          throw new Error(insertError.message)
        }
      } else if (file) {
        // Modification AVEC nouveau fichier : upload, update, puis suppression de l'ancien.
        const fileFields = await uploadFile(file)
        const { error: updateError } = await supabase
          .from('tutorat_documents')
          .update({ ...meta, ...fileFields })
          .eq('id', existing!.id)
        if (updateError) {
          await deleteObject(fileFields.file_key).catch(() => {})
          throw new Error(updateError.message)
        }
        await deleteObject(existing!.file_key).catch(() => {})
      } else {
        // Modification des métadonnées seules.
        const { error: updateError } = await supabase
          .from('tutorat_documents')
          .update(meta)
          .eq('id', existing!.id)
        if (updateError) throw new Error(updateError.message)
      }

      onDone()
    } catch (err) {
      setError(
        err instanceof Error
          ? `Échec de l'enregistrement : ${err.message}`
          : "Échec de l'enregistrement.",
      )
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="bg-white rounded-lg shadow-sm border border-gray-200 p-4"
    >
      <h3 className="font-semibold text-gray-900 mb-3">
        {isEdit ? 'Modifier le document' : 'Ajouter un document'}
      </h3>

      <FieldError>{error}</FieldError>

      <Input
        id="doc-title"
        label="Titre"
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={TITLE_MAX}
        disabled={submitting}
        required
      />

      <div className="mb-4">
        <label
          htmlFor="doc-type"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Type
        </label>
        <select
          id="doc-type"
          value={docType}
          onChange={(e) => setDocType(e.target.value as DocType)}
          disabled={submitting}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-black bg-white"
        >
          {DOC_TYPES.map((t) => (
            <option key={t} value={t}>
              {DOC_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Fichier{isEdit ? ' (laisser vide pour conserver l’actuel)' : ''}
        </label>
        <p className="text-xs text-gray-500 mb-2">Tous formats, 50 Mo max.</p>
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileChange}
          disabled={submitting}
          className="hidden"
          aria-hidden="true"
        />
        <div className="flex items-center gap-3 flex-wrap">
          <Button
            type="button"
            variant="secondary"
            onClick={() => fileInputRef.current?.click()}
            disabled={submitting}
          >
            {file ? 'Changer le fichier' : 'Choisir un fichier'}
          </Button>
          <span className="text-sm text-gray-600 truncate">
            {file
              ? file.name
              : isEdit
                ? existing?.file_name
                : 'Aucun fichier sélectionné'}
          </span>
        </div>
      </div>

      <Textarea
        id="doc-description"
        label="Description (optionnel)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        maxLength={DESCRIPTION_MAX}
        disabled={submitting}
        rows={4}
      />

      <div className="flex gap-2">
        <Button type="submit" variant="primary" loading={submitting}>
          {submitting
            ? 'Enregistrement…'
            : isEdit
              ? 'Enregistrer'
              : 'Ajouter'}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={submitting}
        >
          Annuler
        </Button>
      </div>
    </form>
  )
}
