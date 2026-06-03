import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router'
import { Calendar, dateFnsLocalizer } from 'react-big-calendar'
import { format, parse, startOfWeek, getDay } from 'date-fns'
import { fr } from 'date-fns/locale'
import { supabase } from '../lib/supabase'
import 'react-big-calendar/lib/css/react-big-calendar.css'

const locales = { fr: fr }

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date: Date) => startOfWeek(date, { weekStartsOn: 1 }),
  getDay,
  locales,
})

type EventRow = {
  id: string
  title: string
  start_date: string
}

type CalendarEvent = {
  id: string
  title: string
  start: Date
  end: Date
}

const messages = {
  allDay: 'Toute la journée',
  previous: 'Précédent',
  next: 'Suivant',
  today: "Aujourd'hui",
  month: 'Mois',
  week: 'Semaine',
  day: 'Jour',
  agenda: 'Agenda',
  date: 'Date',
  time: 'Heure',
  event: 'Événement',
  noEventsInRange: 'Aucun événement sur cette période.',
  showMore: (total: number) => `+ ${total} autres`,
}

export default function Agenda() {
  const navigate = useNavigate()
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentDate, setCurrentDate] = useState(new Date())

  useEffect(() => {
    let cancelled = false
    supabase
      .from('events')
      .select('id, title, start_date')
      .order('start_date')
      .then(({ data, error: fetchError }) => {
        if (cancelled) return
        if (fetchError) {
          setError(
            `Impossible de charger les événements : ${fetchError.message}`,
          )
        } else if (data) {
          const mapped = (data as EventRow[]).map((e) => ({
            id: e.id,
            title: e.title,
            start: new Date(e.start_date),
            end: new Date(e.start_date),
          }))
          setEvents(mapped)
        }
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handleSelectEvent = useCallback(
    (event: CalendarEvent) => {
      navigate(`/agenda/${event.id}`)
    },
    [navigate],
  )

  const handleSelectSlot = useCallback(() => {
    // Hook préparé pour le chantier C : ouvrira la création d'événement
    // pré-remplie avec la date sélectionnée si l'utilisateur est BDE.
  }, [])

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Agenda</h1>
        <p className="text-gray-600 mt-1">
          Les événements du BDE, passés et à venir.
        </p>
      </div>

      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-500">Chargement…</div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <Calendar
            localizer={localizer}
            events={events}
            culture="fr"
            messages={messages}
            views={['month']}
            view="month"
            onView={() => {}}
            date={currentDate}
            onNavigate={(newDate) => setCurrentDate(newDate)}
            onSelectEvent={handleSelectEvent}
            onSelectSlot={handleSelectSlot}
            selectable
            style={{ height: 600 }}
          />
        </div>
      )}
    </div>
  )
}
