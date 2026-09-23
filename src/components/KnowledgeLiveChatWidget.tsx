import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import {
  queryKnowledgeBase,
  type KnowledgeQuerySource,
} from '../lib/knowledgeQuery'
import { ButtonPrimary } from './landing/ui'

const STARTER_PROMPTS = [
  'Что такое AiVibeBoard?',
  'Какие тарифы у продукта?',
] as const

type ChatRole = 'user' | 'assistant'

type ChatMessage = {
  id: string
  role: ChatRole
  body: string
  sources?: KnowledgeQuerySource[]
  pending?: boolean
}

function normalizeKnowledgeError(message: string): string {
  const lower = message.toLowerCase()
  if (message === 'query is required' || lower.includes('query is required')) {
    return 'Введите вопрос — пустой запрос не отправляется.'
  }
  if (lower.includes('invalid json')) {
    return 'Некорректный запрос. Попробуйте ещё раз.'
  }
  if (lower.includes('not configured') || lower.includes('missingkeys')) {
    return 'Сервис базы знаний временно недоступен. Попробуйте позже.'
  }
  if (lower.includes('dify') || lower.includes('llm') || lower.includes('502')) {
    return 'Не удалось получить ответ от базы знаний. Попробуйте переформулировать вопрос.'
  }
  if (lower.includes('fetch') || lower.includes('network')) {
    return 'Проблема с сетью. Проверьте подключение и повторите запрос.'
  }
  return message || 'Не удалось получить ответ. Попробуйте ещё раз.'
}

function formatScore(score: number | null): string {
  if (score === null) return '—'
  return score.toFixed(2)
}

function ChatIcon({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path
        d="M21 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function CloseIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function SourcesList({ sources }: { sources: KnowledgeQuerySource[] }) {
  if (sources.length === 0) return null

  return (
    <div className="mt-2 space-y-1.5 border-t border-navy/8 pt-2">
      <p className="text-[10px] font-bold uppercase tracking-wide text-navy/40">Источники</p>
      <ul className="space-y-1.5">
        {sources.map((source) => (
          <li
            key={source.segmentId || `${source.documentName}-${source.excerpt.slice(0, 24)}`}
            className="rounded-lg bg-white/80 px-2 py-1.5 text-[10px] leading-snug text-navy/55"
          >
            <span className="font-semibold text-navy/70">
              {source.documentName ?? 'Документ'}
            </span>
            <span className="text-navy/35"> · score {formatScore(source.score)}</span>
            {source.excerpt ? (
              <p className="mt-0.5 line-clamp-2 text-navy/45">{source.excerpt}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  )
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[92%] rounded-2xl border px-3 py-2.5 ${
          isUser
            ? 'border-accent/20 bg-accent/10'
            : 'border-navy/10 bg-white shadow-sm'
        }`}
      >
        {message.pending ? (
          <p className="flex items-center gap-2 text-xs text-navy/50">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
            Ищем в базе знаний… ответ может занять до 40 с
          </p>
        ) : (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-navy/80">{message.body}</p>
        )}
        {!isUser && !message.pending && message.sources ? (
          <SourcesList sources={message.sources} />
        ) : null}
      </div>
    </div>
  )
}

export function KnowledgeLiveChatWidget() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const node = listRef.current
    if (!node || !open) return
    node.scrollTop = node.scrollHeight
  }, [messages, open])

  useEffect(() => {
    if (!open) return

    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [open])

  const submitQuery = async (rawQuery: string) => {
    const trimmed = rawQuery.trim()
    if (!trimmed || sending) return

    if (!open) setOpen(true)

    setError(null)
    setSending(true)

    const userId = `user-${Date.now()}`
    const pendingId = `assistant-pending-${Date.now()}`

    setMessages((prev) => [
      ...prev,
      { id: userId, role: 'user', body: trimmed },
      { id: pendingId, role: 'assistant', body: '', pending: true },
    ])
    setDraft('')

    try {
      const result = await queryKnowledgeBase(trimmed)
      setMessages((prev) =>
        prev.map((item) =>
          item.id === pendingId
            ? {
                id: `assistant-${Date.now()}`,
                role: 'assistant',
                body: result.answer.trim() || 'Ответ пустой. Попробуйте другой вопрос.',
                sources: result.sources,
              }
            : item,
        ),
      )
    } catch (err) {
      const friendly = normalizeKnowledgeError(
        err instanceof Error ? err.message : 'Knowledge query failed',
      )
      setError(friendly)
      setMessages((prev) => prev.filter((item) => item.id !== pendingId))
    } finally {
      setSending(false)
    }
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void submitQuery(draft)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void submitQuery(draft)
    }
  }

  const hasUnreadHint = sending

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex justify-end p-3 sm:p-5">
      <div className="pointer-events-auto flex max-w-full flex-col items-end gap-3">
        {open ? (
          <div
            role="dialog"
            aria-labelledby="kb-live-chat-heading"
            aria-modal="false"
            className="flex w-[min(100vw-1.5rem,380px)] flex-col overflow-hidden rounded-2xl border border-navy/10 bg-white shadow-hero"
          >
            <div className="flex items-start justify-between gap-2 border-b border-navy/8 bg-navy px-4 py-3">
              <div className="min-w-0">
                <h2 id="kb-live-chat-heading" className="text-sm font-black tracking-tight text-white">
                  Спросите про AiVibeBoard
                </h2>
                <p className="mt-0.5 text-[11px] leading-snug text-white/55">
                  База знаний: тарифы, возможности, сценарии.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Свернуть чат"
                className="shrink-0 rounded-lg p-1.5 text-white/60 transition hover:bg-white/10 hover:text-white"
              >
                <CloseIcon />
              </button>
            </div>

            <div
              ref={listRef}
              className="max-h-[min(340px,50vh)] min-h-[140px] space-y-3 overflow-y-auto bg-surface-alt/40 px-3 py-3"
            >
              {messages.length === 0 ? (
                <div className="rounded-xl border border-dashed border-navy/12 bg-white px-3 py-4 text-center">
                  <p className="text-xs text-navy/55">Задайте вопрос или выберите подсказку.</p>
                  <div className="mt-2 flex flex-wrap justify-center gap-2">
                    {STARTER_PROMPTS.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        disabled={sending}
                        onClick={() => void submitQuery(prompt)}
                        className="rounded-full border border-navy/10 bg-surface px-2.5 py-1 text-[11px] font-semibold text-navy/70 transition hover:border-accent/40 hover:text-accent disabled:opacity-50"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((message) => <MessageBubble key={message.id} message={message} />)
              )}
            </div>

            <form onSubmit={handleSubmit} className="border-t border-navy/8 bg-white px-3 py-3">
              {error ? (
                <p className="mb-2 text-[11px] text-red-600" role="alert">
                  {error}
                </p>
              ) : null}

              {messages.length > 0 ? (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {STARTER_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      disabled={sending}
                      onClick={() => void submitQuery(prompt)}
                      className="rounded-full border border-navy/10 bg-surface-alt/50 px-2 py-0.5 text-[10px] font-medium text-navy/55 transition hover:border-accent/30 hover:text-accent disabled:opacity-50"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              ) : null}

              <label htmlFor="kb-live-chat-input" className="sr-only">
                Вопрос к базе знаний
              </label>
              <textarea
                id="kb-live-chat-input"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleKeyDown}
                rows={2}
                disabled={sending}
                placeholder="Например: как работает Telegram-бот?"
                className="w-full resize-none rounded-xl border border-navy/10 bg-surface-alt/30 px-2.5 py-2 text-sm text-navy outline-none transition focus:border-accent/40 focus:ring-2 focus:ring-accent/15 disabled:opacity-60"
              />
              <div className="mt-2 flex items-center justify-between gap-2">
                <p className="hidden text-[10px] text-navy/40 sm:block">Enter — отправить</p>
                <ButtonPrimary
                  type="submit"
                  disabled={sending || !draft.trim()}
                  className="!ml-auto !px-3 !py-1.5 !text-xs"
                >
                  {sending ? 'Ждём…' : 'Спросить'}
                </ButtonPrimary>
              </div>
            </form>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          aria-controls={open ? 'kb-live-chat-heading' : undefined}
          className="relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent-dark text-white shadow-button transition hover:-translate-y-0.5 hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {open ? <CloseIcon className="h-6 w-6" /> : <ChatIcon className="h-6 w-6" />}
          {!open && hasUnreadHint ? (
            <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-accent-light" />
          ) : null}
          <span className="sr-only">{open ? 'Закрыть чат поддержки' : 'Открыть чат поддержки'}</span>
        </button>
      </div>
    </div>
  )
}
