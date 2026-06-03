import { useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { FieldError } from '../components/ui/FieldError'

type IdeaStatus = 'nouvelle' | 'en_etude' | 'realisee' | 'refusee'

type Idea = {
  id: string
  title: string
  description: string
  status: IdeaStatus
  created_by: string | null
  created_at: string
}

const STATUSES: IdeaStatus[] = ['nouvelle', 'en_etude', 'realisee', 'refusee']

const STATUS_LABELS: Record<IdeaStatus, string> = {
  nouvelle: 'Nouvelle',
  en_etude: "À l'étude",
  realisee: 'Réalisée',
  refusee: 'Refusée',
}

const STATUS_COLORS: Record<IdeaStatus, string> = {
  nouvelle: 'bg-blue-100 text-blue-800',
  en_etude: 'bg-amber-100 text-amber-800',
  realisee: 'bg-green-100 text-green-800',
  refusee: 'bg-gray-200 text-gray-700',
}

function formatRelative(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return "à l'instant"
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`
  if (diff < 86400 * 30) return `il y a ${Math.floor(diff / 86400)} j`
  if (diff < 86400 * 365) return `il y a ${Math.floor(diff / 86400 / 30)} mois`
  const years = Math.floor(diff / 86400 / 365)
  return `il y a ${years} an${years > 1 ? 's' : ''}`
}

export function BoiteaideeAdmin() {
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<IdeaStatus | 'all'>('all')

  useEffect(() => {
    let cancelled = false
    async function fetchIdeas() {
      const { data, error: fetchError } = await supabase
        .from('ideas')
        .select('*')
        .order('created_at', { ascending: false })
      if (cancelled) return
      if (fetchError) {
        setError(`Impossible de charger les idées : ${fetchError.message}`)
      } else if (data) {
        setIdeas(data as Idea[])
      }
      setLoading(false)
    }
    fetchIdeas()
    return () => {
      cancelled = true
    }
  }, [])

  async function changeStatus(id: string, newStatus: IdeaStatus) {
    const previous = ideas
    setIdeas((prev) =>
      prev.map((i) => (i.id === id ? { ...i, status: newStatus } : i)),
    )
    const { error: updateError } = await supabase
      .from('ideas')
      .update({ status: newStatus })
      .eq('id', id)
    if (updateError) {
      setIdeas(previous)
      setError(`Impossible de mettre à jour le statut : ${updateError.message}`)
    }
  }

  const counts: Record<IdeaStatus | 'all', number> = {
    all: ideas.length,
    nouvelle: ideas.filter((i) => i.status === 'nouvelle').length,
    en_etude: ideas.filter((i) => i.status === 'en_etude').length,
    realisee: ideas.filter((i) => i.status === 'realisee').length,
    refusee: ideas.filter((i) => i.status === 'refusee').length,
  }

  const filtered =
    filter === 'all' ? ideas : ideas.filter((i) => i.status === filter)

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Boîte à idées</h1>
        <p className="text-gray-600 mt-1">
          Idées reçues des étudiants ({ideas.length})
        </p>
      </div>

      {error && <FieldError>{error}</FieldError>}

      <div className="flex flex-wrap gap-2">
        <FilterTab
          active={filter === 'all'}
          onClick={() => setFilter('all')}
          count={counts.all}
        >
          Toutes
        </FilterTab>
        {STATUSES.map((s) => (
          <FilterTab
            key={s}
            active={filter === s}
            onClick={() => setFilter(s)}
            count={counts[s]}
          >
            {STATUS_LABELS[s]}
          </FilterTab>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Chargement…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          Aucune idée dans cette catégorie.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((idea) => (
            <IdeaCard
              key={idea.id}
              idea={idea}
              onChangeStatus={changeStatus}
            />
          ))}
        </div>
      )}
    </div>
  )
}

type FilterTabProps = {
  active: boolean
  onClick: () => void
  count: number
  children: ReactNode
}

function FilterTab({ active, onClick, count, children }: FilterTabProps) {
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
      {children} <span className="opacity-70">({count})</span>
    </button>
  )
}

type IdeaCardProps = {
  idea: Idea
  onChangeStatus: (id: string, status: IdeaStatus) => void
}

function IdeaCard({ idea, onChangeStatus }: IdeaCardProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="flex items-start justify-between gap-4 mb-2">
        <h3 className="font-semibold text-gray-900">{idea.title}</h3>
        <span
          className={`shrink-0 px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[idea.status]}`}
        >
          {STATUS_LABELS[idea.status]}
        </span>
      </div>
      <p className="text-sm text-gray-700 whitespace-pre-wrap mb-3">
        {idea.description}
      </p>
      <div className="flex items-center justify-between gap-2 text-xs text-gray-500">
        <span>
          Par{' '}
          {idea.created_by ? (
            <code className="font-mono">{idea.created_by.slice(0, 8)}…</code>
          ) : (
            'anonyme'
          )}{' '}
          · {formatRelative(idea.created_at)}
        </span>
        <select
          value={idea.status}
          onChange={(e) =>
            onChangeStatus(idea.id, e.target.value as IdeaStatus)
          }
          className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-black bg-white"
          aria-label="Changer le statut"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
