import { useEffect, useState, type ReactNode } from 'react'
import { Folder, ChevronRight, Search } from 'lucide-react'
import { supabase } from '../lib/supabase'
import {
  DOC_TYPES,
  DOC_TYPE_LABELS,
  type TutoratNode,
  type TutoratDocument,
  type DocType,
} from '../lib/tutorat'
import { FieldError } from '../components/ui/FieldError'
import { TutoratBreadcrumb } from '../components/TutoratBreadcrumb'
import { DocumentCard } from '../components/DocumentCard'

/**
 * Vue étudiant du tutorat : navigation dans la taxonomie (drill-down) puis
 * consultation des documents d'une matière (recherche + filtre par type,
 * téléchargement, aperçu PDF).
 */
export default function TutoratBrowse() {
  const [nodes, setNodes] = useState<TutoratNode[]>([])
  const [loadingNodes, setLoadingNodes] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [path, setPath] = useState<TutoratNode[]>([])

  // Charge tout l'arbre de taxonomie en une fois (quelques centaines de nodes max).
  useEffect(() => {
    let cancelled = false
    supabase
      .from('tutorat_nodes')
      .select('*')
      .order('position', { ascending: true })
      .then(({ data, error: fetchError }) => {
        if (cancelled) return
        if (fetchError) {
          setError(`Impossible de charger le tutorat : ${fetchError.message}`)
        } else if (data) {
          setNodes(data as TutoratNode[])
        }
        setLoadingNodes(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const current = path[path.length - 1] ?? null
  const children = nodes
    .filter((n) => (n.parent_id ?? null) === (current?.id ?? null))
    .sort((a, b) => a.position - b.position)

  function enter(node: TutoratNode) {
    setPath((p) => [...p, node])
  }

  function navigateTo(index: number) {
    setPath((p) => (index < 0 ? [] : p.slice(0, index + 1)))
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Tutorat</h1>
        <p className="text-gray-600 mt-1">
          Documents de cours partagés par le BDE.
        </p>
      </div>

      {error && <FieldError>{error}</FieldError>}

      <TutoratBreadcrumb path={path} onNavigate={navigateTo} />

      {loadingNodes ? (
        <div className="text-center py-12 text-gray-500">Chargement…</div>
      ) : children.length === 0 && !current ? (
        <div className="text-center py-12 text-gray-500">
          Rien à afficher pour l'instant.
        </div>
      ) : (
        <div className="space-y-8">
          {children.length > 0 && <NodeList nodes={children} onEnter={enter} />}
          {current && (
            // key = remonte le composant (et réinitialise son état) à chaque dossier
            <DocumentList
              key={current.id}
              node={current}
              hasFolders={children.length > 0}
              onError={setError}
            />
          )}
        </div>
      )}
    </div>
  )
}

// ----------------------------------------------------------------------------
// Liste de dossiers (promos / options / matières)
// ----------------------------------------------------------------------------

function NodeList({
  nodes,
  onEnter,
}: {
  nodes: TutoratNode[]
  onEnter: (node: TutoratNode) => void
}) {
  if (nodes.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        Rien à afficher pour l'instant.
      </div>
    )
  }
  return (
    <div className="space-y-2">
      {nodes.map((node) => (
        <button
          key={node.id}
          type="button"
          onClick={() => onEnter(node)}
          className="flex items-center justify-between gap-3 bg-white rounded-lg shadow-sm border border-gray-200 p-4 text-left hover:bg-gray-50 hover:border-gray-300 transition-colors focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2"
        >
          <span className="flex items-center gap-3 min-w-0">
            <Folder size={20} className="text-gray-400 shrink-0" aria-hidden />
            <span className="font-medium text-gray-900 truncate">
              {node.name}
            </span>
          </span>
          <ChevronRight
            size={18}
            className="text-gray-400 shrink-0"
            aria-hidden
          />
        </button>
      ))}
    </div>
  )
}

// ----------------------------------------------------------------------------
// Liste des documents d'une matière (recherche + filtre par type)
// ----------------------------------------------------------------------------

function DocumentList({
  node,
  hasFolders,
  onError,
}: {
  node: TutoratNode
  /** Le dossier courant contient aussi des sous-dossiers (affichés au-dessus). */
  hasFolders: boolean
  onError: (msg: string) => void
}) {
  // État initial = celui d'un dossier fraîchement ouvert. Le composant est
  // remonté (key=node.id par le parent) à chaque changement de dossier,
  // donc pas besoin de réinitialiser manuellement.
  const [documents, setDocuments] = useState<TutoratDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<DocType | 'all'>('all')

  useEffect(() => {
    let cancelled = false
    supabase
      .from('tutorat_documents')
      .select('*')
      .eq('node_id', node.id)
      .order('created_at', { ascending: false })
      .then(({ data, error: fetchError }) => {
        if (cancelled) return
        if (fetchError) {
          onError(`Impossible de charger les documents : ${fetchError.message}`)
        } else if (data) {
          setDocuments(data as TutoratDocument[])
        }
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [node.id, onError])

  const filtered = documents
    .filter((d) => typeFilter === 'all' || d.doc_type === typeFilter)
    .filter((d) =>
      search.trim() === ''
        ? true
        : d.title.toLowerCase().includes(search.trim().toLowerCase()),
    )

  if (loading) {
    // Pas de gros spinner si des dossiers sont déjà affichés au-dessus.
    return hasFolders ? null : (
      <div className="text-center py-12 text-gray-500">Chargement…</div>
    )
  }

  if (documents.length === 0) {
    // Dossier avec des sous-dossiers mais sans fichier : rien à signaler.
    if (hasFolders) return null
    return (
      <div className="text-center py-12 text-gray-500">
        Aucun document dans « {node.name} » pour l'instant.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {hasFolders && (
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Documents
        </h2>
      )}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            aria-hidden
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un document…"
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-black"
            aria-label="Rechercher un document"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <FilterTab
          active={typeFilter === 'all'}
          onClick={() => setTypeFilter('all')}
        >
          Tous
        </FilterTab>
        {DOC_TYPES.map((t) => (
          <FilterTab
            key={t}
            active={typeFilter === t}
            onClick={() => setTypeFilter(t)}
          >
            {DOC_TYPE_LABELS[t]}
          </FilterTab>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          Aucun document ne correspond.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((doc) => (
            <DocumentCard key={doc.id} doc={doc} />
          ))}
        </div>
      )}
    </div>
  )
}

function FilterTab({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 ${
        active
          ? 'bg-black text-white'
          : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
      }`}
    >
      {children}
    </button>
  )
}
