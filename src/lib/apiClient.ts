import { supabase } from './supabase'

const rawBaseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/$/, '')
}

export function isPythonApiEnabled(): boolean {
  return Boolean(rawBaseUrl && rawBaseUrl.trim())
}

function getApiBaseUrl(): string {
  if (!rawBaseUrl) {
    throw new Error('VITE_API_BASE_URL не задан.')
  }
  return normalizeBaseUrl(rawBaseUrl)
}

async function getAccessToken(): Promise<string> {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession()

  if (error) throw new Error(error.message)
  if (!session?.access_token) {
    throw new Error('Пользователь не авторизован.')
  }

  return session.access_token
}

function parseErrorDetail(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object') return fallback
  const record = payload as Record<string, unknown>
  const detail = record.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    return detail.map((item) => String(item)).join('; ')
  }
  if (typeof record.error === 'string') return record.error
  return fallback
}

export async function apiPublicRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers,
  })

  if (!response.ok) {
    let message = response.statusText || 'Ошибка API'
    try {
      const body = (await response.json()) as unknown
      message = parseErrorDetail(body, message)
    } catch {
      // ignore
    }
    throw new Error(message)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getAccessToken()
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${token}`)

  if (init.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers,
  })

  if (!response.ok) {
    let message = response.statusText || 'Ошибка API'
    try {
      const body = (await response.json()) as unknown
      message = parseErrorDetail(body, message)
    } catch {
      // ignore
    }
    throw new Error(message)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}
