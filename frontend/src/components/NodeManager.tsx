import { useState } from 'react'
import { ChevronRight, Folder, Pencil, Trash2, Plus, Check, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Button } from './ui/Button'
import { FieldError } from './ui/FieldError'
import {
  allowedChildKinds,
  type NodeKind,
  type TutoratNode,
} from '../lib/tutorat'

const KIND_LABELS: Record<NodeKind, string> = {
  promo: 'Promo',
  option: 'Option',
  matiere: 'Matière',
}

type Props = {
  parent: TutoratNode | null
  nodes: TutoratNode[]
  onEnter: (node: TutoratNode) => void
  /** À appeler après une mutation pour recharger l'arbre. */
  onChanged: () => void
}

/**
 * Gestion de la taxonomie pour un niveau donné (vue BDE) : liste des enfants
 * (navigables), renommage, suppression (seulement si vide), et ajout d'un
 * enfant. Le re-parentage n'est volontairement pas proposé.
 */
export function NodeManager({ parent, nodes, onEnter, onChanged }: Props) {
  const kinds = allowedChildKinds(parent)
  const [newName, setNewName] = useState('')
  const [newKind, setNewKind] = useState<NodeKind>(kinds[0] ?? 'matiere')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  async function handleAdd() {
    const name = newName.trim()
    if (!name) return
    setError(null)
    setBusy(true)
    const position = nodes.length
      ? Math.max(...nodes.map((c) => c.position)) + 1
      : 0
    const { error: insertError } = await supabase
      .from('tutorat_nodes')
      .insert({ parent_id: parent?.id ?? null, name, kind: newKind, position })
    setBusy(false)
    if (insertError) {
      setError(`Impossible d'ajouter : ${insertError.message}`)
      return
    }
    setNewName('')
    onChanged()
  }

  async function handleRename(node: TutoratNode) {
    const name = renameValue.trim()
    if (!name || name === node.name) {
      setRenamingId(null)
      return
    }
    setError(null)
    const { error: updateError } = await supabase
      .from('tutorat_nodes')
      .update({ name })
      .eq('id', node.id)
    if (updateError) {
      setError(`Impossible de renommer : ${updateError.message}`)
      return
    }
    setRenamingId(null)
    onChanged()
  }

  async function handleDelete(node: TutoratNode) {
    setError(null)
    setBusy(true)
    // Refuse la suppression d'un node non vide (évite les orphelins B2 en masse).
    const [{ count: childCount }, { count: docCount }] = await Promise.all([
      supabase
        .from('tutorat_nodes')
        .select('id', { count: 'exact', head: true })
        .eq('parent_id', node.id),
      supabase
        .from('tutorat_documents')
        .select('id', { count: 'exact', head: true })
        .eq('node_id', node.id),
    ])
    if ((childCount ?? 0) > 0 || (docCount ?? 0) > 0) {
      setBusy(false)
      setError(
        `« ${node.name} » n'est pas vide. Supprime d'abord son contenu.`,
      )
      return
    }
    if (!window.confirm(`Supprimer « ${node.name} » ?`)) {
      setBusy(false)
      return
    }
    const { error: deleteError } = await supabase
      .from('tutorat_nodes')
      .delete()
      .eq('id', node.id)
    setBusy(false)
    if (deleteError) {
      setError(`Impossible de supprimer : ${deleteError.message}`)
      return
    }
    onChanged()
  }

  return (
    <div className="space-y-4">
      {error && <FieldError>{error}</FieldError>}

      {nodes.length === 0 ? (
        <p className="text-sm text-gray-500">Aucun élément à ce niveau.</p>
      ) : (
        <div className="space-y-2">
          {nodes.map((node) => (
            <div
              key={node.id}
              className="flex items-center gap-2 bg-white rounded-lg shadow-sm border border-gray-200 p-3"
            >
              {renamingId === node.id ? (
                <>
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRename(node)
                      if (e.key === 'Escape') setRenamingId(null)
                    }}
                    className="flex-1 min-w-0 px-2 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-black"
                    aria-label="Nouveau nom"
                  />
                  <button
                    type="button"
                    onClick={() => handleRename(node)}
                    className="p-1.5 text-green-700 hover:bg-green-50 rounded-md"
                    aria-label="Valider"
                  >
                    <Check size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setRenamingId(null)}
                    className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-md"
                    aria-label="Annuler"
                  >
                    <X size={16} />
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => onEnter(node)}
                    className="flex items-center gap-2 flex-1 min-w-0 text-left hover:text-black focus:outline-none"
                  >
                    <Folder
                      size={18}
                      className="text-gray-400 shrink-0"
                      aria-hidden
                    />
                    <span className="font-medium text-gray-900 truncate">
                      {node.name}
                    </span>
                    <span className="text-xs text-gray-400 shrink-0">
                      {KIND_LABELS[node.kind]}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRenamingId(node.id)
                      setRenameValue(node.name)
                    }}
                    className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-md"
                    aria-label={`Renommer ${node.name}`}
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(node)}
                    disabled={busy}
                    className="p-1.5 text-red-600 hover:bg-red-50 rounded-md disabled:opacity-50"
                    aria-label={`Supprimer ${node.name}`}
                  >
                    <Trash2 size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onEnter(node)}
                    className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-md"
                    aria-label={`Ouvrir ${node.name}`}
                  >
                    <ChevronRight size={16} />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {kinds.length > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 flex flex-col sm:flex-row gap-2 sm:items-center">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdd()
            }}
            placeholder="Nom du dossier…"
            disabled={busy}
            className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white"
            aria-label="Nom du nouvel élément"
          />
          {kinds.length > 1 && (
            <select
              value={newKind}
              onChange={(e) => setNewKind(e.target.value as NodeKind)}
              disabled={busy}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white"
              aria-label="Type d'élément"
            >
              {kinds.map((k) => (
                <option key={k} value={k}>
                  {KIND_LABELS[k]}
                </option>
              ))}
            </select>
          )}
          <Button
            type="button"
            variant="primary"
            onClick={handleAdd}
            loading={busy}
            disabled={!newName.trim()}
          >
            <span className="inline-flex items-center gap-1.5">
              <Plus size={16} aria-hidden />
              Ajouter
            </span>
          </Button>
        </div>
      )}
    </div>
  )
}
