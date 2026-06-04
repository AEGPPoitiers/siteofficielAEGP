import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { TutoratNode, TutoratDocument } from '../lib/tutorat'
import { deleteObject } from '../lib/tutoratFiles'
import { FieldError } from '../components/ui/FieldError'
import { Button } from '../components/ui/Button'
import { TutoratBreadcrumb } from '../components/TutoratBreadcrumb'
import { NodeManager } from '../components/NodeManager'
import { DocumentForm } from '../components/DocumentForm'
import { DocumentCard } from '../components/DocumentCard'

/**
 * Vue BDE du tutorat : même navigation que la vue étudiant, plus la gestion de
 * la taxonomie (NodeManager) et des documents (ajout / modification /
 * suppression).
 */
export default function TutoratAdmin() {
  const [nodes, setNodes] = useState<TutoratNode[]>([])
  const [loadingNodes, setLoadingNodes] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [treeToken, setTreeToken] = useState(0)
  const [path, setPath] = useState<TutoratNode[]>([])

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
  }, [treeToken])

  const current = path[path.length - 1] ?? null
  const inMatiere = current?.kind === 'matiere'
  const children = nodes
    .filter((n) => (n.parent_id ?? null) === (current?.id ?? null))
    .sort((a, b) => a.position - b.position)

  // NodeManager ne mute que les enfants du niveau courant (jamais un ancêtre du
  // chemin), donc un simple rechargement de l'arbre suffit.
  function reloadTree() {
    setTreeToken((t) => t + 1)
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Tutorat — gestion</h1>
        <p className="text-gray-600 mt-1">
          Organise la taxonomie et gère les documents (réservé au BDE).
        </p>
      </div>

      {error && <FieldError>{error}</FieldError>}

      <TutoratBreadcrumb
        path={path}
        onNavigate={(i) => setPath((p) => (i < 0 ? [] : p.slice(0, i + 1)))}
      />

      {loadingNodes ? (
        <div className="text-center py-12 text-gray-500">Chargement…</div>
      ) : inMatiere && current ? (
        <DocumentManager key={current.id} matiere={current} onError={setError} />
      ) : (
        <NodeManager
          key={current?.id ?? 'root'}
          parent={current}
          nodes={children}
          onEnter={(node) => setPath((p) => [...p, node])}
          onChanged={reloadTree}
        />
      )}
    </div>
  )
}

// ----------------------------------------------------------------------------
// Gestion des documents d'une matière
// ----------------------------------------------------------------------------

function DocumentManager({
  matiere,
  onError,
}: {
  matiere: TutoratNode
  onError: (msg: string) => void
}) {
  const [documents, setDocuments] = useState<TutoratDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState(0)
  const [formFor, setFormFor] = useState<'new' | TutoratDocument | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

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
  }, [matiere.id, token, onError])

  function reload() {
    setToken((t) => t + 1)
  }

  async function handleDelete(doc: TutoratDocument) {
    if (!window.confirm(`Supprimer « ${doc.title} » ? Action irréversible.`)) {
      return
    }
    setDeletingId(doc.id)
    const { error: deleteError } = await supabase
      .from('tutorat_documents')
      .delete()
      .eq('id', doc.id)
    if (deleteError) {
      setDeletingId(null)
      onError(`Impossible de supprimer : ${deleteError.message}`)
      return
    }
    // Cleanup B2 best-effort (cf removeEventImage côté agenda).
    await deleteObject(doc.file_key).catch((e) =>
      console.warn('[tutorat] suppression objet B2 échouée :', e),
    )
    setDeletingId(null)
    reload()
  }

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Chargement…</div>
  }

  return (
    <div className="space-y-4">
      {formFor ? (
        <DocumentForm
          matiere={matiere}
          existing={formFor === 'new' ? null : formFor}
          onDone={() => {
            setFormFor(null)
            reload()
          }}
          onCancel={() => setFormFor(null)}
        />
      ) : (
        <Button type="button" variant="primary" onClick={() => setFormFor('new')}>
          <span className="inline-flex items-center gap-1.5">
            <Plus size={16} aria-hidden />
            Ajouter un document
          </span>
        </Button>
      )}

      {documents.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          Aucun document dans « {matiere.name} ».
        </div>
      ) : (
        <div className="space-y-3">
          {documents.map((doc) => (
            <DocumentCard
              key={doc.id}
              doc={doc}
              admin={{
                onEdit: (d) => setFormFor(d),
                onDelete: handleDelete,
                deleting: deletingId === doc.id,
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
