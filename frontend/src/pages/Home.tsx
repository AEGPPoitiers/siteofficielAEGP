import { Link } from 'react-router'
import afficheCafet from '../assets/affiche-cafet.jpeg'

export default function Home() {
  return (
    <div className="space-y-8">
      <section className="text-center py-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Bienvenue sur le site officiel de l'AEGP
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Retrouvez les évènements à venir, accédez aux ressources de tutorat,
          partagez vos idées pour améliorer l'AEGP.
        </p>
      </section>

      <section className="grid md:grid-cols-3 gap-6">
        <Link
          to="/agenda"
          className="block p-6 bg-white rounded-lg border border-gray-200 hover:border-black hover:shadow-md transition-all"
        >
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">Agenda</h2>
          <p className="text-gray-600">Tous les évènements à venir !</p>
        </Link>

        <Link
          to="/boiteaidee"
          className="block p-6 bg-white rounded-lg border border-gray-200 hover:border-black hover:shadow-md transition-all"
        >
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">
            Boîte à idées
          </h2>
          <p className="text-gray-600">Partagez vos idées pour l'AEGP !</p>
        </Link>

        <Link
          to="/tutorat"
          className="block p-6 bg-white rounded-lg border border-gray-200 hover:border-black hover:shadow-md transition-all"
        >
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">Tutorat</h2>
          <p className="text-gray-600">Cours, TD, TP, et annales.</p>
        </Link>
      </section>

      <section className="text-center">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">
          Menu de la cafétéria
        </h2>
        <a
          href={afficheCafet}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block"
        >
          <img
            src={afficheCafet}
            alt="Menu de la cafétéria AEGP"
            className="mx-auto w-full max-w-md rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
          />
        </a>
        <p className="text-sm text-gray-500 mt-2">Cliquez pour agrandir</p>
      </section>
    </div>
  )
}
