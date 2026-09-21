import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AccountBadge } from '../components/landing/AccountBadge'
import { ButtonPrimary, LogoIcon } from '../components/landing/ui'
import { useAuth } from '../hooks/useAuth'
import {
  fetchCurrentSubscription,
  formatPlanLabel,
  type BillingSubscriptionRow,
} from '../lib/billing'
import {
  BoardLimitError,
  createBoard as createBoardInDb,
  deleteBoard as deleteBoardInDb,
  listBoards,
  updateBoard as updateBoardInDb,
  type Board,
  type BoardCreationBillingAction,
} from '../lib/boards'
import { isActiveSubscription, maxBoardsForPlan } from '../lib/planLimits'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function getBoardCreationBlockReason(
  subscription: BillingSubscriptionRow | null,
  boardCount: number,
): { message: string; billingAction: BoardCreationBillingAction } | null {
  if (!subscription) {
    return {
      message: 'Для создания проекта нужна активная подписка.',
      billingAction: 'subscribe',
    }
  }

  if (!isActiveSubscription(subscription)) {
    return {
      message: 'Подписка неактивна. Обновите оплату в разделе «Биллинг».',
      billingAction: 'subscribe',
    }
  }

  const boardLimit = maxBoardsForPlan(subscription.plan_id)
  if (boardLimit !== null && boardCount >= boardLimit) {
    return {
      message: `На тарифе ${formatPlanLabel(subscription.plan_id)} доступно проектов: ${boardLimit}.`,
      billingAction: 'upgrade',
    }
  }

  return null
}

function CloseIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function FormField({
  id,
  label,
  value,
  onChange,
  placeholder,
  required = true,
  disabled = false,
  multiline = false,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  required?: boolean
  disabled?: boolean
  multiline?: boolean
}) {
  const inputClassName =
    'w-full rounded-2xl border border-navy/15 bg-surface px-4 py-3 text-sm text-navy outline-none transition placeholder:text-navy/40 focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-60'

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-semibold text-navy">
        {label}
      </label>
      {multiline ? (
        <textarea
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          rows={3}
          className={`${inputClassName} resize-none`}
        />
      ) : (
        <input
          id={id}
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          className={inputClassName}
        />
      )}
    </div>
  )
}

function BoardFormModal({
  isOpen,
  title,
  submitLabel,
  initialTitle,
  initialDescription,
  onClose,
  onSubmit,
}: {
  isOpen: boolean
  title: string
  submitLabel: string
  initialTitle?: string
  initialDescription?: string
  onClose: () => void
  onSubmit: (payload: { title: string; description: string }) => Promise<void>
}) {
  const formId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const [boardTitle, setBoardTitle] = useState(initialTitle ?? '')
  const [description, setDescription] = useState(initialDescription ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [billingAction, setBillingAction] = useState<BoardCreationBillingAction | null>(null)

  useEffect(() => {
    if (!isOpen) return
    setBoardTitle(initialTitle ?? '')
    setDescription(initialDescription ?? '')
    setError(null)
    setBillingAction(null)
    setSubmitting(false)
  }, [isOpen, initialTitle, initialDescription])

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submitting) onClose()
    }

    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    panelRef.current?.focus()

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose, submitting])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setBillingAction(null)

    const trimmedTitle = boardTitle.trim()
    if (!trimmedTitle) {
      setError('Введите название доски.')
      return
    }

    setSubmitting(true)
    try {
      await onSubmit({ title: trimmedTitle, description: description.trim() })
      onClose()
    } catch (err) {
      if (err instanceof BoardLimitError) {
        setError(err.message)
        setBillingAction(err.billingAction)
      } else {
        setError(err instanceof Error ? err.message : 'Не удалось сохранить доску.')
        setBillingAction(null)
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onMouseDown={(event) => {
        if (!submitting && event.target === event.currentTarget) onClose()
      }}
    >
      <div className="absolute inset-0 bg-navy/60 backdrop-blur-sm modal-overlay" aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${formId}-title`}
        tabIndex={-1}
        className="modal-panel relative z-10 w-full max-w-md overflow-hidden rounded-4xl border border-navy/10 bg-white shadow-hero outline-none"
      >
        <div className="flex items-center justify-between border-b border-navy/10 px-6 py-5">
          <h2 id={`${formId}-title`} className="text-lg font-black tracking-tight text-navy">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Закрыть"
            className="rounded-full p-2 text-navy/50 transition hover:bg-navy/5 hover:text-navy disabled:opacity-50"
          >
            <CloseIcon />
          </button>
        </div>

        <form className="space-y-4 px-6 py-6" onSubmit={(event) => void handleSubmit(event)}>
          {error ? (
            <div
              className="rounded-2xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-700"
              role="alert"
            >
              <p>{error}</p>
              {billingAction ? (
                <Link
                  to="/billing"
                  className="mt-2 inline-block text-sm font-semibold text-navy underline decoration-accent underline-offset-2 hover:text-accent"
                >
                  {billingAction === 'upgrade' ? 'Перейти к тарифам Pro / Enterprise' : 'Оформить подписку в биллинге'}
                </Link>
              ) : null}
            </div>
          ) : null}

          <FormField
            id={`${formId}-title`}
            label="Название"
            value={boardTitle}
            onChange={setBoardTitle}
            placeholder="Например, Спринт 12"
            disabled={submitting}
          />

          <FormField
            id={`${formId}-description`}
            label="Описание"
            value={description}
            onChange={setDescription}
            placeholder="Кратко опишите назначение доски"
            required={false}
            disabled={submitting}
            multiline
          />

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 rounded-2xl border border-navy/15 px-4 py-3 text-sm font-semibold text-navy/70 transition hover:border-navy/30 hover:text-navy disabled:opacity-60"
            >
              Отмена
            </button>
            <ButtonPrimary
              type="submit"
              disabled={submitting}
              className="flex-1 justify-center py-3"
            >
              {submitting ? 'Сохраняем…' : submitLabel}
            </ButtonPrimary>
          </div>
        </form>
      </div>
    </div>
  )
}

function DeleteBoardModal({
  isOpen,
  boardTitle,
  onClose,
  onConfirm,
}: {
  isOpen: boolean
  boardTitle: string
  onClose: () => void
  onConfirm: () => Promise<void>
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !loading) onClose()
    }

    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    panelRef.current?.focus()

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose, loading])

  const handleConfirm = async () => {
    setLoading(true)
    try {
      await onConfirm()
      onClose()
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onMouseDown={(event) => {
        if (!loading && event.target === event.currentTarget) onClose()
      }}
    >
      <div className="absolute inset-0 bg-navy/60 backdrop-blur-sm modal-overlay" aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-board-title"
        tabIndex={-1}
        className="modal-panel relative z-10 w-full max-w-md overflow-hidden rounded-4xl border border-navy/10 bg-white shadow-hero outline-none"
      >
        <div className="border-b border-navy/10 px-6 py-5">
          <h2 id="delete-board-title" className="text-lg font-black tracking-tight text-navy">
            Удалить доску?
          </h2>
        </div>

        <div className="px-6 py-6">
          <p className="text-sm text-navy/70">
            Доска «<span className="font-semibold text-navy">{boardTitle}</span>» будет удалена
            без возможности восстановления.
          </p>

          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 rounded-2xl border border-navy/15 px-4 py-3 text-sm font-semibold text-navy/70 transition hover:border-navy/30 hover:text-navy disabled:opacity-60"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={() => void handleConfirm()}
              disabled={loading}
              className="flex-1 rounded-2xl bg-red-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Удаляем…' : 'Удалить'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function BoardsPage() {
  const navigate = useNavigate()
  const { account, loading, signOut } = useAuth()

  const [boards, setBoards] = useState<Board[]>([])
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null)
  const [boardsLoading, setBoardsLoading] = useState(true)
  const [boardsError, setBoardsError] = useState<string | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [boardToDelete, setBoardToDelete] = useState<Board | null>(null)
  const [subscription, setSubscription] = useState<BillingSubscriptionRow | null>(null)

  const loadBoards = useCallback(async () => {
    setBoardsError(null)
    setBoardsLoading(true)

    try {
      const [nextBoards, currentSubscription] = await Promise.all([
        listBoards(),
        fetchCurrentSubscription(),
      ])
      setSubscription(currentSubscription)
      setBoards(nextBoards)
      setSelectedBoardId((current) => {
        if (current && nextBoards.some((board) => board.id === current)) {
          return current
        }
        return nextBoards[0]?.id ?? null
      })
    } catch (err) {
      setBoards([])
      setSelectedBoardId(null)
      setBoardsError(err instanceof Error ? err.message : 'Не удалось загрузить доски.')
    } finally {
      setBoardsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!loading && account) {
      void loadBoards()
    }
  }, [loading, account, loadBoards])

  const selectedBoard = boards.find((board) => board.id === selectedBoardId) ?? null

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  const createBoard = useCallback(async (payload: { title: string; description: string }) => {
    const newBoard = await createBoardInDb(payload)
    setBoards((prev) => [newBoard, ...prev])
    setSelectedBoardId(newBoard.id)
  }, [])

  const updateBoard = useCallback(
    async (payload: { title: string; description: string }) => {
      if (!selectedBoardId) return

      const updatedBoard = await updateBoardInDb(selectedBoardId, payload)
      setBoards((prev) =>
        prev.map((board) => (board.id === updatedBoard.id ? updatedBoard : board)),
      )
    },
    [selectedBoardId],
  )

  const deleteBoard = useCallback(async () => {
    if (!boardToDelete) return

    await deleteBoardInDb(boardToDelete.id)

    setBoards((prev) => {
      const next = prev.filter((board) => board.id !== boardToDelete.id)
      if (selectedBoardId === boardToDelete.id) {
        setSelectedBoardId(next[0]?.id ?? null)
      }
      return next
    })
  }, [boardToDelete, selectedBoardId])

  if (loading || !account || boardsLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <span className="text-sm text-navy/50">Загрузка…</span>
      </div>
    )
  }

  const totalCards = boards.reduce(
    (sum, board) => sum + board.columns.reduce((colSum, column) => colSum + column.cards.length, 0),
    0,
  )

  const creationBlock = getBoardCreationBlockReason(subscription, boards.length)

  return (
    <div className="min-h-screen bg-gradient-to-b from-surface to-surface-alt">
      <header className="sticky top-0 z-30 border-b border-navy/10 bg-surface/95 backdrop-blur">
        <div className="section-shell flex h-20 items-center justify-between">
          <a
            href="/"
            aria-label="AiVibeBoard — на главную"
            className="flex items-center gap-2.5"
          >
            <div className="flex h-10 w-10 rotate-3 items-center justify-center rounded-2xl bg-navy text-accent shadow-card">
              <LogoIcon />
            </div>
            <span className="text-xl font-black tracking-[-0.04em] text-navy">
              AI VIBE<span className="text-accent">.</span>
            </span>
          </a>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              to="/billing"
              className="rounded-xl border border-navy/10 bg-white px-3 py-2 text-xs font-bold text-navy/70 transition hover:border-accent hover:text-accent"
            >
              Биллинг
            </Link>
            <Link
              to="/settings"
              className="rounded-xl border border-navy/10 bg-white px-3 py-2 text-xs font-bold text-navy/70 transition hover:border-accent hover:text-accent"
            >
              Настройки
            </Link>
            <AccountBadge account={account} onSignOut={handleSignOut} />
          </div>
        </div>
      </header>

      <main className="section-shell py-8">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-[-0.04em] text-navy">Доски задач</h1>
            <p className="mt-2 text-navy/60">
              Добро пожаловать, {account.displayName}. Управляйте досками команды.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="chip">Досок: {boards.length}</span>
              <span className="chip">Карточек: {totalCards}</span>
              <span className="chip">Профиль: {account.role}</span>
            </div>
          </div>
          <ButtonPrimary onClick={() => setIsCreateOpen(true)} className="shrink-0">
            + Создать доску
          </ButtonPrimary>
        </div>

        {boardsError ? (
          <div
            className="mb-6 rounded-2xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-700"
            role="alert"
          >
            {boardsError}
          </div>
        ) : null}

        {creationBlock ? (
          <div
            className="mb-6 rounded-2xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-950"
            role="status"
          >
            <p>{creationBlock.message}</p>
            <Link
              to="/billing"
              className="mt-2 inline-block font-semibold text-navy underline decoration-accent underline-offset-2 hover:text-accent"
            >
              {creationBlock.billingAction === 'upgrade'
                ? 'Перейти к тарифам Pro / Enterprise'
                : 'Оформить подписку в биллинге'}
            </Link>
          </div>
        ) : null}

        {boards.length === 0 ? (
          <div className="panel-shell border-dashed bg-surface px-8 py-16 text-center">
            <h2 className="text-xl font-black text-navy">Пока нет досок</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm text-navy/60">
              Создайте первую доску, чтобы начать работу с колонками и карточками.
            </p>
            <ButtonPrimary onClick={() => setIsCreateOpen(true)} className="mt-6">
              Создать доску
            </ButtonPrimary>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
            <aside className="motion-fade-in panel-shell space-y-3 p-4">
              <h2 className="px-1 text-xs font-bold uppercase tracking-wide text-navy/50">
                Ваши доски
              </h2>
              <ul className="space-y-2">
                {boards.map((board, boardIndex) => {
                  const isSelected = board.id === selectedBoardId
                  const cardCount = board.columns.reduce((sum, column) => sum + column.cards.length, 0)

                  return (
                    <li key={board.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedBoardId(board.id)}
                        className={`motion-stagger hover-lift group w-full rounded-2xl border p-4 text-left shadow-sm ${
                          isSelected
                            ? 'border-accent/40 bg-white shadow-card'
                            : 'border-navy/10 bg-surface hover:border-navy/20 hover:bg-white'
                        }`}
                        style={{ '--stagger-delay': `${boardIndex * 55}ms` } as CSSProperties}
                      >
                        <h3 className="text-sm font-black text-navy">{board.title}</h3>
                        {board.description ? (
                          <p className="mt-1 line-clamp-2 text-xs text-navy/50">{board.description}</p>
                        ) : null}
                        <p className="mt-2 text-xs font-semibold text-navy/40">
                          {board.columns.length} колонок · {cardCount} карточек
                        </p>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </aside>

            <section className="min-w-0">
              {selectedBoard ? (
                <div className="space-y-6">
                  <div className="motion-fade-in panel-shell p-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h2 className="text-2xl font-black tracking-tight text-navy">
                          {selectedBoard.title}
                        </h2>
                        {selectedBoard.description ? (
                          <p className="mt-2 text-sm text-navy/60">{selectedBoard.description}</p>
                        ) : (
                          <p className="mt-2 text-sm italic text-navy/40">Без описания</p>
                        )}
                        <p className="mt-3 text-xs text-navy/40">
                          Создана {formatDate(selectedBoard.createdAt)} · обновлена{' '}
                          {formatDate(selectedBoard.updatedAt)}
                        </p>
                      </div>

                      <div className="flex shrink-0 flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => navigate(`/boards/${selectedBoard.id}`)}
                          className="press-down rounded-xl bg-navy px-4 py-2 text-xs font-bold text-white hover:bg-navy-light"
                        >
                          Открыть доску
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsEditOpen(true)}
                          className="press-down rounded-xl border border-navy/10 bg-white px-4 py-2 text-xs font-bold text-navy/70 hover:border-accent hover:text-accent"
                        >
                          Изменить
                        </button>
                        <button
                          type="button"
                          onClick={() => setBoardToDelete(selectedBoard)}
                          className="press-down rounded-xl border border-red-200 bg-white px-4 py-2 text-xs font-bold text-red-600 hover:border-red-400 hover:bg-red-50"
                        >
                          Удалить
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    {selectedBoard.columns.map((column, columnIndex) => (
                      <section
                        key={column.id}
                        className="motion-stagger rounded-2xl border border-navy/10 bg-surface p-4 shadow-sm"
                        style={{ '--stagger-delay': `${columnIndex * 55}ms` } as CSSProperties}
                      >
                        <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-navy/50">
                          {column.title}
                        </h3>
                        {column.cards.length > 0 ? (
                          <ul className="space-y-3">
                            {column.cards.map((card, index) => (
                              <li
                                key={`${column.id}-${index}`}
                                className="motion-stagger hover-lift rounded-xl border border-navy/10 bg-white p-4 text-sm font-semibold text-navy shadow-sm"
                                style={{ '--stagger-delay': `${columnIndex * 55 + index * 35}ms` } as CSSProperties}
                              >
                                {card}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="rounded-2xl border border-dashed border-navy/10 bg-white/60 px-4 py-6 text-center text-xs text-navy/40">
                            Нет карточек
                          </p>
                        )}
                      </section>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="panel-shell border-dashed bg-surface px-8 py-16 text-center">
                  <p className="text-sm text-navy/60">Выберите доску из списка слева</p>
                </div>
              )}
            </section>
          </div>
        )}
      </main>

      <BoardFormModal
        isOpen={isCreateOpen}
        title="Новая доска"
        submitLabel="Создать"
        onClose={() => setIsCreateOpen(false)}
        onSubmit={createBoard}
      />

      <BoardFormModal
        isOpen={isEditOpen}
        title="Изменить доску"
        submitLabel="Сохранить"
        initialTitle={selectedBoard?.title}
        initialDescription={selectedBoard?.description}
        onClose={() => setIsEditOpen(false)}
        onSubmit={updateBoard}
      />

      <DeleteBoardModal
        isOpen={boardToDelete !== null}
        boardTitle={boardToDelete?.title ?? ''}
        onClose={() => setBoardToDelete(null)}
        onConfirm={deleteBoard}
      />
    </div>
  )
}
