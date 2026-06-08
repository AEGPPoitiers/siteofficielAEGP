import afficheCafet from '../assets/affiche-cafet.jpeg'
import NewsSection from '../components/NewsSection'

export default function Home() {
  return (
    <div className="grid lg:grid-cols-3 gap-8">
      {/* Actualités : colonne principale (à gauche sur grand écran). */}
      <div className="lg:col-span-2 order-2 lg:order-1">
        <NewsSection />
      </div>

      {/* Affiche cafét : barre latérale qui reste visible au scroll.
          Sur mobile, elle passe en premier (order-1) pour voir le menu d'emblée. */}
      <aside className="order-1 lg:order-2">
        <div className="lg:sticky lg:top-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            Menu de la cafétéria
          </h2>
          <a
            href={afficheCafet}
            target="_blank"
            rel="noopener noreferrer"
            className="block"
          >
            <img
              src={afficheCafet}
              alt="Menu de la cafétéria AEGP"
              className="w-full rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
            />
          </a>
          <p className="text-sm text-gray-500 mt-2">Cliquez pour agrandir</p>
        </div>
      </aside>
    </div>
  )
}
