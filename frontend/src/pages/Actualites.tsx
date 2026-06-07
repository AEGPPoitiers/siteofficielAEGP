import { useEffect, useState, type FormEvent } from 'react'
import { Trash2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useIsBdeMember } from '../lib/useIsBdeMember'
import { useConfirm } from '../contexts/ConfirmContext'
import {
  listNews,
  createNews,
  deleteNews,
  formatNewsDate,
  NEWS_TITLE_MAX,
  NEWS_CONTENT_MAX,
  type NewsItem,
} from '../lib/news'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Textarea } from '../components/ui/Textarea'
import { FieldError } from '../components/ui/FieldError'

export default function Actualites() {
  const { user } = useAuth()
  const { isBde } = useIsBdeMember()
  const confirm = useConfirm()

  const [news, setNews] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    let cancelled = false
    listNews()
      .then((data) => {
        if (!cancelled) setNews(data)
      })
      .catch((e) => {
        if (!cancelled)
          setError(`Impossible de charger les actualités : ${e.message}`)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  function handleCreated(item: NewsItem) {
    setNews((prev) => [item, ...prev])
    setShowForm(false)
  }

  async function handleDelete(id: string) {
    const item = news.find((n) => n.id === id)
    const ok = await confirm({
      title: "Supprimer l'actualité",
      message: `Supprimer définitivement « ${item?.title ?? ''} » ? Action irréversible.`,
      confirmLabel: 'Supprimer',
      danger: true,
    })
    if (!ok) return
    const previous = news
    setNews((prev) => prev.filter((n) => n.id !== id))
    try {
      await deleteNews(id)
    } catch (e) {
      setNews(previous)
      setError(`Impossible de supprimer : ${(e as Error).message}`)
    }
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Actualités</h1>
          <p className="text-gray-600 mt-1">Les dernières nouvelles de l'AEGP.</p>
        </div>
        {isBde && (
          <Button
            type="button"
            variant="primary"
            onClick={() => setShowForm((v) => !v)}
            className="shrink-0"
          >
            {showForm ? 'Annuler' : 'Nouvelle actualité'}
          </Button>
        )}
      </div>

      {error && <FieldError>{error}</FieldError>}

      {isBde && showForm && user && (
        <NewsForm userId={user.id} onCreated={handleCreated} />
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-500">Chargement…</div>
      ) : news.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          Aucune actualité pour le moment.
        </div>
      ) : (
        <div className="space-y-4">
          {news.map((item) => (
            <article
              key={item.id}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-5"
            >
              <div className="flex items-start justify-between gap-4 mb-1">
                <h2 className="text-xl font-semibold text-gray-900">
                  {item.title}
                </h2>
                {isBde && (
                  <button
                    type="button"
                    onClick={() => handleDelete(item.id)}
                    aria-label="Supprimer l'actualité"
                    className="shrink-0 p-1.5 text-red-600 hover:bg-red-50 rounded-md"
                  >
                    <Trash2 size={16} aria-hidden />
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-500 mb-3">
                {formatNewsDate(item.created_at)}
              </p>
              <p className="text-gray-700 whitespace-pre-wrap">{item.content}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

type NewsFormProps = {
  userId: string
  onCreated: (item: NewsItem) => void
}

function NewsForm({ userId, onCreated }: NewsFormProps) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function validate(): string | null {
    const t = title.trim()
    const c = content.trim()
    if (t.length === 0) return 'Le titre est obligatoire.'
    if (t.length > NEWS_TITLE_MAX)
      return `Le titre ne doit pas dépasser ${NEWS_TITLE_MAX} caractères.`
    if (c.length === 0) return 'Le contenu est obligatoire.'
    if (c.length > NEWS_CONTENT_MAX)
      return `Le contenu ne doit pas dépasser ${NEWS_CONTENT_MAX} caractères.`
    return null
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }
    setSubmitting(true)
    try {
      const item = await createNews({ title, content }, userId)
      onCreated(item)
    } catch (e) {
      setError(`Impossible de publier l'actualité : ${(e as Error).message}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="bg-white rounded-lg shadow-sm border border-gray-200 p-5"
    >
      <FieldError>{error}</FieldError>
      <Input
        id="news-title"
        label="Titre"
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={NEWS_TITLE_MAX}
        disabled={submitting}
        placeholder="Ex : résultats du week-end d'intégration"
        required
      />
      <Textarea
        id="news-content"
        label="Contenu"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        maxLength={NEWS_CONTENT_MAX}
        disabled={submitting}
        rows={6}
        placeholder="Rédigez l'actualité…"
        required
      />
      <Button type="submit" variant="primary" loading={submitting}>
        {submitting ? 'Publication…' : 'Publier'}
      </Button>
    </form>
  )
}
