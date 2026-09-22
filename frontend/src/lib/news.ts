import { supabase } from './supabase'

export type NewsLink = {
  url: string
  label: string | null
}

export type NewsItem = {
  id: string
  title: string
  content: string
  image_url: string | null
  links: NewsLink[]
  created_by: string | null
  created_at: string
}

export const NEWS_TITLE_MAX = 200
export const NEWS_CONTENT_MAX = 5000
export const NEWS_LINK_LABEL_MAX = 80
export const NEWS_LINKS_MAX = 5

/** Valeurs persistées d'une actualité (hors champs gérés par la BDD). */
export type NewsValues = {
  title: string
  content: string
  image_url: string | null
  links: NewsLink[]
}

/**
 * Normalise un lien saisi par l'utilisateur : trim, et préfixe `https://` s'il
 * manque un schéma. Renvoie null si vide.
 */
export function normalizeLink(raw: string): string | null {
  const trimmed = raw.trim()
  if (trimmed.length === 0) return null
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

/** Formate une date ISO en date lisible française (ex : « 7 juin 2026 »). */
export function formatNewsDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/** Liste les actualités, de la plus récente à la plus ancienne. */
export async function listNews(limit?: number): Promise<NewsItem[]> {
  let query = supabase
    .from('news')
    .select('*')
    .order('created_at', { ascending: false })
  if (limit !== undefined) query = query.limit(limit)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as NewsItem[]
}

/** Crée une actualité (réservé BDE par la RLS). */
export async function createNews(
  values: NewsValues,
  userId: string,
): Promise<NewsItem> {
  const { data, error } = await supabase
    .from('news')
    .insert({
      title: values.title.trim(),
      content: values.content.trim(),
      image_url: values.image_url,
      links: values.links,
      created_by: userId,
    })
    .select()
    .single()
  if (error) throw error
  return data as NewsItem
}

/** Met à jour une actualité (réservé BDE par la RLS). */
export async function updateNews(
  id: string,
  values: NewsValues,
): Promise<NewsItem> {
  const { data, error } = await supabase
    .from('news')
    .update({
      title: values.title.trim(),
      content: values.content.trim(),
      image_url: values.image_url,
      links: values.links,
    })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as NewsItem
}

/** Supprime une actualité (réservé BDE par la RLS). */
export async function deleteNews(id: string): Promise<void> {
  const { error } = await supabase.from('news').delete().eq('id', id)
  if (error) throw error
}
