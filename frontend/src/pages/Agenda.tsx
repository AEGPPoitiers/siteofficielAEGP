export default function Agenda() {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold text-gray-900">Agenda</h1>
      <p className="text-gray-600">
        La vue calendrier des évènements du BDE arrivera ici. (Lib calendrier à
        choisir : FullCalendar, react-big-calendar, ou composant maison.)
      </p>
      <div className="p-12 bg-white rounded-lg border-2 border-dashed border-gray-300 text-center text-gray-400">
        Calendrier à venir
      </div>
    </div>
  )
}
