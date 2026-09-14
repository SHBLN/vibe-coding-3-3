import { useEffect, useRef, useState, type FormEvent } from 'react'
import { getProfileInitials } from '../../lib/profiles'
import type { BoardMessage } from '../../lib/boardChat'
import { ButtonPrimary } from '../landing/ui'

type BoardChatPanelProps = {
  boardId: string
  currentUserId: string | null
  messages: BoardMessage[]
  loading: boolean
  sending: boolean
  error: string | null
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
      <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-semibold text-accent">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
        AI разбивает задачу…
      </span>
    )
  }

  if (message.aiRunStatus === 'success') {
    return (
      <span className="inline-flex rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
        Задачи созданы
      </span>
    )
  }

  return (
    <span className="inline-flex rounded-full bg-red-500/10 px-2 py-0.5 text-[11px] font-semibold text-red-600">
      Ошибка AI
    </span>
  )
}

function MessageItem({ message, isOwn }: { message: BoardMessage; isOwn: boolean }) {
  const initials = getProfileInitials(message.authorName)

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[92%] rounded-2xl border px-3 py-2.5 shadow-sm ${
          isOwn
            ? 'border-accent/20 bg-accent/10'
            : 'border-navy/10 bg-white'
        }`}
      >
        <div className="mb-1.5 flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-navy text-[10px] font-bold text-white">
            {initials}
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-navy">{message.authorName}</p>
            <p className="text-[10px] text-navy/40">{formatMessageDate(message.createdAt)}</p>
          </div>
        </div>

        <p className="whitespace-pre-wrap text-sm text-navy/80">{message.body}</p>

        <div className="mt-2 space-y-1">
          <AiStatusBadge message={message} />
          {message.aiResultSummary ? (
            <p className="text-[11px] text-navy/55">{message.aiResultSummary}</p>
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
    if (!trimmed || sending) return

    setSubmitError(null)

    try {
      await onSendMessage(trimmed)
      setDraft('')
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Не удалось отправить сообщение.')
    }
  }

  return (
    <aside className="sticky top-28 flex h-[calc(100vh-8.5rem)] w-full max-w-[360px] shrink-0 flex-col rounded-2xl border border-navy/10 bg-white shadow-sm">
      <div className="border-b border-navy/10 px-4 py-4">
        <h2 className="text-lg font-black tracking-[-0.03em] text-navy">Чат задач</h2>
        <p className="mt-1 text-xs text-navy/50">
          Каждое сообщение создаёт эпик и подзадачи в backlog доски.
        </p>
      </div>

      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-3 py-4">
        {loading ? (
          <p className="text-sm text-navy/45">Загрузка сообщений…</p>
        ) : messages.length === 0 ? (
          <div className="rounded-xl border border-dashed border-navy/10 bg-surface-alt/60 px-3 py-4 text-sm text-navy/50">
            Напишите глобальную задачу, например: «Запустить MVP за 2 недели».
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

      <form onSubmit={handleSubmit} className="border-t border-navy/10 p-4">
        {error || submitError ? (
          <p className="mb-2 text-xs text-red-600" role="alert">
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
          rows={3}
          placeholder="Опишите глобальную задачу…"
          disabled={sending}
          className="w-full resize-none rounded-xl border border-navy/10 bg-surface-alt/40 px-3 py-2 text-sm text-navy outline-none transition focus:border-accent/40 focus:ring-2 focus:ring-accent/15 disabled:opacity-60"
        />

        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-[11px] text-navy/40">Enter не отправляет — используйте кнопку.</p>
          <ButtonPrimary type="submit" disabled={sending || !draft.trim()}>
            {sending ? 'Обработка…' : 'Поставить задачу'}
          </ButtonPrimary>
        </div>
      </form>
    </aside>
  )
}
