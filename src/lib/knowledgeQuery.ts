import { supabase } from './supabase'
import { toResult, type Result, unwrapResult } from './result'

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

export async function queryKnowledgeBaseResult(query: string): Promise<Result<KnowledgeQuerySuccess>> {
  const trimmed = query.trim()
  if (!trimmed) {
    return { ok: false, error: 'query is required' }
  }

  return toResult(async () => {
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
  }, 'Knowledge query failed')
}

export async function queryKnowledgeBase(query: string): Promise<KnowledgeQuerySuccess> {
  const result = await queryKnowledgeBaseResult(query)
  return unwrapResult(result)
}
