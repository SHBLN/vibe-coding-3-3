import { useEffect, useId, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { getProfileInitials } from '../../lib/profiles'
import {
  ALLOWED_ATTACHMENT_MIME_TYPES,
  MAX_ATTACHMENT_SIZE_BYTES,
  validateAttachmentFile,
} from '../../lib/r2Uploads'
import {
  createTaskComment,
  deleteTaskComment,
  listTaskComments,
  type TaskComment,
} from '../../lib/taskComments'
import { ButtonPrimary } from '../landing/ui'

type TaskCommentsModalProps = {
  isOpen: boolean
  taskId: string
  taskTitle: string
  currentUserId: string | null
  onClose: () => void
}

function CloseIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function PaperclipIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path
        d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function TrashIcon({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function formatCommentDate(iso: string) {
  return new Date(iso).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function CommentItem({
  comment,
  canDelete,
  deleting,
  onDelete,
}: {
  comment: TaskComment
  canDelete: boolean
  deleting: boolean
  onDelete: (commentId: string) => void
}) {
  const initials = getProfileInitials(comment.authorName)

  return (
    <article className="rounded-2xl border border-navy/10 bg-surface px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy/10 text-[11px] font-bold text-navy/70">
            {initials}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold text-navy">{comment.authorName}</span>
              <span className="text-[11px] text-navy/40">{formatCommentDate(comment.createdAt)}</span>
            </div>
            {comment.body ? (
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-navy/75">
                {comment.body}
              </p>
            ) : null}
            {comment.attachmentUrl ? (
              <a
                href={comment.attachmentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex max-w-full items-center gap-2 rounded-xl border border-navy/10 bg-white px-3 py-2 text-xs font-semibold text-accent transition hover:border-accent/30 hover:text-accent-dark"
              >
                <PaperclipIcon />
                <span className="truncate">{comment.attachmentName ?? 'Вложение'}</span>
                {comment.attachmentSize ? (
                  <span className="shrink-0 text-navy/40">({formatFileSize(comment.attachmentSize)})</span>
                ) : null}
              </a>
            ) : null}
          </div>
        </div>
        {canDelete ? (
          <button
            type="button"
            onClick={() => onDelete(comment.id)}
            disabled={deleting}
            aria-label="Удалить комментарий"
            className="shrink-0 rounded-lg p-1.5 text-navy/35 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
          >
            <TrashIcon />
          </button>
        ) : null}
      </div>
    </article>
  )
}

export function TaskCommentsModal({
  isOpen,
  taskId,
  taskTitle,
  currentUserId,
  onClose,
}: TaskCommentsModalProps) {
  const formId = useId()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [comments, setComments] = useState<TaskComment[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [body, setBody] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  useEffect(() => {
    if (!isOpen) return

    setBody('')
    setSelectedFile(null)
    setError(null)
    setDeletingId(null)

    let cancelled = false

    async function loadComments() {
      setLoading(true)
      try {
        const nextComments = await listTaskComments(taskId)
        if (!cancelled) setComments(nextComments)
      } catch (err) {
        if (!cancelled) {
          setComments([])
          setError(err instanceof Error ? err.message : 'Не удалось загрузить комментарии.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadComments()

    return () => {
      cancelled = true
    }
  }, [isOpen, taskId])

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submitting && deletingId === null) onClose()
    }

    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose, submitting, deletingId])

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setError(null)
    const file = event.target.files?.[0] ?? null
    if (!file) {
      setSelectedFile(null)
      return
    }

    try {
      validateAttachmentFile(file)
      setSelectedFile(file)
    } catch (err) {
      setSelectedFile(null)
      setError(err instanceof Error ? err.message : 'Некорректный файл.')
      event.target.value = ''
    }
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)

    const trimmedBody = body.trim()
    if (!trimmedBody && !selectedFile) {
      setError('Введите комментарий или прикрепите файл.')
      return
    }

    setSubmitting(true)
    try {
      const createdComment = await createTaskComment({
        taskId,
        body: trimmedBody,
        file: selectedFile,
      })

      setComments((prev) => [...prev, createdComment])
      setBody('')
      setSelectedFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отправить комментарий.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (commentId: string) => {
    setError(null)
    setDeletingId(commentId)

    const previousComments = comments
    setComments((prev) => prev.filter((comment) => comment.id !== commentId))

    try {
      await deleteTaskComment(commentId)
    } catch (err) {
      setComments(previousComments)
      setError(err instanceof Error ? err.message : 'Не удалось удалить комментарий.')
    } finally {
      setDeletingId(null)
    }
  }

  if (!isOpen) return null

  const acceptTypes = ALLOWED_ATTACHMENT_MIME_TYPES.join(',')

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onMouseDown={(event) => {
        if (!submitting && deletingId === null && event.target === event.currentTarget) onClose()
      }}
    >
      <div className="absolute inset-0 bg-navy/60 backdrop-blur-sm modal-overlay" aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${formId}-title`}
        className="modal-panel relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-4xl border border-navy/10 bg-white shadow-hero outline-none"
      >
        <div className="flex items-center justify-between border-b border-navy/10 px-6 py-5">
          <div className="min-w-0 pr-4">
            <h2 id={`${formId}-title`} className="text-lg font-black tracking-tight text-navy">
              Комментарии
            </h2>
            <p className="mt-1 truncate text-xs text-navy/45">{taskTitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting || deletingId !== null}
            aria-label="Закрыть"
            className="rounded-full p-2 text-navy/50 transition hover:bg-navy/5 hover:text-navy disabled:opacity-50"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {error ? (
            <div
              className="mb-4 rounded-2xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-700"
              role="alert"
            >
              {error}
            </div>
          ) : null}

          {loading ? (
            <p className="text-sm text-navy/50">Загрузка комментариев…</p>
          ) : comments.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-navy/10 bg-surface px-4 py-8 text-center text-sm text-navy/45">
              Пока нет комментариев. Напишите первый или прикрепите файл.
            </p>
          ) : (
            <ul className="space-y-3">
              {comments.map((comment) => (
                <li key={comment.id}>
                  <CommentItem
                    comment={comment}
                    canDelete={currentUserId === comment.authorId}
                    deleting={deletingId === comment.id}
                    onDelete={(commentId) => void handleDelete(commentId)}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        <form
          className="space-y-3 border-t border-navy/10 px-6 py-5"
          onSubmit={(event) => void handleSubmit(event)}
        >
          <div className="space-y-2">
            <label htmlFor={`${formId}-body`} className="block text-sm font-semibold text-navy">
              Новый комментарий
            </label>
            <textarea
              id={`${formId}-body`}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Напишите комментарий…"
              rows={3}
              disabled={submitting}
              className="w-full resize-y rounded-2xl border border-navy/15 bg-surface px-4 py-3 text-sm text-navy outline-none transition placeholder:text-navy/40 focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <input
                ref={fileInputRef}
                id={`${formId}-file`}
                type="file"
                accept={acceptTypes}
                onChange={handleFileChange}
                disabled={submitting}
                className="hidden"
              />
              <label
                htmlFor={`${formId}-file`}
                className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-navy/15 bg-white px-4 py-2.5 text-xs font-semibold text-navy/70 transition hover:border-accent/30 hover:text-accent disabled:cursor-not-allowed disabled:opacity-60"
              >
                <PaperclipIcon />
                Прикрепить файл
              </label>
              <p className="mt-1 text-[11px] text-navy/40">
                До {formatFileSize(MAX_ATTACHMENT_SIZE_BYTES)} · PDF, изображения, документы, zip
              </p>
              {selectedFile ? (
                <p className="mt-1 truncate text-xs font-semibold text-navy/60">
                  {selectedFile.name} ({formatFileSize(selectedFile.size)})
                </p>
              ) : null}
            </div>

            <ButtonPrimary type="submit" disabled={submitting} className="justify-center px-5 py-3">
              {submitting ? 'Отправляем…' : 'Отправить'}
            </ButtonPrimary>
          </div>
        </form>
      </div>
    </div>
  )
}
