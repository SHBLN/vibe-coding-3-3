import { createClient } from 'npm:@supabase/supabase-js@2'
import {
  extractChatId,
  extractMessageText,
  jsonResponse,
  readBotSecrets,
} from './botCore.ts'
import {
  handleBoardSelectionCallback,
  handleIncomingMessage,
} from './flows.ts'
import type { TelegramUpdate } from './types.ts'

Deno.serve(async (req) => {
  if (req.method === 'GET') {
    return new Response('ok', { status: 200 })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  const missingKeys: string[] = []
  if (!supabaseUrl) missingKeys.push('SUPABASE_URL')
  if (!serviceRoleKey) missingKeys.push('SUPABASE_SERVICE_ROLE_KEY')

  if (missingKeys.length > 0) {
    return jsonResponse({ error: 'Server is not configured', missingKeys }, 500)
  }

  const supabase = createClient(supabaseUrl!, serviceRoleKey!)

  let botToken: string
  let webhookSecret: string
  try {
    const secrets = await readBotSecrets(supabase)
    botToken = secrets.botToken
    webhookSecret = secrets.webhookSecret
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Telegram bot secrets are not configured'
    return jsonResponse({ error: message }, 500)
  }

  const incomingSecret = req.headers.get('x-telegram-bot-api-secret-token')
  if (incomingSecret !== webhookSecret) {
    return jsonResponse({ error: 'Unauthorized' }, 401)
  }

  let update: TelegramUpdate
  try {
    update = (await req.json()) as TelegramUpdate
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }

  if (update.callback_query) {
    const chatId = extractChatId(update)
    if (chatId === null) {
      return jsonResponse({ ok: true, skipped: 'no chat id in callback' })
    }

    try {
      const result = await handleBoardSelectionCallback(
        botToken,
        chatId,
        update.callback_query,
        supabase,
      )
      return jsonResponse({ ok: true, mode: 'webhook', ...result })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to handle callback'
      console.error(message)
      return jsonResponse({ error: message }, 502)
    }
  }

  const chatId = extractChatId(update)
  if (chatId === null) {
    return jsonResponse({ ok: true, skipped: 'no chat id' })
  }

  const text = extractMessageText(update)

  try {
    const result = await handleIncomingMessage(
      botToken,
      chatId,
      text,
      update,
      supabase,
      supabaseUrl!,
      serviceRoleKey!,
    )
    return jsonResponse({ ok: true, mode: 'webhook', ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to send Telegram message'
    console.error(message)
    return jsonResponse({ error: message }, 502)
  }
})
