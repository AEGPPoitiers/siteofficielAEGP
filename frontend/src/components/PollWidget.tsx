import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { BarChart3 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useIsBdeMember } from '../lib/useIsBdeMember'
import {
  getActivePoll,
  getMyVotes,
  castVote,
  retractVote,
  type PollWithOptions,
} from '../lib/polls'

/**
 * Encart « Sondage en cours » de la page d'accueil. Affiche le sondage ouvert le
 * plus récent et permet de voter en ligne. S'efface s'il n'y a aucun sondage
 * ouvert — sauf pour un admin, à qui il propose un accès à la gestion.
 *
 * Les résultats ne sont jamais montrés ici : ils restent réservés à la clôture
 * (page /sondages).
 */
export default function PollWidget({ className = '' }: { className?: string }) {
  const { user } = useAuth()
  const { isAdmin } = useIsBdeMember()
  const [poll, setPoll] = useState<PollWithOptions | null>(null)
  const [myVote, setMyVote] = useState<string | undefined>(undefined)
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const active = await getActivePoll()
        if (cancelled) return
        setPoll(active)
        if (active && user) {
          const votes = await getMyVotes()
          if (!cancelled) setMyVote(votes[active.id])
        } else if (!cancelled) {
          setMyVote(undefined)
        }
      } catch {
        // Silencieux : en cas d'erreur, l'encart disparaît simplement.
      } finally {
        if (!cancelled) setLoaded(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user])

  async function handleVote(optionId: string) {
    if (!user || busy || !poll || myVote === optionId) return
    const previous = myVote
    setBusy(true)
    setMyVote(optionId)
    try {
      await castVote(poll.id, optionId, user.id)
    } catch {
      setMyVote(previous)
    } finally {
      setBusy(false)
    }
  }

  async function handleRetract() {
    if (!user || busy || !poll || myVote === undefined) return
    const previous = myVote
    setBusy(true)
    setMyVote(undefined)
    try {
      await retractVote(poll.id, user.id)
    } catch {
      setMyVote(previous)
    } finally {
      setBusy(false)
    }
  }

  if (!loaded) return null

  // Aucun sondage ouvert : on garde un point d'entrée pour les admins, rien sinon.
  if (!poll) {
    if (!isAdmin) return null
    return (
      <section
        className={`bg-white rounded-lg border border-gray-200 shadow-sm p-5 ${className}`}
      >
        <div className="flex items-center gap-2 mb-2">
          <BarChart3 size={18} className="text-purple-600" aria-hidden />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-purple-700">
            Sondages
          </h2>
        </div>
        <p className="text-sm text-gray-500 mb-3">Aucun sondage en cours.</p>
        <Link
          to="/sondages"
          className="text-sm font-medium text-gray-700 hover:text-black"
        >
          Créer un sondage →
        </Link>
      </section>
    )
  }

  return (
    <section
      className={`bg-white rounded-lg border border-gray-200 shadow-sm p-5 ${className}`}
    >
      <div className="flex items-center gap-2 mb-1">
        <BarChart3 size={18} className="text-purple-600" aria-hidden />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-purple-700">
          Sondage en cours
        </h2>
      </div>
      <p className="text-base font-semibold text-gray-900 mb-3">
        {poll.question}
      </p>

      <div className="space-y-2">
        {poll.options.map((option) => {
          const selected = myVote === option.id
          return (
            <label
              key={option.id}
              className={`flex items-center gap-3 px-3 py-2 rounded-md border transition-colors ${
                selected
                  ? 'border-black bg-gray-50'
                  : 'border-gray-200 hover:bg-gray-50'
              } ${!user || busy ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}
            >
              <input
                type="radio"
                name={`home-poll-${poll.id}`}
                checked={selected}
                disabled={!user || busy}
                onChange={() => handleVote(option.id)}
                className="accent-black"
              />
              <span className="text-sm text-gray-800">{option.label}</span>
            </label>
          )
        })}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        {!user ? (
          <Link to="/login" className="text-sm text-blue-700 hover:underline">
            Connecte-toi pour voter
          </Link>
        ) : myVote ? (
          <button
            type="button"
            onClick={handleRetract}
            disabled={busy}
            className="text-xs text-gray-500 hover:text-gray-700 disabled:opacity-50"
          >
            Retirer mon vote
          </button>
        ) : (
          <span className="text-xs text-gray-500">Résultats à la clôture</span>
        )}
        <Link
          to="/sondages"
          className="text-sm font-medium text-gray-700 hover:text-black shrink-0"
        >
          Tous les sondages →
        </Link>
      </div>
    </section>
  )
}
