import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import afficheCafet from '../assets/affiche-cafet.jpeg'
import NewsSection from '../components/NewsSection'
import PollWidget from '../components/PollWidget'

export default function Home() {
  return (
    <div className="grid lg:grid-cols-3 lg:items-start gap-8">
      {/* Colonne principale : sondage puis actualités, empilés et indépendants
          de la hauteur du menu cafét. `contents` sur mobile pour que le cafét
          puisse s'intercaler entre les deux (ordre sondage → cafét → actualités) ;
          bloc normal sur desktop pour découpler les hauteurs des deux colonnes.
          PollWidget rend `null` s'il n'y a rien à afficher → pas de vide. */}
      <div className="contents lg:block lg:col-span-2 lg:space-y-8">
        <PollWidget className="order-1" />
        <div className="order-3">
          <NewsSection />
        </div>
      </div>

      {/* Menu cafét : colonne de droite, hauteur indépendante (desktop) ;
          accordéon repliable sur mobile, intercalé entre sondage et actualités. */}
      <aside className="order-2 lg:col-start-3">
        <CafetMenu />
      </aside>
    </div>
  )
}

/**
 * Menu de la cafétéria. Sur desktop : titre + affiche toujours visibles, sticky.
 * Sur mobile : accordéon replié par défaut (le titre sert de bouton déroulant)
 * pour ne pas reléguer les actualités trop bas.
 */
function CafetMenu() {
  const [open, setOpen] = useState(false)
  return (
    <div className="lg:sticky lg:top-8">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center justify-between w-full mb-4 text-left lg:pointer-events-none lg:cursor-default"
      >
        <h2 className="text-2xl font-semibold text-gray-900">
          Menu de la cafétéria
        </h2>
        <ChevronDown
          size={24}
          aria-hidden
          className={`text-gray-500 lg:hidden transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      <div className={`${open ? 'block' : 'hidden'} lg:block`}>
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
    </div>
  )
}
