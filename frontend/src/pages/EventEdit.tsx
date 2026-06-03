import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router'
import { supabase } from '../lib/supabase'
import { EventForm, type EventFormValues } from '../components/EventForm'

type EventRow = {
  title: string
  description: string | null
  start_date: string
  location: string | null
  external_link: string | null
}

export default function EventEdit() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [initialValues, setInitialValues] = useState<EventFormValues | null>(
    null,
  )
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    supabase
      .from('events')
      .select('title, description, start_date, location, external_link')
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
            location: row.location ?? '',
            external_link: row.external_link ?? '',
          })
        }
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  async function handleSubmit(values: EventFormValues) {
    if (!id) return { error: 'ID manquant.' }

    const payload = {
      title: values.title,
      description: values.description || null,
      start_date: values.start_date,
      location: values.location || null,
      external_link: values.external_link || null,
    }

    const { error } = await supabase.from('events').update(payload).eq('id', id)

    if (error) {
      return { error: `Impossible de modifier l'événement : ${error.message}` }
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
          onSubmit={handleSubmit}
          submitLabel="Enregistrer les modifications"
        />
      </div>
    </div>
  )
}
