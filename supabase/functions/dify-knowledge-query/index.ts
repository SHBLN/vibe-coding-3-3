import {
  type AnyModelConfig,
  callAnyModelChat,
  readAnyModelConfig,
} from '../_shared/anymodel.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const DEFAULT_DIFY_BASE_URL = 'https://api.dify.ai/v1'
const DEFAULT_RETRIEVE_PATH_TEMPLATE = '/datasets/{dataset_id}/retrieve'
const MAX_CONTEXT_CHUNKS = 5
const EMPTY_KB_ANSWER =
  'В базе знаний не найдено подходящих материалов по вашему запросу. Попробуйте переформулировать вопрос.'

type KnowledgeQueryRequest = {
  query?: string
  user?: string
  dataset_id?: string
  retrieval_model?: Record<string, unknown>
}

type KnowledgeSource = {
  segmentId: string
  documentName: string | null
  score: number | null
  excerpt: string
}

type DifySegment = {
  id?: string
  content?: string
  document?: { name?: string | null } | null
}

type DifyRecord = {
  segment?: DifySegment
  score?: number
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, '')
}

function buildRetrievePath(template: string, datasetId: string): string {
  if (template.includes('{dataset_id}')) {
    return template.replaceAll('{dataset_id}', datasetId)
  }

  const cleaned = template.trim().replace(/\/+$/, '')
  return `${cleaned}/${datasetId}/retrieve`
}

async function readProviderPayload(response: Response): Promise<Record<string, unknown>> {
  const raw = await response.text()
  if (!raw) return {}

  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return { raw }
  }
}

function parseDifyRecords(providerPayload: Record<string, unknown>): DifyRecord[] {
  const records = providerPayload.records
  if (!Array.isArray(records)) return []
  return records.filter((item): item is DifyRecord => typeof item === 'object' && item !== null)
}

function buildSources(records: DifyRecord[]): KnowledgeSource[] {
  return records.slice(0, MAX_CONTEXT_CHUNKS).map((record) => {
    const segment = record.segment ?? {}
    const content = typeof segment.content === 'string' ? segment.content.trim() : ''
    const excerpt = content.length > 400 ? `${content.slice(0, 400)}…` : content

    return {
      segmentId: typeof segment.id === 'string' ? segment.id : '',
      documentName:
        typeof segment.document?.name === 'string' ? segment.document.name : null,
      score: typeof record.score === 'number' ? record.score : null,
      excerpt,
    }
  })
}

function buildRagContext(sources: KnowledgeSource[]): string {
  if (sources.length === 0) return ''

  return sources
    .map((source, index) => {
      const doc = source.documentName ? ` (${source.documentName})` : ''
      const score =
        source.score !== null ? `, релевантность ${source.score.toFixed(3)}` : ''
      return `[${index + 1}]${doc}${score}\n${source.excerpt}`
    })
    .join('\n\n')
}

function buildRagSystemPrompt(): string {
  return [
    'Ты ассистент по продукту AiVibeBoard.',
    'Отвечай на русском языке, кратко и по делу.',
    'Используй только факты из предоставленного контекста базы знаний.',
    'Если в контексте нет ответа, честно скажи, что в базе знаний этого нет.',
    'Не выдумывай функции, тарифы и интеграции.',
  ].join('\n')
}

function buildRagUserPrompt(query: string, context: string): string {
  return ['Контекст из базы знаний:', context, '', `Вопрос пользователя: ${query}`].join('\n')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const difyApiKey = Deno.env.get('DIFY_KNOWLEDGE_API_KEY')
  const defaultDatasetId = Deno.env.get('DIFY_KNOWLEDGE_DATASET_ID')
  const difyBaseUrl = normalizeBaseUrl(Deno.env.get('DIFY_KNOWLEDGE_BASE_URL') ?? DEFAULT_DIFY_BASE_URL)
  const retrievePathTemplate = Deno.env.get('DIFY_KNOWLEDGE_RETRIEVE_PATH') ?? DEFAULT_RETRIEVE_PATH_TEMPLATE
  const anyModelEnv = readAnyModelConfig()

  const missingKeys: string[] = []
  if (!difyApiKey) missingKeys.push('DIFY_KNOWLEDGE_API_KEY')
  if ('missingKeys' in anyModelEnv) missingKeys.push(...anyModelEnv.missingKeys)

  if (missingKeys.length > 0) {
    return jsonResponse({ error: 'Server is not configured', missingKeys }, 500)
  }

  const anyModelConfig = anyModelEnv as AnyModelConfig

  let payload: KnowledgeQueryRequest
  try {
    payload = (await req.json()) as KnowledgeQueryRequest
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }

  const query = payload.query?.trim()
  if (!query) {
    return jsonResponse({ error: 'query is required' }, 400)
  }
  const datasetId = payload.dataset_id?.trim() || defaultDatasetId
  if (!datasetId) {
    return jsonResponse(
      {
        error: 'dataset_id is required',
        hint: 'Set DIFY_KNOWLEDGE_DATASET_ID secret or pass dataset_id in request body',
      },
      400,
    )
  }

  const retrievePath = buildRetrievePath(retrievePathTemplate, datasetId)
  const endpoint = `${difyBaseUrl}${retrievePath.startsWith('/') ? retrievePath : `/${retrievePath}`}`

  const defaultRetrievalModel = {
    search_method: 'semantic_search',
    reranking_enable: false,
    top_k: MAX_CONTEXT_CHUNKS,
    score_threshold_enabled: false,
  }

  const providerResponse = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${difyApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      user: payload.user ?? 'supabase-edge-function',
      retrieval_model: payload.retrieval_model ?? defaultRetrievalModel,
    }),
  })

  const providerPayload = await readProviderPayload(providerResponse)

  if (!providerResponse.ok) {
    return jsonResponse(
      {
        error: 'Dify Knowledge request failed',
        providerStatus: providerResponse.status,
        providerPayload,
      },
      502,
    )
  }

  const records = parseDifyRecords(providerPayload)
  const sources = buildSources(records)

  if (sources.length === 0 || sources.every((source) => !source.excerpt)) {
    return jsonResponse({
      ok: true,
      query,
      datasetId,
      answer: EMPTY_KB_ANSWER,
      sources: [],
    })
  }

  const context = buildRagContext(sources)

  try {
    const answer = await callAnyModelChat(
      anyModelConfig,
      buildRagSystemPrompt(),
      buildRagUserPrompt(query, context),
      { temperature: 0.3, maxTokens: 1200 },
    )

    return jsonResponse({
      ok: true,
      query,
      datasetId,
      answer: answer.trim(),
      sources,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'LLM request failed'
    return jsonResponse({ error: message }, 502)
  }
})
