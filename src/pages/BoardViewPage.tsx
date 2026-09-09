import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AssigneePicker } from '../components/board/AssigneePicker'
import { AccountBadge } from '../components/landing/AccountBadge'
import { ButtonPrimary, LogoIcon } from '../components/landing/ui'
import { useAuth } from '../hooks/useAuth'
import { getProfileInitials, listProfiles, type AssigneeProfile } from '../lib/profiles'
import {
  getMockBoard,
  isKnownMockBoardId,
  type BoardTask,
  type BoardViewColumn,
  type BoardViewData,
} from '../mocks/boardViewMock'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatDueDate(iso: string) {
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
  })
}

function isOverdue(dueAt: string | null, status: BoardTask['status']) {
  if (!dueAt || status === 'done') return false
  return new Date(dueAt) < new Date()
}

function BackIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M19 12H5M5 12l6-6M5 12l6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CalendarIcon({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" />
    </svg>
  )
}

type TaskCardProps = {
  task: BoardTask
  profiles: AssigneeProfile[]
  profilesError: string | null
  onAssigneeChange: (taskId: string, assigneeId: string | null) => void
}

function TaskCard({ task, profiles, profilesError, onAssigneeChange }: TaskCardProps) {
  const overdue = isOverdue(task.dueAt, task.status)

  return (
    <article className="rounded-2xl border border-navy/10 bg-white p-4 shadow-sm transition hover:border-accent/30 hover:shadow-card">
      <div className="mb-2 flex flex-wrap items-start gap-2">
        {task.kind === 'epic' ? (
          <span className="rounded-full bg-navy/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-navy/70">
            Эпик
          </span>
        ) : null}
        {task.tags?.map((tag) => (
          <span
            key={tag}
            className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent-dark"
          >
            {tag}
          </span>
        ))}
      </div>

      <h4 className="text-sm font-bold leading-snug text-navy">{task.title}</h4>

      {task.parentTitle ? (
        <p className="mt-1.5 text-xs text-navy/45">↳ {task.parentTitle}</p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <AssigneePicker
          profiles={profiles}
          profilesError={profilesError}
          selectedAssigneeId={task.assigneeId}
          fallbackName={task.assigneeName}
          fallbackInitials={task.assigneeInitials}
          onSelect={(assigneeId) => onAssigneeChange(task.id, assigneeId)}
        />

        {task.dueAt ? (
          <span
            className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold ${
              overdue ? 'bg-red-500/10 text-red-600' : 'bg-surface-alt text-navy/50'
            }`}
          >
            <CalendarIcon />
            {formatDueDate(task.dueAt)}
            {overdue ? ' · просрочено' : ''}
          </span>
        ) : null}
      </div>
    </article>
  )
}

type BoardColumnSectionProps = {
  column: BoardViewColumn
  profiles: AssigneeProfile[]
  profilesError: string | null
  onAssigneeChange: (taskId: string, assigneeId: string | null) => void
}

function BoardColumnSection({
  column,
  profiles,
  profilesError,
  onAssigneeChange,
}: BoardColumnSectionProps) {
  return (
    <section className="flex w-[300px] shrink-0 flex-col rounded-3xl border border-navy/10 bg-surface-alt/80 p-4 shadow-sm">
      <header className="mb-4 flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold uppercase tracking-wide text-navy/50">{column.title}</h3>
        <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-bold text-navy/40">
          {column.tasks.length}
        </span>
      </header>

      {column.tasks.length > 0 ? (
        <ul className="space-y-3">
          {column.tasks.map((task) => (
            <li key={task.id}>
              <TaskCard
                task={task}
                profiles={profiles}
                profilesError={profilesError}
                onAssigneeChange={onAssigneeChange}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl border border-dashed border-navy/10 bg-white/60 px-4 py-8 text-center text-xs text-navy/40">
          Нет карточек
        </p>
      )}
    </section>
  )
}

function BoardNotFound() {
  return (
    <div className="section-shell flex min-h-[60vh] flex-col items-center justify-center py-16 text-center">
      <h1 className="text-2xl font-black text-navy">Доска не найдена</h1>
      <p className="mt-2 max-w-sm text-sm text-navy/60">
        Проверьте ссылку или вернитесь к списку досок.
      </p>
      <Link to="/boards" className="mt-6">
        <ButtonPrimary>К списку досок</ButtonPrimary>
      </Link>
    </div>
  )
}

type BoardViewContentProps = {
  board: BoardViewData
  columns: BoardViewColumn[]
  profiles: AssigneeProfile[]
  profilesError: string | null
  onAssigneeChange: (taskId: string, assigneeId: string | null) => void
}

function BoardViewContent({
  board,
  columns,
  profiles,
  profilesError,
  onAssigneeChange,
}: BoardViewContentProps) {
  const totalTasks = columns.reduce((sum, column) => sum + column.tasks.length, 0)
  const isDemoFallback = !isKnownMockBoardId(board.id)

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link
            to="/boards"
            className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-navy/50 transition hover:text-accent"
          >
            <BackIcon />
            Все доски
          </Link>
          <h1 className="text-3xl font-black tracking-[-0.04em] text-navy">{board.title}</h1>
          {board.description ? (
            <p className="mt-2 max-w-2xl text-sm text-navy/60">{board.description}</p>
          ) : null}
          <p className="mt-3 text-xs text-navy/40">
            {columns.length} колонок · {totalTasks} карточек · обновлена{' '}
            {formatDate(board.updatedAt)}
          </p>
          {isDemoFallback ? (
            <p className="mt-2 inline-flex rounded-full bg-accent/10 px-3 py-1 text-[11px] font-semibold text-accent-dark">
              UI-only: демо-контент для этой доски
            </p>
          ) : null}
        </div>
      </div>

      <div className="-mx-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
        <div className="flex min-w-min gap-4">
          {columns.map((column) => (
            <BoardColumnSection
              key={column.id}
              column={column}
              profiles={profiles}
              profilesError={profilesError}
              onAssigneeChange={onAssigneeChange}
            />
          ))}
        </div>
      </div>
    </>
  )
}

export function BoardViewPage() {
  const { boardId } = useParams<{ boardId: string }>()
  const navigate = useNavigate()
  const { account, loading, signOut } = useAuth()

  const initialBoard = boardId === 'not-found' ? null : getMockBoard(boardId)

  const [columns, setColumns] = useState<BoardViewColumn[]>(() => initialBoard?.columns ?? [])
  const [profiles, setProfiles] = useState<AssigneeProfile[]>([])
  const [profilesError, setProfilesError] = useState<string | null>(null)

  useEffect(() => {
    if (initialBoard) {
      setColumns(initialBoard.columns)
    }
  }, [initialBoard])

  useEffect(() => {
    let cancelled = false

    async function loadProfiles() {
      setProfilesError(null)

      try {
        const nextProfiles = await listProfiles()
        if (!cancelled) setProfiles(nextProfiles)
      } catch (err) {
        if (!cancelled) {
          setProfiles([])
          setProfilesError(
            err instanceof Error ? err.message : 'Не удалось загрузить список пользователей.',
          )
        }
      }
    }

    if (!loading && account) {
      void loadProfiles()
    }

    return () => {
      cancelled = true
    }
  }, [loading, account])

  const handleAssigneeChange = useCallback((taskId: string, assigneeId: string | null) => {
    setColumns((prev) =>
      prev.map((column) => ({
        ...column,
        tasks: column.tasks.map((task) => {
          if (task.id !== taskId) return task

          const selectedProfile = assigneeId
            ? profiles.find((profile) => profile.id === assigneeId)
            : null

          return {
            ...task,
            assigneeId,
            assigneeName: selectedProfile?.displayName ?? null,
            assigneeInitials: selectedProfile
              ? getProfileInitials(selectedProfile.displayName)
              : null,
          }
        }),
      })),
    )
  }, [profiles])

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  if (loading || !account) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <span className="text-sm text-navy/50">Загрузка…</span>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-navy/10 bg-surface">
        <div className="section-shell flex h-20 items-center justify-between">
          <Link to="/" aria-label="AiVibeBoard — на главную" className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 rotate-3 items-center justify-center rounded-2xl bg-navy text-accent shadow-card">
              <LogoIcon />
            </div>
            <span className="text-xl font-black tracking-[-0.04em] text-navy">
              AI VIBE<span className="text-accent">.</span>
            </span>
          </Link>

          <AccountBadge account={account} onSignOut={handleSignOut} />
        </div>
      </header>

      <main className="section-shell py-8">
        {initialBoard ? (
          <BoardViewContent
            board={initialBoard}
            columns={columns}
            profiles={profiles}
            profilesError={profilesError}
            onAssigneeChange={handleAssigneeChange}
          />
        ) : (
          <BoardNotFound />
        )}
      </main>
    </div>
  )
}
