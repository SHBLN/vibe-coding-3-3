import { useEffect, useRef, useState } from 'react'

type DeleteTaskModalProps = {
  isOpen: boolean
  taskTitle?: string
  taskCount?: number
  onClose: () => void
  onConfirm: () => Promise<void>
}

export function DeleteTaskModal({
  isOpen,
  taskTitle = '',
  taskCount = 1,
  onClose,
  onConfirm,
}: DeleteTaskModalProps) {
  const isBulk = taskCount > 1
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
        aria-labelledby="delete-task-title"
        tabIndex={-1}
        className="modal-panel relative z-10 w-full max-w-md overflow-hidden rounded-4xl border border-navy/10 bg-white shadow-hero outline-none"
      >
        <div className="border-b border-navy/10 px-6 py-5">
          <h2 id="delete-task-title" className="text-lg font-black tracking-tight text-navy">
            {isBulk ? `Удалить ${taskCount} карточек?` : 'Удалить карточку?'}
          </h2>
        </div>

        <div className="px-6 py-6">
          <p className="text-sm text-navy/70">
            {isBulk ? (
              <>
                Будет удалено карточек:{' '}
                <span className="font-semibold text-navy">{taskCount}</span>. Восстановить их
                будет нельзя.
              </>
            ) : (
              <>
                Карточка «<span className="font-semibold text-navy">{taskTitle}</span>» будет
                удалена без возможности восстановления.
              </>
            )}
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
