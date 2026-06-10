import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Plus, Trash2, Lock, X } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useIsBdeMember } from '../lib/useIsBdeMember'
import { useConfirm } from '../contexts/ConfirmContext'
import {
  listPolls,
  createPoll,
  closePoll,
  deletePoll,
  getMyVotes,
  castVote,
  retractVote,
  getPollResults,
  formatPollDate,
  POLL_QUESTION_MAX,
  POLL_OPTION_MAX,
  POLL_MIN_OPTIONS,
  POLL_MAX_OPTIONS,
  type PollWithOptions,
  type PollResult,
} from '../lib/polls'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { FieldError } from '../components/ui/FieldError'

export default function Sondages() {
  const { user } = useAuth()
  const { isAdmin } = useIsBdeMember()
  const confirm = useConfirm()

  const [polls, setPolls] = useState<PollWithOptions[]>([])
  const [myVotes, setMyVotes] = useState<Record<string, string>>({})
  const [results, setResults] = useState<Record<string, PollResult[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [busyPollId, setBusyPollId] = useState<string | null>(null)

  // Charge les résultats des sondages qui doivent les afficher : les clôturés
  // (visibles de tous) et, pour un admin, tous les sondages (suivi en direct).
  async function loadResultsFor(list: PollWithOptions[], admin: boolean) {
    const targets = list.filter((p) => p.is_closed || admin)
    const entries = await Promise.all(
      targets.map(async (p) => {
        try {
          return [p.id, await getPollResults(p.id)] as const
        } catch {
          return [p.id, [] as PollResult[]] as const
        }
      }),
    )
    setResults((prev) => {
      const next = { ...prev }
      for (const [id, res] of entries) next[id] = res
      return next
    })
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const list = await listPolls()
        if (cancelled) return
        setPolls(list)
        if (user) {
          const votes = await getMyVotes()
          if (!cancelled) setMyVotes(votes)
        }
        await loadResultsFor(list, isAdmin)
      } catch (e) {
        if (!cancelled)
          setError(`Impossible de charger les sondages : ${(e as Error).message}`)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
    // isAdmin/user déterminent ce qu'on charge ; on recharge si l'identité change.
  }, [user, isAdmin])

  async function handleVote(pollId: string, optionId: string) {
    if (!user || busyPollId) return
    const previous = myVotes[pollId]
    if (previous === optionId) return
    setBusyPollId(pollId)
    setError(null)
    setMyVotes((prev) => ({ ...prev, [pollId]: optionId }))
    try {
      await castVote(pollId, optionId, user.id)
      if (isAdmin) {
        const res = await getPollResults(pollId)
        setResults((prev) => ({ ...prev, [pollId]: res }))
      }
    } catch (e) {
      // Revert
      setMyVotes((prev) => {
        const next = { ...prev }
        if (previous === undefined) delete next[pollId]
        else next[pollId] = previous
        return next
      })
      setError(`Vote impossible : ${(e as Error).message}`)
    } finally {
      setBusyPollId(null)
    }
  }

  async function handleRetract(pollId: string) {
    if (!user || busyPollId) return
    const previous = myVotes[pollId]
    if (previous === undefined) return
    setBusyPollId(pollId)
    setError(null)
    setMyVotes((prev) => {
      const next = { ...prev }
      delete next[pollId]
      return next
    })
    try {
      await retractVote(pollId, user.id)
      if (isAdmin) {
        const res = await getPollResults(pollId)
        setResults((prev) => ({ ...prev, [pollId]: res }))
      }
    } catch (e) {
      setMyVotes((prev) => ({ ...prev, [pollId]: previous }))
      setError(`Impossible de retirer le vote : ${(e as Error).message}`)
    } finally {
      setBusyPollId(null)
    }
  }

  async function handleClose(poll: PollWithOptions) {
    const ok = await confirm({
      title: 'Clôturer le sondage',
      message: `Clôturer « ${poll.question} » ? Les votes seront figés et les résultats rendus publics. Action irréversible.`,
      confirmLabel: 'Clôturer',
    })
    if (!ok) return
    setBusyPollId(poll.id)
    setError(null)
    try {
      await closePoll(poll.id)
      setPolls((prev) =>
        prev.map((p) =>
          p.id === poll.id
            ? { ...p, is_closed: true, closed_at: new Date().toISOString() }
            : p,
        ),
      )
      const res = await getPollResults(poll.id)
      setResults((prev) => ({ ...prev, [poll.id]: res }))
    } catch (e) {
      setError(`Clôture impossible : ${(e as Error).message}`)
    } finally {
      setBusyPollId(null)
    }
  }

  async function handleDelete(poll: PollWithOptions) {
    const ok = await confirm({
      title: 'Supprimer le sondage',
      message: `Supprimer définitivement « ${poll.question} » et tous ses votes ? Action irréversible.`,
      confirmLabel: 'Supprimer',
      danger: true,
    })
    if (!ok) return
    const previous = polls
    setPolls((prev) => prev.filter((p) => p.id !== poll.id))
    try {
      await deletePoll(poll.id)
    } catch (e) {
      setPolls(previous)
      setError(`Suppression impossible : ${(e as Error).message}`)
    }
  }

  function handleCreated(poll: PollWithOptions) {
    setPolls((prev) => [poll, ...prev])
    setShowForm(false)
    if (isAdmin) {
      getPollResults(poll.id)
        .then((res) => setResults((prev) => ({ ...prev, [poll.id]: res })))
        .catch(() => {})
    }
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Sondages</h1>
          <p className="text-gray-600 mt-1">
            Donne ton avis. Les résultats sont dévoilés à la clôture.
          </p>
        </div>
        {isAdmin && (
          <Button
            type="button"
            variant="primary"
            onClick={() => setShowForm((v) => !v)}
            className="shrink-0"
          >
            {showForm ? 'Annuler' : 'Nouveau sondage'}
          </Button>
        )}
      </div>

      {error && <FieldError>{error}</FieldError>}

      {isAdmin && showForm && user && (
        <PollForm
          userId={user.id}
          onCreated={handleCreated}
          onCancel={() => setShowForm(false)}
        />
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-500">Chargement…</div>
      ) : polls.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          Aucun sondage pour le moment.
        </div>
      ) : (
        <div className="space-y-4">
          {polls.map((poll) => (
            <PollCard
              key={poll.id}
              poll={poll}
              myVote={myVotes[poll.id]}
              results={results[poll.id]}
              isAdmin={isAdmin}
              canVote={!!user}
              busy={busyPollId === poll.id}
              onVote={(optionId) => handleVote(poll.id, optionId)}
              onRetract={() => handleRetract(poll.id)}
              onClose={() => handleClose(poll)}
              onDelete={() => handleDelete(poll)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

type PollCardProps = {
  poll: PollWithOptions
  myVote: string | undefined
  results: PollResult[] | undefined
  isAdmin: boolean
  canVote: boolean
  busy: boolean
  onVote: (optionId: string) => void
  onRetract: () => void
  onClose: () => void
  onDelete: () => void
}

function PollCard({
  poll,
  myVote,
  results,
  isAdmin,
  canVote,
  busy,
  onVote,
  onRetract,
  onClose,
  onDelete,
}: PollCardProps) {
  // Résultats affichés : toujours pour un sondage clôturé ; pour un admin aussi
  // en direct sur un sondage ouvert.
  const showResults = poll.is_closed || (isAdmin && !!results)

  return (
    <article className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
      <div className="flex items-start justify-between gap-4 mb-1">
        <h2 className="text-xl font-semibold text-gray-900">{poll.question}</h2>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-medium ${
              poll.is_closed
                ? 'bg-gray-100 text-gray-600'
                : 'bg-green-100 text-green-700'
            }`}
          >
            {poll.is_closed ? 'Clôturé' : 'Ouvert'}
          </span>
          {isAdmin && (
            <div className="flex items-center gap-1">
              {!poll.is_closed && (
                <button
                  type="button"
                  onClick={onClose}
                  disabled={busy}
                  aria-label="Clôturer le sondage"
                  title="Clôturer"
                  className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-md disabled:opacity-50"
                >
                  <Lock size={16} aria-hidden />
                </button>
              )}
              <button
                type="button"
                onClick={onDelete}
                aria-label="Supprimer le sondage"
                title="Supprimer"
                className="p-1.5 text-red-600 hover:bg-red-50 rounded-md"
              >
                <Trash2 size={16} aria-hidden />
              </button>
            </div>
          )}
        </div>
      </div>
      <p className="text-xs text-gray-500 mb-4">
        {poll.is_closed && poll.closed_at
          ? `Clôturé le ${formatPollDate(poll.closed_at)}`
          : `Ouvert le ${formatPollDate(poll.created_at)}`}
      </p>

      {showResults && results ? (
        <PollResults results={results} myVote={myVote} />
      ) : poll.is_closed ? (
        <p className="text-sm text-gray-500">Résultats indisponibles.</p>
      ) : (
        <PollBallot
          poll={poll}
          myVote={myVote}
          canVote={canVote}
          busy={busy}
          onVote={onVote}
          onRetract={onRetract}
        />
      )}
    </article>
  )
}

type PollBallotProps = {
  poll: PollWithOptions
  myVote: string | undefined
  canVote: boolean
  busy: boolean
  onVote: (optionId: string) => void
  onRetract: () => void
}

function PollBallot({
  poll,
  myVote,
  canVote,
  busy,
  onVote,
  onRetract,
}: PollBallotProps) {
  return (
    <div className="space-y-2">
      {poll.options.map((option) => {
        const selected = myVote === option.id
        return (
          <label
            key={option.id}
            className={`flex items-center gap-3 px-3 py-2 rounded-md border cursor-pointer transition-colors ${
              selected
                ? 'border-black bg-gray-50'
                : 'border-gray-200 hover:bg-gray-50'
            } ${!canVote || busy ? 'cursor-not-allowed opacity-70' : ''}`}
          >
            <input
              type="radio"
              name={`poll-${poll.id}`}
              checked={selected}
              disabled={!canVote || busy}
              onChange={() => onVote(option.id)}
              className="accent-black"
            />
            <span className="text-gray-800">{option.label}</span>
          </label>
        )
      })}

      {!canVote ? (
        <p className="text-sm text-gray-500 pt-1">
          <Link to="/login" className="text-blue-700 hover:underline">
            Connecte-toi
          </Link>{' '}
          pour voter.
        </p>
      ) : myVote ? (
        <div className="flex items-center justify-between pt-1">
          <p className="text-sm text-green-700">Ton vote est enregistré.</p>
          <button
            type="button"
            onClick={onRetract}
            disabled={busy}
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50"
          >
            <X size={14} aria-hidden />
            Retirer mon vote
          </button>
        </div>
      ) : (
        <p className="text-sm text-gray-500 pt-1">
          Les résultats seront visibles après la clôture.
        </p>
      )}
    </div>
  )
}

function PollResults({
  results,
  myVote,
}: {
  results: PollResult[]
  myVote: string | undefined
}) {
  const total = results.reduce((sum, r) => sum + r.votes, 0)
  return (
    <div className="space-y-3">
      {results.map((r) => {
        const pct = total === 0 ? 0 : Math.round((r.votes / total) * 100)
        const mine = myVote === r.option_id
        return (
          <div key={r.option_id}>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className={`${mine ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                {r.label}
                {mine && <span className="text-green-700"> · ton vote</span>}
              </span>
              <span className="text-gray-500">
                {r.votes} voix · {pct}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
              <div
                className={`h-full rounded-full ${mine ? 'bg-green-600' : 'bg-gray-800'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )
      })}
      <p className="text-xs text-gray-500 pt-1">
        {total} {total > 1 ? 'votes' : 'vote'} au total.
      </p>
    </div>
  )
}

type PollFormProps = {
  userId: string
  onCreated: (poll: PollWithOptions) => void
  onCancel: () => void
}

function PollForm({ userId, onCreated, onCancel }: PollFormProps) {
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState<string[]>(['', ''])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function updateOption(index: number, value: string) {
    setOptions((prev) => prev.map((o, i) => (i === index ? value : o)))
  }

  function addOption() {
    setOptions((prev) =>
      prev.length >= POLL_MAX_OPTIONS ? prev : [...prev, ''],
    )
  }

  function removeOption(index: number) {
    setOptions((prev) =>
      prev.length <= POLL_MIN_OPTIONS ? prev : prev.filter((_, i) => i !== index),
    )
  }

  function validate(): string | null {
    const q = question.trim()
    if (q.length === 0) return 'La question est obligatoire.'
    if (q.length > POLL_QUESTION_MAX)
      return `La question ne doit pas dépasser ${POLL_QUESTION_MAX} caractères.`
    const filled = options.map((o) => o.trim()).filter((o) => o.length > 0)
    if (filled.length < POLL_MIN_OPTIONS)
      return `Indique au moins ${POLL_MIN_OPTIONS} choix.`
    const unique = new Set(filled.map((o) => o.toLowerCase()))
    if (unique.size !== filled.length)
      return 'Les choix doivent être distincts.'
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
      const poll = await createPoll(question, options, userId)
      onCreated(poll)
    } catch (e) {
      setError(`Impossible de créer le sondage : ${(e as Error).message}`)
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
        id="poll-question"
        label="Question"
        type="text"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        maxLength={POLL_QUESTION_MAX}
        disabled={submitting}
        placeholder="Ex : quel thème pour la prochaine soirée ?"
        required
      />

      <label className="block text-sm font-medium text-gray-700 mb-1">
        Choix
      </label>
      <div className="space-y-2 mb-3">
        {options.map((option, index) => (
          <div key={index} className="flex items-center gap-2">
            <input
              type="text"
              value={option}
              onChange={(e) => updateOption(index, e.target.value)}
              maxLength={POLL_OPTION_MAX}
              disabled={submitting}
              placeholder={`Choix ${index + 1}`}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-black"
            />
            <button
              type="button"
              onClick={() => removeOption(index)}
              disabled={submitting || options.length <= POLL_MIN_OPTIONS}
              aria-label="Supprimer ce choix"
              className="p-2 text-gray-500 hover:bg-gray-100 rounded-md disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
            >
              <X size={16} aria-hidden />
            </button>
          </div>
        ))}
      </div>

      {options.length < POLL_MAX_OPTIONS && (
        <button
          type="button"
          onClick={addOption}
          disabled={submitting}
          className="inline-flex items-center gap-1 text-sm text-blue-700 hover:underline mb-4 disabled:opacity-50"
        >
          <Plus size={14} aria-hidden />
          Ajouter un choix
        </button>
      )}

      <div className="flex gap-2">
        <Button type="submit" variant="primary" loading={submitting}>
          {submitting ? 'Création…' : 'Créer le sondage'}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={submitting}
        >
          Annuler
        </Button>
      </div>
    </form>
  )
}
