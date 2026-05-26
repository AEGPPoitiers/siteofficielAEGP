import { supabase } from './supabase'

const API_URL = import.meta.env.VITE_API_URL

/**
 * Erreur levée quand le backend renvoie un statut HTTP non-2xx.
 * `body` contient le JSON (ou le texte) renvoyé par l'API si disponible.
 */
export class ApiError extends Error {
  status: number
  body: unknown

  constructor(message: string, status: number, body: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

type ApiFetchOptions = Omit<RequestInit, 'body'> & {
  /** Corps de requête — sera JSON.stringify automatiquement (sauf FormData). */
  body?: unknown
  /** Attacher le JWT Supabase (défaut: true). Mettre `false` pour un endpoint public. */
  auth?: boolean
}

async function apiFetch<T = unknown>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  if (!API_URL) {
    throw new Error(
      "VITE_API_URL n'est pas défini. Ajoute-le dans frontend/.env",
    )
  }

  const { body, auth = true, headers, ...rest } = options
  const finalHeaders = new Headers(headers)

  const isFormData = body instanceof FormData
  if (body !== undefined && !isFormData && !finalHeaders.has('Content-Type')) {
    finalHeaders.set('Content-Type', 'application/json')
  }

  if (auth) {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (token) {
      finalHeaders.set('Authorization', `Bearer ${token}`)
    }
  }

  const url = `${API_URL}${path.startsWith('/') ? path : `/${path}`}`

  const response = await fetch(url, {
    ...rest,
    headers: finalHeaders,
    body:
      body === undefined
        ? undefined
        : isFormData
          ? (body as FormData)
          : JSON.stringify(body),
  })

  const contentType = response.headers.get('Content-Type') ?? ''
  const payload = contentType.includes('application/json')
    ? await response.json().catch(() => null)
    : await response.text().catch(() => null)

  if (!response.ok) {
    throw new ApiError(
      `Requête ${rest.method ?? 'GET'} ${path} échouée (${response.status})`,
      response.status,
      payload,
    )
  }

  return payload as T
}

export function apiGet<T = unknown>(path: string, options?: ApiFetchOptions) {
  return apiFetch<T>(path, { ...options, method: 'GET' })
}

export function apiPost<T = unknown>(
  path: string,
  body?: unknown,
  options?: ApiFetchOptions,
) {
  return apiFetch<T>(path, { ...options, method: 'POST', body })
}

export function apiPut<T = unknown>(
  path: string,
  body?: unknown,
  options?: ApiFetchOptions,
) {
  return apiFetch<T>(path, { ...options, method: 'PUT', body })
}

export function apiPatch<T = unknown>(
  path: string,
  body?: unknown,
  options?: ApiFetchOptions,
) {
  return apiFetch<T>(path, { ...options, method: 'PATCH', body })
}

export function apiDelete<T = unknown>(path: string, options?: ApiFetchOptions) {
  return apiFetch<T>(path, { ...options, method: 'DELETE' })
}

export { apiFetch }
