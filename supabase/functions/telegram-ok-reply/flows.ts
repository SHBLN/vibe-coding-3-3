import { createClient } from 'npm:@supabase/supabase-js@2'
import {
  BOARD_CALLBACK_PREFIX,
  MAIN_KEYBOARD,
  REPLY_TEXT,
  SESSION_STATE_AWAIT_TASK,
  SESSION_STATE_PROCESSING,
  answerCallbackQuery,
  buildBoardInlineKeyboard,
  clearTaskSession,
  fetchBoardForOwner,
  fetchBoardsForOwner,
  formatBoardList,
  isBoardsRequest,
  isCancelCommand,
  isCreateTaskRequest,
  isStartCommand,
  isUpdateAlreadyProcessed,
  loadTaskSession,
  markSessionProcessing,
  markUpdateProcessed,
  resolveLinkedProfile,
  saveTaskSession,
  sendTelegramMessage,
  touchTelegramProfileLink,
  upsertTelegramProfileLink,
} from './botCore.ts'
import { getAiSplitDenialReason } from '../_shared/planLimits.ts'
import type {
  AiSplitResponse,
  ProfileRow,
  TaskSessionRow,
  TelegramCallbackQuery,
  TelegramUpdate,
} from './types.ts'

function formatTaskCreationSummary(result: AiSplitResponse, boardTitle: string): string {
  const epicTitle = result.epic?.title ?? 'Без названия'
  const subtaskCount = result.subtasks?.length ?? 0
  const assigneeNames = [...new Set((result.subtasks ?? []).map((item) => item.assigneeName))]

  const lines = [
    `Задача создана на доске «${boardTitle}»`,
    `Эпик: ${epicTitle}`,
    `Подзадач: ${subtaskCount}`,
  ]

  if (assigneeNames.length > 0) {
    lines.push(`Исполнители: ${assigneeNames.join(', ')}`)
  }

  return lines.join('\n')
}

async function invokeAiTaskSplit(
  supabaseUrl: string,
  serviceRoleKey: string,
  profileId: string,
  boardId: string,
  title: string,
): Promise<AiSplitResponse> {
  const internalSecret = Deno.env.get('TELEGRAM_INTERNAL_SECRET')
  if (!internalSecret) {
    throw new Error('TELEGRAM_INTERNAL_SECRET is not configured')
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/anymodel-chat`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
      'Content-Type': 'application/json',
      'x-telegram-internal-secret': internalSecret,
    },
    body: JSON.stringify({
      profileId,
      boardId,
      title,
      description: title,
    }),
  })

  const result = (await response.json()) as AiSplitResponse
  if (!response.ok) {
    throw new Error(result.error ?? `AI split failed (${response.status})`)
  }

  return result
}

async function startCreateTaskFlow(
  botToken: string,
  chatId: number,
  profile: ProfileRow,
  supabase: ReturnType<typeof createClient>,
): Promise<{ action: string }> {
  const boards = await fetchBoardsForOwner(supabase, profile.id)
  if (boards.length === 0) {
    await sendTelegramMessage(botToken, chatId, 'У вас пока нет досок. Сначала создайте доску в веб-приложении.', MAIN_KEYBOARD)
    return { action: 'create_task_no_boards' }
  }

  if (boards.length === 1) {
    await saveTaskSession(supabase, {
      chat_id: chatId,
      profile_id: profile.id,
      selected_board_id: boards[0].id,
      state: SESSION_STATE_AWAIT_TASK,
    })
    await sendTelegramMessage(
      botToken,
      chatId,
      `Доска «${boards[0].title}» выбрана.\nОтправьте текст глобальной задачи.\n\n/cancel — отменить.`,
      MAIN_KEYBOARD,
    )
    return { action: 'create_task_auto_board' }
  }

  await clearTaskSession(supabase, chatId)
  await sendTelegramMessage(
    botToken,
    chatId,
    'Выберите доску для новой задачи:',
    buildBoardInlineKeyboard(boards),
  )
  return { action: 'create_task_pick_board' }
}

export async function handleBoardSelectionCallback(
  botToken: string,
  chatId: number,
  callbackQuery: TelegramCallbackQuery,
  supabase: ReturnType<typeof createClient>,
): Promise<{ action: string }> {
  await answerCallbackQuery(botToken, callbackQuery.id)

  const linked = await resolveLinkedProfile(supabase, { callback_query: callbackQuery } as TelegramUpdate)
  if ('error' in linked) {
    await sendTelegramMessage(botToken, chatId, linked.error, MAIN_KEYBOARD)
    return { action: 'create_task_profile_error' }
  }

  await upsertTelegramProfileLink(
    supabase,
    linked.profile.id,
    chatId,
    linked.telegramUsername,
  )

  const callbackData = callbackQuery.data ?? ''
  if (!callbackData.startsWith(BOARD_CALLBACK_PREFIX)) {
    await sendTelegramMessage(botToken, chatId, 'Неизвестная команда.', MAIN_KEYBOARD)
    return { action: 'callback_unknown' }
  }

  const boardId = callbackData.slice(BOARD_CALLBACK_PREFIX.length)
  const board = await fetchBoardForOwner(supabase, boardId, linked.profile.id)
  if (!board) {
    await sendTelegramMessage(botToken, chatId, 'Доска не найдена или недоступна.', MAIN_KEYBOARD)
    return { action: 'create_task_board_denied' }
  }

  await saveTaskSession(supabase, {
    chat_id: chatId,
    profile_id: linked.profile.id,
    selected_board_id: board.id,
    state: SESSION_STATE_AWAIT_TASK,
  })

  await sendTelegramMessage(
    botToken,
    chatId,
    `Доска «${board.title}» выбрана.\nОтправьте текст глобальной задачи.\n\n/cancel — отменить.`,
    MAIN_KEYBOARD,
  )
  return { action: 'create_task_board_selected' }
}

async function handleAwaitTaskText(
  botToken: string,
  chatId: number,
  text: string,
  updateId: number,
  session: TaskSessionRow,
  supabase: ReturnType<typeof createClient>,
  supabaseUrl: string,
  serviceRoleKey: string,
): Promise<{ action: string; count?: number }> {
  if (await isUpdateAlreadyProcessed(supabase, updateId)) {
    return { action: 'create_task_duplicate_update' }
  }

  if (session.state === SESSION_STATE_PROCESSING) {
    return { action: 'create_task_already_processing' }
  }

  if (!session.selected_board_id) {
    await clearTaskSession(supabase, chatId)
    await sendTelegramMessage(botToken, chatId, 'Доска не выбрана. Нажмите «Создать задачу» снова.', MAIN_KEYBOARD)
    return { action: 'create_task_missing_board' }
  }

  const board = await fetchBoardForOwner(supabase, session.selected_board_id, session.profile_id)
  if (!board) {
    await clearTaskSession(supabase, chatId)
    await sendTelegramMessage(botToken, chatId, 'Доска недоступна. Выберите другую.', MAIN_KEYBOARD)
    return { action: 'create_task_board_denied' }
  }

  const locked = await markSessionProcessing(supabase, session)
  if (!locked) {
    return { action: 'create_task_already_processing' }
  }

  const aiDenial = await getAiSplitDenialReason(supabase, session.profile_id)
  if (aiDenial) {
    await clearTaskSession(supabase, chatId)
    await sendTelegramMessage(botToken, chatId, aiDenial, MAIN_KEYBOARD)
    return { action: 'create_task_plan_denied' }
  }

  await sendTelegramMessage(botToken, chatId, 'Обрабатываю задачу через AI...', MAIN_KEYBOARD)

  try {
    const result = await invokeAiTaskSplit(
      supabaseUrl,
      serviceRoleKey,
      session.profile_id,
      board.id,
      text,
    )
    await markUpdateProcessed(supabase, updateId, chatId)
    await clearTaskSession(supabase, chatId)
    await sendTelegramMessage(
      botToken,
      chatId,
      formatTaskCreationSummary(result, result.boardTitle ?? board.title),
      MAIN_KEYBOARD,
    )
    return { action: 'create_task_success', count: result.subtasks?.length ?? 0 }
  } catch (err) {
    await clearTaskSession(supabase, chatId)
    const message = err instanceof Error ? err.message : 'Не удалось создать задачу через AI'
    const userMessage = message.includes('No profiles with selected roles')
      ? 'Не удалось распределить задачи: в системе нет профилей с выбранными ролями.'
      : `Не удалось создать задачу: ${message}`
    await sendTelegramMessage(botToken, chatId, userMessage, MAIN_KEYBOARD)
    return { action: 'create_task_failed' }
  }
}

export async function handleIncomingMessage(
  botToken: string,
  chatId: number,
  text: string,
  update: TelegramUpdate,
  supabase: ReturnType<typeof createClient>,
  supabaseUrl: string,
  serviceRoleKey: string,
): Promise<{ action: string; count?: number }> {
  const session = await loadTaskSession(supabase, chatId)

  try {
    await touchTelegramProfileLink(supabase, update, chatId)
  } catch (err) {
    console.error(err instanceof Error ? err.message : 'Failed to upsert telegram profile link')
  }

  if (isCancelCommand(text)) {
    await clearTaskSession(supabase, chatId)
    await sendTelegramMessage(botToken, chatId, 'Создание задачи отменено.', MAIN_KEYBOARD)
    return { action: 'create_task_cancelled' }
  }

  if (
    session &&
    (session.state === SESSION_STATE_AWAIT_TASK || session.state === SESSION_STATE_PROCESSING) &&
    text &&
    !isStartCommand(text) &&
    !isBoardsRequest(text) &&
    !isCreateTaskRequest(text)
  ) {
    return handleAwaitTaskText(
      botToken,
      chatId,
      text,
      update.update_id,
      session,
      supabase,
      supabaseUrl,
      serviceRoleKey,
    )
  }

  if (isStartCommand(text)) {
    await clearTaskSession(supabase, chatId)
    await sendTelegramMessage(
      botToken,
      chatId,
      'Привет! Здесь можно посмотреть ваши доски или создать глобальную задачу через AI.',
      MAIN_KEYBOARD,
    )
    return { action: 'start' }
  }

  if (isBoardsRequest(text)) {
    const linked = await resolveLinkedProfile(supabase, update)
    if ('error' in linked) {
      await sendTelegramMessage(botToken, chatId, linked.error, MAIN_KEYBOARD)
      return { action: 'boards_list_profile_error' }
    }

    const boards = await fetchBoardsForOwner(supabase, linked.profile.id)
    await sendTelegramMessage(botToken, chatId, formatBoardList(boards), MAIN_KEYBOARD)
    return { action: 'boards_list', count: boards.length }
  }

  if (isCreateTaskRequest(text)) {
    const linked = await resolveLinkedProfile(supabase, update)
    if ('error' in linked) {
      await sendTelegramMessage(botToken, chatId, linked.error, MAIN_KEYBOARD)
      return { action: 'create_task_profile_error' }
    }

    return startCreateTaskFlow(botToken, chatId, linked.profile, supabase)
  }

  await sendTelegramMessage(botToken, chatId, REPLY_TEXT, MAIN_KEYBOARD)
  return { action: 'fallback_ok' }
}
