import { supabase } from './supabase'

export type Poll = {
  id: string
  question: string
  is_closed: boolean
  created_by: string | null
  created_at: string
  closed_at: string | null
}

export type PollOption = {
  id: string
  poll_id: string
  label: string
  position: number
}

export type PollWithOptions = Poll & { options: PollOption[] }

/** Une ligne de résultat agrégé renvoyée par la RPC `get_poll_results`. */
export type PollResult = {
  option_id: string
  label: string
  votes: number
}

export const POLL_QUESTION_MAX = 300
export const POLL_OPTION_MAX = 200
export const POLL_MIN_OPTIONS = 2
export const POLL_MAX_OPTIONS = 10

/** Formate une date ISO en date lisible française (ex : « 7 juin 2026 »). */
export function formatPollDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/** Liste les sondages (et leurs options), du plus récent au plus ancien. */
export async function listPolls(): Promise<PollWithOptions[]> {
  const { data, error } = await supabase
    .from('polls')
    .select('*, options:poll_options(*)')
    .order('created_at', { ascending: false })
  if (error) throw error
  const polls = (data ?? []) as PollWithOptions[]
  // Tri des options par position (l'imbrication PostgREST ne garantit pas l'ordre).
  for (const poll of polls) {
    poll.options.sort((a, b) => a.position - b.position)
  }
  return polls
}

/**
 * Récupère le sondage ouvert le plus récent (avec ses options), ou null s'il
 * n'y en a aucun. Utilisé par l'encart de la page d'accueil.
 */
export async function getActivePoll(): Promise<PollWithOptions | null> {
  const { data, error } = await supabase
    .from('polls')
    .select('*, options:poll_options(*)')
    .eq('is_closed', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const poll = data as PollWithOptions
  poll.options.sort((a, b) => a.position - b.position)
  return poll
}

/**
 * Crée un sondage avec ses options (réservé admin par la RLS). Les libellés
 * vides sont ignorés ; l'appelant doit garantir au moins POLL_MIN_OPTIONS choix.
 */
export async function createPoll(
  question: string,
  optionLabels: string[],
  userId: string,
): Promise<PollWithOptions> {
  const labels = optionLabels.map((l) => l.trim()).filter((l) => l.length > 0)

  const { data: poll, error: pollError } = await supabase
    .from('polls')
    .insert({ question: question.trim(), created_by: userId })
    .select()
    .single()
  if (pollError) throw pollError

  const rows = labels.map((label, index) => ({
    poll_id: poll.id,
    label,
    position: index,
  }))
  const { data: options, error: optionsError } = await supabase
    .from('poll_options')
    .insert(rows)
    .select()
  if (optionsError) {
    // Nettoyage best-effort : sans options, le sondage est inutilisable.
    await supabase.from('polls').delete().eq('id', poll.id)
    throw optionsError
  }

  return { ...(poll as Poll), options: (options ?? []) as PollOption[] }
}

/** Clôture un sondage : fige les votes et rend les résultats visibles (admin). */
export async function closePoll(id: string): Promise<void> {
  const { error } = await supabase
    .from('polls')
    .update({ is_closed: true, closed_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

/** Supprime un sondage et, par cascade, ses options et votes (admin). */
export async function deletePoll(id: string): Promise<void> {
  const { error } = await supabase.from('polls').delete().eq('id', id)
  if (error) throw error
}

/**
 * Récupère les votes de l'utilisateur courant, indexés par `poll_id`
 * (valeur = `option_id` choisi). La RLS ne renvoie que ses propres votes.
 */
export async function getMyVotes(): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from('poll_votes')
    .select('poll_id, option_id')
  if (error) throw error
  const map: Record<string, string> = {}
  for (const row of data ?? []) map[row.poll_id] = row.option_id
  return map
}

/**
 * Enregistre (ou met à jour) le vote de l'utilisateur sur un sondage. Un seul
 * choix par sondage : un nouvel appel remplace le vote précédent.
 */
export async function castVote(
  pollId: string,
  optionId: string,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from('poll_votes')
    .upsert(
      { poll_id: pollId, option_id: optionId, user_id: userId },
      { onConflict: 'poll_id,user_id' },
    )
  if (error) throw error
}

/** Retire le vote de l'utilisateur sur un sondage (tant qu'il est ouvert). */
export async function retractVote(
  pollId: string,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from('poll_votes')
    .delete()
    .eq('poll_id', pollId)
    .eq('user_id', userId)
  if (error) throw error
}

/**
 * Récupère les résultats agrégés d'un sondage via la RPC. Renvoie un tableau
 * vide si le sondage est encore ouvert (et que l'appelant n'est pas admin).
 */
export async function getPollResults(pollId: string): Promise<PollResult[]> {
  const { data, error } = await supabase.rpc('get_poll_results', {
    p_poll_id: pollId,
  })
  if (error) throw error
  return (data ?? []).map((r: { option_id: string; label: string; votes: number }) => ({
    option_id: r.option_id,
    label: r.label,
    votes: Number(r.votes),
  }))
}
