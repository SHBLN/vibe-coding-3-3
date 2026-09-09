import { useEffect, useId, useState, type FormEvent } from 'react'
import { AssigneePicker } from './AssigneePicker'
import { ButtonPrimary } from '../landing/ui'
import type { AssigneeProfile } from '../../lib/profiles'
import type { TaskPriority } from '../../mocks/boardViewMock'

export type TaskFormValues = {
  title: string
  priority: TaskPriority
  description: string | null
  dueAt: string | null
  assigneeIds: string[]
}

const PRIORITY_OPTIONS: Array<{ value: TaskPriority; label: string }> = [
  { value: 'low', label: 'Низкий' },
  { value: 'medium', label: 'Средний' },
  { value: 'high', label: 'Высокий' },
]

type TaskFormModalProps = {
  isOpen: boolean
  mode: 'create' | 'edit'
  columnTitle?: string
  initialTitle?: string
  initialPriority?: TaskPriority
  initialDescription?: string | null
  initialDueAt?: string | null
  initialAssigneeIds?: string[]
  profiles: AssigneeProfile[]
  profilesError: string | null
  onClose: () => void
  onSubmit: (values: TaskFormValues) => Promise<void>
}

function CloseIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return ''

  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''

  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function fromDatetimeLocalValue(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null

  const date = new Date(trimmed)
  if (Number.isNaN(date.getTime())) return null

  return date.toISOString()
}

export function TaskFormModal({
  isOpen,
  mode,
  columnTitle,
  initialTitle = '',
  initialPriority = 'medium',
  initialDescription = null,
  initialDueAt = null,
  initialAssigneeIds = [],
  profiles,
  profilesError,
  onClose,
  onSubmit,
}: TaskFormModalProps) {
  const formId = useId()
  const [title, setTitle] = useState(initialTitle)
  const [priority, setPriority] = useState<TaskPriority>(initialPriority)
  const [description, setDescription] = useState(initialDescription ?? '')
  const [dueAtLocal, setDueAtLocal] = useState(toDatetimeLocalValue(initialDueAt))
  const [assigneeIds, setAssigneeIds] = useState<string[]>(initialAssigneeIds)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    setTitle(initialTitle)
    setPriority(initialPriority)
    setDescription(initialDescription ?? '')
    setDueAtLocal(toDatetimeLocalValue(initialDueAt))
    setAssigneeIds(initialAssigneeIds)
    setError(null)
    setSubmitting(false)
  }, [isOpen, initialTitle, initialPriority, initialDescription, initialDueAt, initialAssigneeIds])

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submitting) onClose()
    }

    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose, submitting])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)

    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      setError('Введите текст задачи.')
      return
    }

    setSubmitting(true)
    try {
      const trimmedDescription = description.trim()

      await onSubmit({
        title: trimmedTitle,
        priority,
        description: trimmedDescription ? trimmedDescription : null,
        dueAt: fromDatetimeLocalValue(dueAtLocal),
        assigneeIds,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить карточку.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen) return null

  const modalTitle = mode === 'create' ? 'Новая карточка' : 'Редактировать карточку'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onMouseDown={(event) => {
        if (!submitting && event.target === event.currentTarget) onClose()
      }}
    >
      <div className="absolute inset-0 bg-navy/60 backdrop-blur-sm modal-overlay" aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${formId}-title`}
        className="modal-panel relative z-10 w-full max-w-md overflow-hidden rounded-4xl border border-navy/10 bg-white shadow-hero outline-none"
      >
        <div className="flex items-center justify-between border-b border-navy/10 px-6 py-5">
          <div>
            <h2 id={`${formId}-title`} className="text-lg font-black tracking-tight text-navy">
              {modalTitle}
            </h2>
            {columnTitle ? (
              <p className="mt-1 text-xs text-navy/45">Колонка: {columnTitle}</p>
            ) : null}
          </div>
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
              {error}
            </div>
          ) : null}

          <div className="space-y-2">
            <label htmlFor={`${formId}-title`} className="block text-sm font-semibold text-navy">
              Текст задачи
            </label>
            <input
              id={`${formId}-title`}
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Например, Настроить webhook Telegram"
              required
              disabled={submitting}
              autoFocus
              className="w-full rounded-2xl border border-navy/15 bg-surface px-4 py-3 text-sm text-navy outline-none transition placeholder:text-navy/40 focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor={`${formId}-priority`} className="block text-sm font-semibold text-navy">
              Приоритет
            </label>
            <select
              id={`${formId}-priority`}
              value={priority}
              onChange={(event) => setPriority(event.target.value as TaskPriority)}
              disabled={submitting}
              className="w-full rounded-2xl border border-navy/15 bg-surface px-4 py-3 text-sm text-navy outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {PRIORITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor={`${formId}-description`} className="block text-sm font-semibold text-navy">
              Описание <span className="font-normal text-navy/45">(необязательно)</span>
            </label>
            <textarea
              id={`${formId}-description`}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Детали, контекст, ссылки…"
              rows={4}
              disabled={submitting}
              className="w-full resize-y rounded-2xl border border-navy/15 bg-surface px-4 py-3 text-sm text-navy outline-none transition placeholder:text-navy/40 focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor={`${formId}-due`} className="block text-sm font-semibold text-navy">
              Дедлайн <span className="font-normal text-navy/45">(необязательно)</span>
            </label>
            <input
              id={`${formId}-due`}
              type="datetime-local"
              value={dueAtLocal}
              onChange={(event) => setDueAtLocal(event.target.value)}
              disabled={submitting}
              className="w-full rounded-2xl border border-navy/15 bg-surface px-4 py-3 text-sm text-navy outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold text-navy">
              Исполнители <span className="font-normal text-navy/45">(необязательно)</span>
            </p>
            <AssigneePicker
              profiles={profiles}
              profilesError={profilesError}
              selectedAssigneeIds={assigneeIds}
              disabled={submitting}
              onChange={(nextAssigneeIds) => {
                setAssigneeIds(nextAssigneeIds)
              }}
            />
          </div>

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
              {submitting ? 'Сохраняем…' : mode === 'create' ? 'Создать' : 'Сохранить'}
            </ButtonPrimary>
          </div>
        </form>
      </div>
    </div>
  )
}
