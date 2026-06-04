import { useEffect, useState, type ReactNode } from 'react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  Folder,
  FileText,
  Download,
  Eye,
  EyeOff,
  ChevronRight,
  Search,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import {
  DOC_TYPES,
  DOC_TYPE_LABELS,
  DOC_TYPE_COLORS,
  formatFileSize,
  type TutoratNode,
  type TutoratDocument,
  type DocType,
} from '../lib/tutorat'
import { getDownloadUrl, getPreviewUrl } from '../lib/tutoratFiles'
import { FieldError } from '../components/ui/FieldError'
import { TutoratBreadcrumb } from '../components/TutoratBreadcrumb'

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
  const inMatiere = current?.kind === 'matiere'
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
      ) : inMatiere && current ? (
        // key = remonte le composant (et réinitialise son état) à chaque matière
        <DocumentList key={current.id} matiere={current} onError={setError} />
      ) : (
        <NodeGrid nodes={children} onEnter={enter} />
      )}
    </div>
  )
}

// ----------------------------------------------------------------------------
// Grille de dossiers (promos / options / matières)
// ----------------------------------------------------------------------------

function NodeGrid({
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
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
  matiere,
  onError,
}: {
  matiere: TutoratNode
  onError: (msg: string) => void
}) {
  // État initial = celui d'une matière fraîchement ouverte. Le composant est
  // remonté (key=matiere.id par le parent) à chaque changement de matière,
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
      .eq('node_id', matiere.id)
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
  }, [matiere.id, onError])

  const filtered = documents
    .filter((d) => typeFilter === 'all' || d.doc_type === typeFilter)
    .filter((d) =>
      search.trim() === ''
        ? true
        : d.title.toLowerCase().includes(search.trim().toLowerCase()),
    )

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Chargement…</div>
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        Aucun document dans « {matiere.name} » pour l'instant.
      </div>
    )
  }

  return (
    <div className="space-y-4">
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

// ----------------------------------------------------------------------------
// Carte document : métadonnées + actions (télécharger, aperçu PDF)
// ----------------------------------------------------------------------------

function DocumentCard({ doc }: { doc: TutoratDocument }) {
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const isPdf = doc.content_type === 'application/pdf'
  const dateLabel = format(new Date(doc.created_at), 'd MMM yyyy', {
    locale: fr,
  })
  const sizeLabel = formatFileSize(doc.file_size)

  async function handleDownload() {
    setBusy(true)
    setActionError(null)
    try {
      const url = await getDownloadUrl(doc)
      // déclenche le téléchargement sans quitter la page
      const a = document.createElement('a')
      a.href = url
      a.rel = 'noopener'
      document.body.appendChild(a)
      a.click()
      a.remove()
    } catch (e) {
      setActionError(
        e instanceof Error ? e.message : 'Téléchargement impossible.',
      )
    } finally {
      setBusy(false)
    }
  }

  async function togglePreview() {
    if (previewUrl) {
      setPreviewUrl(null)
      return
    }
    setBusy(true)
    setActionError(null)
    try {
      setPreviewUrl(await getPreviewUrl(doc))
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Aperçu impossible.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <FileText
            size={20}
            className="text-gray-400 shrink-0 mt-0.5"
            aria-hidden
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-gray-900 break-words">
                {doc.title}
              </h3>
              <span
                className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${DOC_TYPE_COLORS[doc.doc_type]}`}
              >
                {DOC_TYPE_LABELS[doc.doc_type]}
              </span>
            </div>
            {doc.description && (
              <p className="text-sm text-gray-700 whitespace-pre-wrap mt-1">
                {doc.description}
              </p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              {dateLabel}
              {sizeLabel && ` · ${sizeLabel}`}
            </p>
          </div>
        </div>
      </div>

      {actionError && (
        <div className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {actionError}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleDownload}
          disabled={busy}
          className="inline-flex items-center gap-1.5 bg-black text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download size={16} aria-hidden />
          Télécharger
        </button>
        {isPdf && (
          <button
            type="button"
            onClick={togglePreview}
            disabled={busy}
            className="inline-flex items-center gap-1.5 bg-white text-black border border-gray-300 px-3 py-1.5 rounded-md text-sm font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {previewUrl ? (
              <>
                <EyeOff size={16} aria-hidden />
                Masquer
              </>
            ) : (
              <>
                <Eye size={16} aria-hidden />
                Aperçu
              </>
            )}
          </button>
        )}
      </div>

      {previewUrl && (
        <iframe
          src={previewUrl}
          title={`Aperçu de ${doc.title}`}
          className="mt-3 w-full h-[70vh] rounded-md border border-gray-200"
        />
      )}
    </div>
  )
}
