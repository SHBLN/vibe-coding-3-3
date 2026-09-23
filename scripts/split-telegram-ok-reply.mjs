import fs from 'node:fs'
import path from 'node:path'

const fnDir = path.resolve(import.meta.dirname, '../supabase/functions/telegram-ok-reply')
const source = fs.readFileSync(path.join(fnDir, 'handlers.ts'), 'utf8')
const splitAt = source.indexOf('function formatTaskCreationSummary')

const exports = [
  ['async function resolveLinkedProfile', 'export async function resolveLinkedProfile'],
  ['async function upsertTelegramProfileLink', 'export async function upsertTelegramProfileLink'],
  ['async function touchTelegramProfileLink', 'export async function touchTelegramProfileLink'],
  ['async function fetchBoardsForOwner', 'export async function fetchBoardsForOwner'],
  ['async function fetchBoardForOwner', 'export async function fetchBoardForOwner'],
  ['function buildBoardInlineKeyboard', 'export function buildBoardInlineKeyboard'],
  ['function formatBoardList', 'export function formatBoardList'],
  ['async function loadTaskSession', 'export async function loadTaskSession'],
  ['async function saveTaskSession', 'export async function saveTaskSession'],
  ['async function clearTaskSession', 'export async function clearTaskSession'],
  ['async function isUpdateAlreadyProcessed', 'export async function isUpdateAlreadyProcessed'],
  ['async function markUpdateProcessed', 'export async function markUpdateProcessed'],
  ['async function markSessionProcessing', 'export async function markSessionProcessing'],
  ['async function answerCallbackQuery', 'export async function answerCallbackQuery'],
  ['function isStartCommand', 'export function isStartCommand'],
  ['function isCancelCommand', 'export function isCancelCommand'],
  ['function isBoardsRequest', 'export function isBoardsRequest'],
  ['function isCreateTaskRequest', 'export function isCreateTaskRequest'],
]

let botCore = source.slice(0, splitAt)
for (const [from, to] of exports) {
  botCore = botCore.replace(from, to)
}

const flowsHeader = `import { createClient } from 'npm:@supabase/supabase-js@2'
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
import type {
  AiSplitResponse,
  ProfileRow,
  TaskSessionRow,
  TelegramCallbackQuery,
  TelegramUpdate,
} from './types.ts'

`

const flows = flowsHeader + source.slice(splitAt)

fs.writeFileSync(path.join(fnDir, 'botCore.ts'), botCore)
fs.writeFileSync(path.join(fnDir, 'flows.ts'), flows)
fs.unlinkSync(path.join(fnDir, 'handlers.ts'))

console.log('botCore bytes', Buffer.byteLength(botCore))
console.log('flows bytes', Buffer.byteLength(flows))
