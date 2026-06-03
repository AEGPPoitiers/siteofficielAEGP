import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { supabase } from '../lib/supabase'

type Event = {
  id: string
  title: string
  description: string | null
  start_date: string
  location: string | null
  image_url: string | null
  external_link: string | null
}

export default function EventDetail() {
  const { id } = useParams<{ id: string }>()
  const [event, setEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error || !data) {
          setNotFound(true)
        } else {
          setEvent(data as Event)
        }
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Chargement…</div>
  }

  if (notFound || !event) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Événement introuvable
        </h1>
        <p className="text-gray-600 mb-6">
          Cet événement n'existe pas ou a été supprimé.
        </p>
        <Link to="/agenda" className="text-black underline">
          Retour à l'agenda
        </Link>
      </div>
    )
  }

  const dateLabel = format(
    new Date(event.start_date),
    "EEEE d MMMM yyyy 'à' HH:mm",
    { locale: fr },
  )

  return (
    <article className="max-w-2xl mx-auto space-y-4">
      <Link
        to="/agenda"
        className="text-sm text-gray-600 hover:text-black inline-flex items-center gap-1"
      >
        ← Retour à l'agenda
      </Link>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-6">
        {event.image_url && (
          <img
            src={event.image_url}
            alt=""
            className="w-full rounded-lg"
          />
        )}

        <div>
          <h1 className="text-3xl font-bold text-gray-900">{event.title}</h1>
          <p className="text-gray-600 mt-2 first-letter:uppercase">
            {dateLabel}
          </p>
          {event.location && (
            <p className="text-gray-600 mt-1">{event.location}</p>
          )}
        </div>

        {event.description && (
          <div className="text-gray-800 whitespace-pre-wrap leading-relaxed">
            {event.description}
          </div>
        )}

        {event.external_link && (
          <div>
            <a
              href={event.external_link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-black text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-800"
            >
              Plus d'informations
            </a>
          </div>
        )}
      </div>
    </article>
  )
}
