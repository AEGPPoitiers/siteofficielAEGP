import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { supabase } from '../lib/supabase'
import { removeEventImage } from '../lib/eventImage'
import { useIsBdeMember } from '../lib/useIsBdeMember'
import { useConfirm } from '../contexts/ConfirmContext'

type Event = {
  id: string
  title: string
  description: string | null
  start_date: string
  end_date: string | null
  color: string | null
  location: string | null
  image_url: string | null
  external_link: string | null
}

export default function EventDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { isBde } = useIsBdeMember()
  const confirm = useConfirm()
  const [event, setEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

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

  async function handleDelete() {
    if (!event) return
    const ok = await confirm({
      title: "Supprimer l'événement",
      message: `Supprimer « ${event.title} » ? Cette action est irréversible.`,
      confirmLabel: 'Supprimer',
      danger: true,
    })
    if (!ok) return

    setDeleting(true)
    setDeleteError(null)
    const { error } = await supabase.from('events').delete().eq('id', event.id)

    if (error) {
      setDeleting(false)
      setDeleteError(`Impossible de supprimer : ${error.message}`)
      return
    }

    if (event.image_url) {
      const { error: removeError } = await removeEventImage(event.image_url)
      if (removeError) {
        console.warn('[event-images] suppression échouée :', removeError)
      }
    }

    navigate('/agenda')
  }

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

  const start = new Date(event.start_date)
  const startLabel = format(start, "dd/MM/yyyy 'à' HH:mm", { locale: fr })
  let dateLabel = startLabel
  if (event.end_date) {
    const end = new Date(event.end_date)
    const sameDay =
      format(start, 'yyyy-MM-dd') === format(end, 'yyyy-MM-dd')
    dateLabel = sameDay
      ? `${format(start, "dd/MM/yyyy 'de' HH:mm", { locale: fr })} à ${format(end, 'HH:mm', { locale: fr })}`
      : `${startLabel} → ${format(end, "dd/MM/yyyy 'à' HH:mm", { locale: fr })}`
  }

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
          <img src={event.image_url} alt="" className="w-full rounded-lg" />
        )}

        <div>
          <div className="flex items-center gap-2">
            {event.color && (
              <span
                className="inline-block w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: event.color }}
                aria-hidden
              />
            )}
            <h1 className="text-3xl font-bold text-gray-900">{event.title}</h1>
          </div>
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

        {isBde && (
          <div className="pt-4 border-t border-gray-200 space-y-3">
            {deleteError && (
              <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                {deleteError}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Link
                to={`/agenda/${event.id}/edit`}
                className="inline-block bg-white border border-gray-300 text-black px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-50"
              >
                Modifier
              </Link>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="inline-block bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleting ? 'Suppression…' : 'Supprimer'}
              </button>
            </div>
          </div>
        )}
      </div>
    </article>
  )
}
