import { Link } from 'react-router'

export default function Home() {
  return (
    <div className="space-y-8">
      <section className="text-center py-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Bienvenue sur le site de l'AEGP
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Le site officiel du BDE : retrouvez les évènements à venir et accédez
          aux ressources de tutorat partagées par les étudiants.
        </p>
      </section>

      <section className="grid md:grid-cols-2 gap-6">
        <Link
          to="/agenda"
          className="block p-6 bg-white rounded-lg border border-gray-200 hover:border-indigo-400 hover:shadow-md transition-all"
        >
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">
            📅 Agenda
          </h2>
          <p className="text-gray-600">
            Tous les évènements organisés par le BDE — soirées, intégrations,
            galas, séminaires.
          </p>
        </Link>

        <Link
          to="/tutorat"
          className="block p-6 bg-white rounded-lg border border-gray-200 hover:border-indigo-400 hover:shadow-md transition-all"
        >
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">
            📚 Tutorat
          </h2>
          <p className="text-gray-600">
            Cours, TD, TP et examens partagés par les étudiants
            (connexion requise).
          </p>
        </Link>
      </section>
    </div>
  )
}
