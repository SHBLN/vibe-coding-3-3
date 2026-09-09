import { useEffect, useId, useState, type FormEvent } from 'react'
import { ButtonPrimary } from '../landing/ui'

type ColumnFormModalProps = {
  isOpen: boolean
  mode: 'create' | 'edit'
  initialTitle?: string
  onClose: () => void
  onSubmit: (title: string) => Promise<void>
}

function CloseIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function ColumnFormModal({
  isOpen,
  mode,
  initialTitle = '',
  onClose,
  onSubmit,
}: ColumnFormModalProps) {
  const formId = useId()
  const [title, setTitle] = useState(initialTitle)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    setTitle(initialTitle)
    setError(null)
    setSubmitting(false)
  }, [isOpen, initialTitle])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmed = title.trim()
    if (!trimmed) {
      setError('Введите название колонки.')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      await onSubmit(trimmed)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить колонку.')
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
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${formId}-title`}
        className="modal-panel relative z-10 w-full max-w-md overflow-hidden rounded-4xl border border-navy/10 bg-white shadow-hero outline-none"
      >
        <div className="flex items-center justify-between border-b border-navy/10 px-6 py-5">
          <h2 id={`${formId}-title`} className="text-lg font-black tracking-tight text-navy">
            {mode === 'create' ? 'Новая колонка' : 'Редактировать колонку'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Закрыть"
            className="rounded-xl p-2 text-navy/40 transition hover:bg-surface-alt hover:text-navy disabled:opacity-50"
          >
            <CloseIcon />
          </button>
        </div>

        <form onSubmit={(event) => void handleSubmit(event)} className="px-6 py-6">
          <label htmlFor={`${formId}-title-input`} className="mb-2 block text-sm font-semibold text-navy/70">
            Название
          </label>
          <input
            id={`${formId}-title-input`}
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            autoFocus
            maxLength={80}
            placeholder="Например, QA"
            className="w-full rounded-2xl border border-navy/15 bg-white px-4 py-3 text-sm text-navy outline-none transition focus:border-accent/50 focus:ring-2 focus:ring-accent/20"
          />

          {error ? (
            <p className="mt-3 text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}

          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 rounded-2xl border border-navy/15 px-4 py-3 text-sm font-semibold text-navy/70 transition hover:border-navy/30 hover:text-navy disabled:opacity-60"
            >
              Отмена
            </button>
            <ButtonPrimary type="submit" disabled={submitting} className="flex-1 justify-center">
              {submitting ? 'Сохраняем…' : mode === 'create' ? 'Создать' : 'Сохранить'}
            </ButtonPrimary>
          </div>
        </form>
      </div>
    </div>
  )
}
