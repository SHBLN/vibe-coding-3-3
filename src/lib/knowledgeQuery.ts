import { supabase } from './supabase'

export type KnowledgeQuerySource = {
  segmentId: string
  documentName: string | null
  score: number | null
  excerpt: string
}

export type KnowledgeQuerySuccess = {
  ok: true
  query: string
  datasetId: string
  answer: string
  sources: KnowledgeQuerySource[]
}

export type KnowledgeQueryError = {
  error: string
  missingKeys?: string[]
  providerStatus?: number
}

export async function queryKnowledgeBase(query: string): Promise<KnowledgeQuerySuccess> {
  const trimmed = query.trim()
  if (!trimmed) {
    throw new Error('query is required')
  }

  const { data, error } = await supabase.functions.invoke<
    KnowledgeQuerySuccess | KnowledgeQueryError
  >('dify-knowledge-query', {
    body: { query: trimmed },
  })

  if (error) {
    throw new Error(error.message)
  }

  if (!data || 'error' in data) {
    throw new Error(data?.error ?? 'Knowledge query failed')
  }

  return data
}
