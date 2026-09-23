export const DEFAULT_ANYMODEL_BASE_URL = 'https://anymodel.org/v1'
export const DEFAULT_ANYMODEL_MODEL = 'cx/gpt-5.6-luna'

export type AnyModelConfig = {
  apiKey: string
  baseUrl: string
  model: string
}

export function readAnyModelConfig(): AnyModelConfig | { missingKeys: string[] } {
  const apiKey = Deno.env.get('ANYMODEL_API_KEY')
  const missingKeys: string[] = []
  if (!apiKey) missingKeys.push('ANYMODEL_API_KEY')
  if (missingKeys.length > 0) {
    return { missingKeys }
  }

  return {
    apiKey: apiKey!,
    baseUrl: (Deno.env.get('ANYMODEL_BASE_URL') ?? DEFAULT_ANYMODEL_BASE_URL).replace(/\/+$/, ''),
    model: Deno.env.get('ANYMODEL_MODEL') ?? DEFAULT_ANYMODEL_MODEL,
  }
}

export async function callAnyModelChat(
  config: AnyModelConfig,
  systemPrompt: string,
  userPrompt: string,
  options?: { temperature?: number; maxTokens?: number },
): Promise<string> {
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.model,
      temperature: options?.temperature ?? 0.2,
      max_tokens: options?.maxTokens ?? 2000,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  })

  const responseText = await response.text()
  let providerData: Record<string, unknown> | null = null

  if (responseText) {
    try {
      providerData = JSON.parse(responseText) as Record<string, unknown>
    } catch {
      providerData = { raw: responseText }
    }
  }

  if (!response.ok) {
    throw new Error(
      `AnyModel request failed (${response.status}): ${JSON.stringify(providerData)}`,
    )
  }

  const choices = providerData?.choices
  if (!Array.isArray(choices) || choices.length === 0) {
    throw new Error('AnyModel returned empty choices')
  }

  const message = choices[0] as { message?: { content?: string } }
  const content = message.message?.content
  if (!content || typeof content !== 'string') {
    throw new Error('AnyModel returned empty message content')
  }

  return content
}
