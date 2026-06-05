import { useEffect, useState, useCallback } from 'react'
import { useNavigate, Link } from 'react-router'
import { Calendar, dateFnsLocalizer, type View } from 'react-big-calendar'
import { format, parse, startOfWeek, getDay } from 'date-fns'
import { fr } from 'date-fns/locale'
import { supabase } from '../lib/supabase'
import { useIsBdeMember } from '../lib/useIsBdeMember'
import 'react-big-calendar/lib/css/react-big-calendar.css'

const locales = { fr: fr }

// Vues Semaine/Jour : ouvrir la grille horaire vers 7 h (sinon elle démarre à
// minuit, plage vide). Référence stable au niveau module (l'heure du jour importe
// peu, seule l'heure de la journée est utilisée par react-big-calendar).
const SCROLL_TO_TIME = new Date(1970, 0, 1, 7, 0, 0)

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
  end_date: string | null
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
  const { isBde } = useIsBdeMember()
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState<View>('month')

  useEffect(() => {
    let cancelled = false
    supabase
      .from('events')
      .select('id, title, start_date, end_date')
      .order('start_date')
      .then(({ data, error: fetchError }) => {
        if (cancelled) return
        if (fetchError) {
          setError(
            `Impossible de charger les événements : ${fetchError.message}`,
          )
        } else if (data) {
          const mapped = (data as EventRow[]).map((e) => {
            const start = new Date(e.start_date)
            return {
              id: e.id,
              title: e.title,
              start,
              // Fin réelle si saisie ; sinon 1 h par défaut, uniquement pour que
              // l'événement reste visible/cliquable dans la grille horaire (vue
              // Semaine). Sans impact sur la vue Mois.
              end: e.end_date
                ? new Date(e.end_date)
                : new Date(start.getTime() + 60 * 60 * 1000),
            }
          })
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

  const handleSelectSlot = useCallback(
    (slotInfo: { start: Date }) => {
      if (!isBde) return
      const dateIso = slotInfo.start.toISOString()
      navigate(`/agenda/new?date=${encodeURIComponent(dateIso)}`)
    },
    [isBde, navigate],
  )

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Agenda</h1>
          <p className="text-gray-600 mt-1">
            Les événements du BDE, passés et à venir.
          </p>
        </div>
        {isBde && (
          <Link
            to="/agenda/new"
            className="inline-block bg-black text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-800"
          >
            + Nouvel événement
          </Link>
        )}
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
            views={['month', 'week']}
            view={view}
            onView={setView}
            scrollToTime={SCROLL_TO_TIME}
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
