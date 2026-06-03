import { useNavigate, useSearchParams, Link } from 'react-router'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { EventForm, type EventFormValues } from '../components/EventForm'

export default function EventNew() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const dateParam = searchParams.get('date')

  const initialValues = dateParam ? { start_date: dateParam } : undefined

  async function handleSubmit(values: EventFormValues) {
    if (!user) return { error: 'Vous devez être connecté.' }

    const payload = {
      title: values.title,
      description: values.description || null,
      start_date: values.start_date,
      location: values.location || null,
      external_link: values.external_link || null,
      created_by: user.id,
    }

    const { data, error } = await supabase
      .from('events')
      .insert(payload)
      .select('id')
      .single()

    if (error || !data) {
      return {
        error: `Impossible de créer l'événement : ${error?.message ?? 'erreur inconnue'}`,
      }
    }

    navigate(`/agenda/${data.id}`)
    return {}
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <Link
        to="/agenda"
        className="text-sm text-gray-600 hover:text-black inline-flex items-center gap-1"
      >
        ← Retour à l'agenda
      </Link>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">
          Nouvel événement
        </h1>
        <p className="text-sm text-gray-600 mb-6">
          Saisis les détails de l'événement.
        </p>
        <EventForm
          initialValues={initialValues}
          onSubmit={handleSubmit}
          submitLabel="Créer l'événement"
        />
      </div>
    </div>
  )
}
