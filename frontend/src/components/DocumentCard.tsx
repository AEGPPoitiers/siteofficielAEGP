import { useState } from 'react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { FileText, Download, Pencil, Trash2 } from 'lucide-react'
import {
  DOC_TYPE_LABELS,
  DOC_TYPE_COLORS,
  formatFileSize,
  type TutoratDocument,
} from '../lib/tutorat'
import { getDownloadUrl, getPreviewUrl } from '../lib/tutoratFiles'

type AdminActions = {
  onEdit: (doc: TutoratDocument) => void
  onDelete: (doc: TutoratDocument) => void
  deleting?: boolean
}

type Props = {
  doc: TutoratDocument
  /** Si fourni, affiche les boutons Modifier / Supprimer (vue BDE). */
  admin?: AdminActions
}

/**
 * Carte d'un document : métadonnées + téléchargement. Cliquer sur le nom ouvre
 * le fichier (aperçu inline, ex. PDF) dans un nouvel onglet. En mode `admin`,
 * ajoute Modifier / Supprimer. Partagée entre la vue étudiant et la vue BDE.
 */
export function DocumentCard({ doc, admin }: Props) {
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const dateLabel = format(new Date(doc.created_at), 'dd/MM/yyyy', {
    locale: fr,
  })
  const sizeLabel = formatFileSize(doc.file_size)

  /** Ouvre le fichier (URL signée inline) dans un nouvel onglet. */
  async function handleOpen() {
    setBusy(true)
    setActionError(null)
    // Onglet ouvert SYNCHRONIQUEMENT dans le geste utilisateur (sinon le bloqueur
    // de pop-up l'intercepte une fois l'await résolu) ; opener coupé par sécurité.
    const tab = window.open('about:blank', '_blank')
    if (tab) tab.opener = null
    try {
      const url = await getPreviewUrl(doc)
      if (tab) tab.location.href = url
      else window.location.href = url // pop-up bloqué : repli sur l'onglet courant
    } catch (e) {
      tab?.close()
      setActionError(e instanceof Error ? e.message : 'Ouverture impossible.')
    } finally {
      setBusy(false)
    }
  }

  async function handleDownload() {
    setBusy(true)
    setActionError(null)
    try {
      const url = await getDownloadUrl(doc)
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

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="flex items-start gap-3 min-w-0">
        <FileText
          size={20}
          className="text-gray-400 shrink-0 mt-0.5"
          aria-hidden
        />
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleOpen}
              disabled={busy}
              title="Ouvrir dans un nouvel onglet"
              className="font-semibold text-gray-900 break-words text-left hover:text-black hover:underline focus:outline-none focus:underline disabled:opacity-50 disabled:no-underline"
            >
              {doc.title}
            </button>
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
        {admin && (
          <>
            <button
              type="button"
              onClick={() => admin.onEdit(doc)}
              disabled={busy || admin.deleting}
              className="inline-flex items-center gap-1.5 bg-white text-black border border-gray-300 px-3 py-1.5 rounded-md text-sm font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Pencil size={16} aria-hidden />
              Modifier
            </button>
            <button
              type="button"
              onClick={() => admin.onDelete(doc)}
              disabled={busy || admin.deleting}
              className="inline-flex items-center gap-1.5 bg-red-600 text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 size={16} aria-hidden />
              {admin.deleting ? 'Suppression…' : 'Supprimer'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
