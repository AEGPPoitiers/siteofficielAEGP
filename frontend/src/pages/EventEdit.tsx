import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router'
import { supabase } from '../lib/supabase'
import { uploadEventImage, removeEventImage } from '../lib/eventImage'
import {
  EventForm,
  type EventFormValues,
  type EventFormSubmitPayload,
} from '../components/EventForm'

type EventRow = {
  title: string
  description: string | null
  start_date: string
  end_date: string | null
  location: string | null
  external_link: string | null
  image_url: string | null
}

export default function EventEdit() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [initialValues, setInitialValues] = useState<EventFormValues | null>(
    null,
  )
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    supabase
      .from('events')
      .select(
        'title, description, start_date, end_date, location, external_link, image_url',
      )
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error || !data) {
          setNotFound(true)
        } else {
          const row = data as EventRow
          setInitialValues({
            title: row.title,
            description: row.description ?? '',
            start_date: row.start_date,
            end_date: row.end_date ?? '',
            location: row.location ?? '',
            external_link: row.external_link ?? '',
          })
          setCurrentImageUrl(row.image_url)
        }
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  async function handleSubmit({
    values,
    imageFile,
    removeImage,
  }: EventFormSubmitPayload) {
    if (!id) return { error: 'ID manquant.' }

    let newImageUrl: string | null | undefined = undefined
    let oldImageToDelete: string | null = null

    if (removeImage) {
      newImageUrl = null
      if (currentImageUrl) oldImageToDelete = currentImageUrl
    } else if (imageFile) {
      const { url, error: uploadError } = await uploadEventImage(imageFile)
      if (uploadError || !url) {
        return {
          error: `Impossible d'uploader l'image : ${uploadError ?? 'erreur inconnue'}`,
        }
      }
      newImageUrl = url
      if (currentImageUrl) oldImageToDelete = currentImageUrl
    }

    const payload: Record<string, unknown> = {
      title: values.title,
      description: values.description || null,
      start_date: values.start_date,
      end_date: values.end_date || null,
      location: values.location || null,
      external_link: values.external_link || null,
    }
    if (newImageUrl !== undefined) {
      payload.image_url = newImageUrl
    }

    const { error: updateError } = await supabase
      .from('events')
      .update(payload)
      .eq('id', id)

    if (updateError) {
      return { error: `Impossible de modifier l'événement : ${updateError.message}` }
    }

    if (oldImageToDelete) {
      const { error: removeError } = await removeEventImage(oldImageToDelete)
      if (removeError) {
        console.warn('[event-images] suppression échouée :', removeError)
      }
    }

    navigate(`/agenda/${id}`)
    return {}
  }

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Chargement…</div>
  }

  if (notFound || !initialValues) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Événement introuvable
        </h1>
        <Link to="/agenda" className="text-black underline">
          Retour à l'agenda
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <Link
        to={`/agenda/${id}`}
        className="text-sm text-gray-600 hover:text-black inline-flex items-center gap-1"
      >
        ← Retour au détail
      </Link>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">
          Modifier l'événement
        </h1>
        <p className="text-sm text-gray-600 mb-6">
          Mets à jour les détails de l'événement.
        </p>
        <EventForm
          initialValues={initialValues}
          currentImageUrl={currentImageUrl}
          onSubmit={handleSubmit}
          submitLabel="Enregistrer les modifications"
        />
      </div>
    </div>
  )
}
