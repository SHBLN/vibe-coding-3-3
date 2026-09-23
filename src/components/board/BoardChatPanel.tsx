import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import type { BoardCreationBillingAction } from '../../lib/boards'
import type { BoardMessage } from '../../lib/boardChat'
import { ButtonPrimary } from '../landing/ui'

type BoardChatPanelProps = {
  boardId: string
  currentUserId: string | null
  messages: BoardMessage[]
  loading: boolean
  sending: boolean
  error: string | null
  aiSplitEnabled: boolean
  aiSplitBlockedMessage: string | null
  aiSplitBillingAction: BoardCreationBillingAction | null
  onSendMessage: (body: string) => Promise<void>
}

function formatMessageDate(iso: string) {
  return new Date(iso).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function AiStatusBadge({ message }: { message: BoardMessage }) {
  if (message.aiRunStatus === 'processing') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-accent">
        <span className="h-1 w-1 animate-pulse rounded-full bg-accent" />
        AI…
      </span>
    )
  }

  if (message.aiRunStatus === 'success') {
    return (
      <span className="text-[10px] font-medium text-emerald-700">Задачи созданы</span>
    )
  }

  return <span className="text-[10px] font-medium text-red-600">Ошибка AI</span>
}

function MessageItem({ message, isOwn }: { message: BoardMessage; isOwn: boolean }) {
  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-full rounded-xl border px-2.5 py-2 ${
          isOwn ? 'border-accent/15 bg-accent/5' : 'border-navy/8 bg-surface-alt/50'
        }`}
      >
        <div className="mb-1 flex items-baseline justify-between gap-2">
          <p className="truncate text-[11px] font-semibold text-navy">{message.authorName}</p>
          <p className="shrink-0 text-[10px] text-navy/40">{formatMessageDate(message.createdAt)}</p>
        </div>

        <p className="whitespace-pre-wrap text-xs leading-relaxed text-navy/75">{message.body}</p>

        <div className="mt-1.5 space-y-0.5">
          <AiStatusBadge message={message} />
          {message.aiResultSummary ? (
            <p className="line-clamp-2 text-[10px] leading-snug text-navy/50">
              {message.aiResultSummary}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export function BoardChatPanel({
  boardId,
  currentUserId,
  messages,
  loading,
  sending,
  error,
  aiSplitEnabled,
  aiSplitBlockedMessage,
  aiSplitBillingAction,
  onSendMessage,
}: BoardChatPanelProps) {
  const [draft, setDraft] = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const node = listRef.current
    if (!node) return
    node.scrollTop = node.scrollHeight
  }, [messages.length, messages[messages.length - 1]?.aiRunStatus])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmed = draft.trim()
    if (!trimmed || sending || !aiSplitEnabled) return

    setSubmitError(null)

    try {
      await onSendMessage(trimmed)
      setDraft('')
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Не удалось отправить сообщение.')
    }
  }

  return (
    <aside className="flex min-h-[280px] w-full min-w-0 max-h-[min(420px,50vh)] flex-col overflow-hidden rounded-xl border border-navy/10 bg-white shadow-sm xl:max-h-[calc(100vh-5.75rem)]">
      <div className="border-b border-navy/8 px-3 py-2.5">
        <h2 className="text-sm font-bold text-navy">Чат задач</h2>
        <p className="mt-0.5 text-[11px] leading-snug text-navy/45">
          {aiSplitEnabled
            ? 'Сообщение → эпик и подзадачи в backlog.'
            : 'ИИ-разбиение недоступно на вашем тарифе.'}
        </p>
      </div>

      {!aiSplitEnabled && aiSplitBlockedMessage ? (
        <div className="border-b border-amber-400/25 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-900">
          <p>{aiSplitBlockedMessage}</p>
          {aiSplitBillingAction ? (
            <Link
              to="/billing?plan=pro"
              className="mt-1 inline-block font-semibold text-accent underline-offset-2 hover:underline"
            >
              {aiSplitBillingAction === 'upgrade' ? 'Перейти на Pro' : 'Оформить подписку'}
            </Link>
          ) : null}
        </div>
      ) : null}

      <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto px-2.5 py-2">
        {loading ? (
          <p className="text-xs text-navy/45">Загрузка…</p>
        ) : messages.length === 0 ? (
          <div className="rounded-lg border border-dashed border-navy/10 px-2.5 py-3 text-[11px] text-navy/50">
            Например: «Запустить MVP за 2 недели».
          </div>
        ) : (
          messages.map((message) => (
            <MessageItem
              key={message.id}
              message={message}
              isOwn={message.authorId === currentUserId}
            />
          ))
        )}
      </div>

      <form onSubmit={handleSubmit} className="border-t border-navy/8 p-2.5">
        {error || submitError ? (
          <p className="mb-1.5 text-[11px] text-red-600" role="alert">
            {submitError ?? error}
          </p>
        ) : null}

        <label htmlFor={`board-chat-input-${boardId}`} className="sr-only">
          Сообщение для постановки задачи
        </label>
        <textarea
          id={`board-chat-input-${boardId}`}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={2}
          placeholder="Глобальная задача…"
          disabled={sending || !aiSplitEnabled}
          className="w-full resize-none rounded-lg border border-navy/10 bg-surface-alt/30 px-2.5 py-2 text-xs text-navy outline-none transition focus:border-accent/40 focus:ring-1 focus:ring-accent/20 disabled:opacity-60"
        />

        <div className="mt-2 flex justify-end">
          <ButtonPrimary
            type="submit"
            disabled={sending || !draft.trim() || !aiSplitEnabled}
            className="!px-3 !py-1.5 !text-xs"
          >
            {sending ? '…' : 'Поставить'}
          </ButtonPrimary>
        </div>
      </form>
    </aside>
  )
}
