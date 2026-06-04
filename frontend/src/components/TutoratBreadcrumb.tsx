import { ChevronRight } from 'lucide-react'
import type { TutoratNode } from '../lib/tutorat'

type Props = {
  /** Chemin courant (de la racine vers le node ouvert). */
  path: TutoratNode[]
  /** Naviguer vers un niveau : index dans `path`, ou -1 pour la racine. */
  onNavigate: (index: number) => void
}

/**
 * Fil d'Ariane de la taxonomie tutorat. Le chemin est fourni par le parent
 * (accumulé au fil de la navigation), donc aucune requête supplémentaire.
 */
export function TutoratBreadcrumb({ path, onNavigate }: Props) {
  return (
    <nav className="flex flex-wrap items-center gap-1 text-sm text-gray-600">
      <button
        type="button"
        onClick={() => onNavigate(-1)}
        className="font-medium hover:text-black focus:outline-none focus:underline disabled:text-black disabled:no-underline"
        disabled={path.length === 0}
      >
        Tutorat
      </button>
      {path.map((node, i) => {
        const isLast = i === path.length - 1
        return (
          <span key={node.id} className="flex items-center gap-1">
            <ChevronRight size={14} className="text-gray-400" aria-hidden />
            <button
              type="button"
              onClick={() => onNavigate(i)}
              className="hover:text-black focus:outline-none focus:underline disabled:text-black disabled:font-medium disabled:no-underline"
              disabled={isLast}
            >
              {node.name}
            </button>
          </span>
        )
      })}
    </nav>
  )
}
