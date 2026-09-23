import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AssigneePicker } from '../components/board/AssigneePicker'
import { BoardChatPanel } from '../components/board/BoardChatPanel'
import { BoardMembersPicker } from '../components/board/BoardMembersPicker'
import { ColumnFormModal } from '../components/board/ColumnFormModal'
import { DeleteColumnModal } from '../components/board/DeleteColumnModal'
import { DeleteTaskModal } from '../components/board/DeleteTaskModal'
import { TaskCommentsModal } from '../components/board/TaskCommentsModal'
import { TaskFormModal, type TaskFormValues } from '../components/board/TaskFormModal'
import { AccountBadge } from '../components/landing/AccountBadge'
import { ButtonPrimary, LogoIcon } from '../components/landing/ui'
import { useAuth } from '../hooks/useAuth'
import {
  createBoardMessage,
  listBoardMessages,
  mapAiSplitToBoardTasks,
  runBoardMessageAiSplit,
  subscribeBoardMessages,
  updateBoardMessageAiStatus,
  type BoardMessage,
} from '../lib/boardChat'
import {
  BACKLOG_STATUS_KEY,
  createBoardColumn,
  createTask,
  deleteBoardColumn,
  deleteTask,
  deleteTasks,
  fetchBoardView,
  reindexBoardColumns,
  saveBoardColumnsState,
  syncTaskAssignees,
  updateBoardColumn,
  updateTask,
} from '../lib/boardTasks'
import { fetchCurrentSubscription, type BillingSubscriptionRow } from '../lib/billing'
import { BoardLimitError, type BoardCreationBillingAction } from '../lib/boards'
import {
  fetchOwnerDistinctTeamMemberIds,
  saveBoardMembers,
} from '../lib/boardMembers'
import {
  aiSplitUnavailableMessage,
  canUseAiSplit,
  isActiveSubscription,
  maxTeamMembersForPlan,
} from '../lib/planLimits'
import { getProfileInitials, listProfiles, type AssigneeProfile } from '../lib/profiles'
import {
  DONE_STATUS_KEY,
  type BoardTask,
  type BoardViewColumn,
  type BoardViewData,
  type TaskPriority,
} from '../mocks/boardViewMock'

const PRIORITY_BADGE: Record<TaskPriority, { label: string; className: string }> = {
  low: {
    label: 'Низкий',
    className: 'bg-surface-alt text-navy/55',
  },
  medium: {
    label: 'Средний',
    className: 'bg-navy/8 text-navy/50',
  },
  high: {
    label: 'Высокий',
    className: 'bg-red-500/10 text-red-600',
  },
}

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
  if (!dueAt || status === DONE_STATUS_KEY) return false
  return new Date(dueAt) < new Date()
}

type MoveTaskPayload = {
  taskId: string
  sourceColumnId: string
  targetColumnId: string
  targetTaskId?: string | null
}

function moveTask(columns: BoardViewColumn[], payload: MoveTaskPayload): BoardViewColumn[] {
  const { taskId, sourceColumnId, targetColumnId, targetTaskId = null } = payload

  const sourceColumn = columns.find((column) => column.id === sourceColumnId)
  const targetColumn = columns.find((column) => column.id === targetColumnId)
  if (!sourceColumn || !targetColumn) return columns

  const movedTask = sourceColumn.tasks.find((item) => item.id === taskId)
  if (!movedTask) return columns

  const updatedTask: BoardTask = {
    ...movedTask,
    status: targetColumn.statusKey,
  }

  const withoutTask = columns.map((column) => {
    if (column.id !== sourceColumnId) return column

    return {
      ...column,
      tasks: column.tasks.filter((item) => item.id !== taskId),
    }
  })

  return withoutTask.map((column) => {
    if (column.id !== targetColumnId) return column

    const tasks = [...column.tasks]

    if (targetTaskId && targetTaskId !== taskId) {
      const insertIndex = tasks.findIndex((item) => item.id === targetTaskId)
      if (insertIndex === -1) {
        tasks.push(updatedTask)
      } else {
        tasks.splice(insertIndex, 0, updatedTask)
      }
    } else {
      tasks.push(updatedTask)
    }

    return { ...column, tasks }
  })
}

function moveColumn(
  columns: BoardViewColumn[],
  sourceColumnId: string,
  targetColumnId: string,
): BoardViewColumn[] {
  if (sourceColumnId === targetColumnId) return columns

  const sourceIndex = columns.findIndex((column) => column.id === sourceColumnId)
  const targetIndex = columns.findIndex((column) => column.id === targetColumnId)
  if (sourceIndex === -1 || targetIndex === -1) return columns

  const nextColumns = [...columns]
  const [movedColumn] = nextColumns.splice(sourceIndex, 1)
  nextColumns.splice(targetIndex, 0, movedColumn)

  return nextColumns
}

type DragState = {
  activeTaskId: string | null
  sourceColumnId: string | null
  overColumnId: string | null
  overTaskId: string | null
}

const INITIAL_DRAG_STATE: DragState = {
  activeTaskId: null,
  sourceColumnId: null,
  overColumnId: null,
  overTaskId: null,
}

type ColumnDragState = {
  activeColumnId: string | null
  overColumnId: string | null
}

const INITIAL_COLUMN_DRAG_STATE: ColumnDragState = {
  activeColumnId: null,
  overColumnId: null,
}

type TaskFormState =
  | {
      mode: 'create'
      columnId: string
    }
  | {
      mode: 'edit'
      columnId: string
      task: BoardTask
    }

type TaskDeleteState = {
  task: BoardTask
  columnId: string
}

type TasksBulkDeleteState = {
  taskIds: string[]
}

type TaskCommentsState = {
  task: BoardTask
}

type ColumnFormState =
  | {
      mode: 'create'
    }
  | {
      mode: 'edit'
      column: BoardViewColumn
    }

type ColumnDeleteState = {
  column: BoardViewColumn
}

function applyAssigneeUpdate(
  columns: BoardViewColumn[],
  taskId: string,
  assigneeIds: string[],
  profiles: AssigneeProfile[],
): BoardViewColumn[] {
  return columns.map((column) => ({
    ...column,
    tasks: column.tasks.map((task) => {
      if (task.id !== taskId) return task

      const selectedProfiles = assigneeIds
        .map((assigneeId) => profiles.find((profile) => profile.id === assigneeId) ?? null)
        .filter((profile): profile is AssigneeProfile => profile !== null)
      const selectedNames = selectedProfiles.map((profile) => profile.displayName)
      const primaryName = selectedNames[0] ?? null

      return {
        ...task,
        assigneeIds,
        assigneeId: assigneeIds[0] ?? null,
        assigneeNames: selectedNames,
        assigneeName: primaryName,
        assigneeInitials: primaryName ? getProfileInitials(primaryName) : null,
      }
    }),
  }))
}

function isInteractiveDragTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return Boolean(target.closest('button, input, textarea, a, [role="dialog"], [data-no-drag]'))
}

function isColumnPanScrollTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  if (target.closest('[data-no-column-pan]')) return false
  if (target.closest('button, input, textarea, a, [role="dialog"], [data-no-drag]')) return false
  if (target.closest('[draggable="true"]')) return false
  return true
}

type ColumnPanDragState = {
  pointerId: number
  startX: number
  startScrollLeft: number
}

function getHorizontalWheelDelta(event: WheelEvent): number {
  // Mouse wheel up/down -> horizontal board scroll; trackpad may send deltaX.
  let rawDelta = event.deltaY
  if (rawDelta === 0) {
    rawDelta = event.deltaX
  } else if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
    rawDelta = event.deltaX
  }

  if (rawDelta === 0) return 0

  if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
    return rawDelta * 48
  }

  if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
    return rawDelta * window.innerHeight * 0.25
  }

  return rawDelta
}

function shouldMapWheelToColumnScroll(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return true
  return !target.closest('[data-no-columns-wheel], textarea, select')
}

function applyHorizontalColumnsWheelScroll(scrollEl: HTMLDivElement, event: WheelEvent): void {
  if (!shouldMapWheelToColumnScroll(event.target)) return
  if (event.ctrlKey) return

  const maxScrollLeft = scrollEl.scrollWidth - scrollEl.clientWidth
  if (maxScrollLeft <= 0) return

  const delta = getHorizontalWheelDelta(event)
  if (delta === 0) return

  event.preventDefault()

  scrollEl.style.scrollBehavior = 'auto'
  scrollEl.scrollLeft = Math.max(0, Math.min(maxScrollLeft, scrollEl.scrollLeft + delta))
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

function PencilIcon({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" strokeLinecap="round" strokeLinejoin="round" />
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

function CommentIcon({ className = 'h-3.5 w-3.5' }: { className?: string }) {
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

function DragGripIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="9" cy="7" r="1.5" />
      <circle cx="15" cy="7" r="1.5" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="15" cy="12" r="1.5" />
      <circle cx="9" cy="17" r="1.5" />
      <circle cx="15" cy="17" r="1.5" />
    </svg>
  )
}

type TaskCardProps = {
  task: BoardTask
  columnId: string
  profiles: AssigneeProfile[]
  profilesError: string | null
  isDragging: boolean
  isDropTarget: boolean
  assigneeSaving: boolean
  assigneeError: string | null
  crudLocked: boolean
  selectionMode: boolean
  isSelected: boolean
  onToggleSelect: (taskId: string) => void
  onEdit: (task: BoardTask) => void
  onDelete: (task: BoardTask) => void
  onOpenComments: (task: BoardTask) => void
  onAssigneeChange: (taskId: string, assigneeIds: string[]) => void | Promise<void>
  onDragStart: (event: DragEvent<HTMLElement>, taskId: string, columnId: string) => void
  onDragEnd: () => void
  onDragOver: (event: DragEvent<HTMLElement>, columnId: string, taskId: string) => void
  onDrop: (event: DragEvent<HTMLElement>, columnId: string, taskId: string) => void
}

function TaskCard({
  task,
  columnId,
  profiles,
  profilesError,
  isDragging,
  isDropTarget,
  assigneeSaving,
  assigneeError,
  crudLocked,
  selectionMode,
  isSelected,
  onToggleSelect,
  onEdit,
  onDelete,
  onOpenComments,
  onAssigneeChange,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: TaskCardProps) {
  const overdue = isOverdue(task.dueAt, task.status)
  const selectedAssigneeIds = task.assigneeIds ?? (task.assigneeId ? [task.assigneeId] : [])
  const fallbackAssigneeNames =
    task.assigneeNames ?? (task.assigneeName ? [task.assigneeName] : [])
  const priorityBadge = PRIORITY_BADGE[task.priority]
  const trimmedDescription = task.description?.trim() ?? ''

  return (
    <article
      draggable={!selectionMode}
      data-no-column-pan
      onClick={() => {
        if (selectionMode) onToggleSelect(task.id)
      }}
      onDragStart={(event) => onDragStart(event, task.id, columnId)}
      onDragEnd={onDragEnd}
      onDragOver={(event) => onDragOver(event, columnId, task.id)}
      onDrop={(event) => onDrop(event, columnId, task.id)}
      className={`group flex min-h-[210px] sm:min-h-[220px] flex-col overflow-hidden rounded-xl border bg-white p-4 shadow-sm transition ${
        selectionMode
          ? `cursor-pointer ${isSelected ? 'border-accent ring-2 ring-accent/25' : 'border-navy/10 hover:border-accent/30'}`
          : isDragging
            ? 'cursor-grabbing border-accent/40 opacity-50 shadow-none'
            : 'hover-lift cursor-grab border-navy/10 hover:border-accent/30 hover:shadow-card'
      } ${isDropTarget ? 'border-t-2 border-t-accent ring-2 ring-accent/20' : ''}`}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-start gap-2">
        {selectionMode ? (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelect(task.id)}
            onClick={(event) => event.stopPropagation()}
            aria-label={`Выбрать «${task.title}»`}
            className="mt-1 h-4 w-4 shrink-0 cursor-pointer rounded border-navy/20 text-accent focus:ring-accent/30"
          />
        ) : (
          <span
            className="mt-0.5 shrink-0 rounded-md p-0.5 text-navy/25 transition group-hover:text-navy/45"
            aria-hidden="true"
          >
            <DragGripIcon />
          </span>
        )}
        <div className="flex min-w-0 flex-1 flex-wrap items-start gap-2">
        {task.kind === 'epic' ? (
          <span className="rounded-full bg-navy/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-navy/70">
            Эпик
          </span>
        ) : null}
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${priorityBadge.className}`}
        >
          {priorityBadge.label}
        </span>
        {task.tags?.map((tag) => (
          <span
            key={tag}
            className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent-dark"
          >
            {tag}
          </span>
        ))}
        </div>
        </div>
        <div
          className={`flex shrink-0 gap-1 transition ${selectionMode ? 'opacity-100' : 'opacity-100 sm:opacity-0 sm:group-hover:opacity-100'}`}
          data-no-drag
        >
          {!selectionMode ? (
            <>
              <button
                type="button"
                onClick={() => onOpenComments(task)}
                disabled={crudLocked}
                aria-label="Комментарии"
                className="press-down rounded-lg p-1.5 text-navy/40 hover:bg-surface-alt hover:text-navy disabled:opacity-50"
              >
                <CommentIcon />
              </button>
              <button
                type="button"
                onClick={() => onEdit(task)}
                disabled={crudLocked}
                aria-label="Редактировать карточку"
                className="press-down rounded-lg p-1.5 text-navy/40 hover:bg-surface-alt hover:text-navy disabled:opacity-50"
              >
                <PencilIcon />
              </button>
              <button
                type="button"
                onClick={() => onDelete(task)}
                disabled={crudLocked}
                aria-label="Удалить карточку"
                className="press-down rounded-lg p-1.5 text-navy/40 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
              >
                <TrashIcon />
              </button>
            </>
          ) : null}
        </div>
      </div>

      <h4 className="line-clamp-2 text-sm font-bold leading-snug text-navy">
        {task.title}
      </h4>

      {trimmedDescription ? (
        <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-navy/55">
          {trimmedDescription}
        </p>
      ) : null}

      {task.parentTitle ? (
        <p className="mt-1.5 text-xs text-navy/45">↳ {task.parentTitle}</p>
      ) : null}

      <div className="mt-auto grid min-h-9 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <div className="min-w-0">
          <AssigneePicker
            profiles={profiles}
            profilesError={profilesError}
            selectedAssigneeIds={selectedAssigneeIds}
            fallbackAssigneeNames={fallbackAssigneeNames}
            saving={assigneeSaving}
            error={assigneeError}
            onChange={(assigneeIds) => onAssigneeChange(task.id, assigneeIds)}
          />
        </div>

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
  columnIndex: number
  profiles: AssigneeProfile[]
  profilesError: string | null
  dragState: DragState
  columnDragState: ColumnDragState
  savingTaskId: string | null
  assigneeError: string | null
  crudLocked: boolean
  selectionMode: boolean
  selectedTaskIds: Set<string>
  onToggleTaskSelect: (taskId: string) => void
  onCreateTask: (columnId: string) => void
  onEditColumn: (column: BoardViewColumn) => void
  onDeleteColumn: (column: BoardViewColumn) => void
  onEditTask: (task: BoardTask) => void
  onDeleteTask: (task: BoardTask) => void
  onOpenComments: (task: BoardTask) => void
  onAssigneeChange: (taskId: string, assigneeIds: string[]) => void | Promise<void>
  onDragStart: (event: DragEvent<HTMLElement>, taskId: string, columnId: string) => void
  onDragEnd: () => void
  onColumnReorderStart: (event: DragEvent<HTMLElement>, columnId: string) => void
  onColumnReorderEnd: () => void
  onColumnDragOver: (event: DragEvent<HTMLElement>, columnId: string) => void
  onColumnDragLeave: (event: DragEvent<HTMLElement>, columnId: string) => void
  onColumnDrop: (event: DragEvent<HTMLElement>, columnId: string) => void
  onTaskDragOver: (event: DragEvent<HTMLElement>, columnId: string, taskId: string) => void
  onTaskDrop: (event: DragEvent<HTMLElement>, columnId: string, taskId: string) => void
}

function BoardColumnSection({
  column,
  columnIndex,
  profiles,
  profilesError,
  dragState,
  columnDragState,
  savingTaskId,
  assigneeError,
  crudLocked,
  selectionMode,
  selectedTaskIds,
  onToggleTaskSelect,
  onCreateTask,
  onEditColumn,
  onDeleteColumn,
  onEditTask,
  onDeleteTask,
  onOpenComments,
  onAssigneeChange,
  onDragStart,
  onDragEnd,
  onColumnReorderStart,
  onColumnReorderEnd,
  onColumnDragOver,
  onColumnDragLeave,
  onColumnDrop,
  onTaskDragOver,
  onTaskDrop,
}: BoardColumnSectionProps) {
  const isTaskDropTarget = dragState.overColumnId === column.id && dragState.activeTaskId !== null
  const isColumnDragging = columnDragState.activeColumnId === column.id
  const isColumnDropTarget =
    columnDragState.overColumnId === column.id &&
    columnDragState.activeColumnId !== null &&
    columnDragState.activeColumnId !== column.id
  const isEmpty = column.tasks.length === 0
  const isBacklog = column.statusKey === BACKLOG_STATUS_KEY

  return (
    <section
      className={`board-column-snap motion-stagger flex w-[312px] shrink-0 flex-col rounded-2xl border bg-surface p-4 shadow-sm transition ${
        isColumnDragging
          ? 'cursor-grabbing border-navy/20 opacity-50'
          : isColumnDropTarget
            ? 'border-navy/40 ring-2 ring-navy/15'
            : isTaskDropTarget
              ? 'border-accent/50 ring-2 ring-accent/25'
              : 'border-navy/10'
      }`}
      style={{ '--stagger-delay': `${columnIndex * 55}ms` } as CSSProperties}
      onDragOver={(event) => onColumnDragOver(event, column.id)}
      onDragLeave={(event) => onColumnDragLeave(event, column.id)}
      onDrop={(event) => onColumnDrop(event, column.id)}
    >
      <header className="mb-4 flex flex-col gap-2">
        <div className="flex items-start gap-2">
          <span
            draggable
            onDragStart={(event) => onColumnReorderStart(event, column.id)}
            onDragEnd={onColumnReorderEnd}
            aria-label="Перетащить колонку"
            className="mt-0.5 shrink-0 cursor-grab rounded-md p-0.5 text-navy/25 transition hover:text-navy/45 active:cursor-grabbing"
          >
            <DragGripIcon />
          </span>
          <h3 className="min-w-0 flex-1 break-words text-sm font-bold uppercase leading-snug tracking-wide text-navy/50">
            {column.title}
          </h3>
        </div>
        <div className="flex items-center justify-between gap-2 pl-6">
          <span className="text-[11px] font-semibold text-navy/35">{column.tasks.length} карточек</span>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1" data-no-drag>
            <button
              type="button"
              onClick={() => onEditColumn(column)}
              disabled={crudLocked || selectionMode}
              aria-label="Редактировать колонку"
              className="press-down rounded-lg p-1.5 text-navy/40 hover:bg-white hover:text-navy disabled:opacity-50"
            >
              <PencilIcon />
            </button>
            {!isBacklog ? (
              <button
                type="button"
                onClick={() => onDeleteColumn(column)}
                disabled={crudLocked || selectionMode}
                aria-label="Удалить колонку"
                className="press-down rounded-lg p-1.5 text-navy/40 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
              >
                <TrashIcon />
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => onCreateTask(column.id)}
              disabled={crudLocked || selectionMode}
              className="press-down rounded-xl border border-navy/10 bg-white px-2.5 py-1.5 text-[11px] font-bold text-navy/60 hover:border-accent/40 hover:text-accent disabled:opacity-50"
            >
              + Карточка
            </button>
          </div>
        </div>
      </header>

      {isEmpty ? (
        <div
          className={`flex min-h-[120px] flex-1 items-center justify-center rounded-2xl border border-dashed px-4 py-8 text-center text-xs transition ${
            isTaskDropTarget
              ? 'border-accent/50 bg-accent/5 text-accent-dark'
              : 'border-navy/10 bg-white/60 text-navy/40'
          }`}
        >
          {isTaskDropTarget ? 'Отпустите карточку здесь' : 'Нет карточек'}
        </div>
      ) : (
        <ul className="space-y-3">
          {column.tasks.map((task, taskIndex) => (
            <li
              key={task.id}
              className="motion-stagger"
              style={{ '--stagger-delay': `${columnIndex * 55 + taskIndex * 35}ms` } as CSSProperties}
            >
              <TaskCard
                task={task}
                columnId={column.id}
                profiles={profiles}
                profilesError={profilesError}
                isDragging={dragState.activeTaskId === task.id}
                isDropTarget={
                  dragState.overTaskId === task.id &&
                  dragState.activeTaskId !== null &&
                  dragState.activeTaskId !== task.id
                }
                assigneeSaving={savingTaskId === task.id}
                assigneeError={savingTaskId === task.id ? assigneeError : null}
                crudLocked={crudLocked}
                selectionMode={selectionMode}
                isSelected={selectedTaskIds.has(task.id)}
                onToggleSelect={onToggleTaskSelect}
                onEdit={onEditTask}
                onDelete={onDeleteTask}
                onOpenComments={onOpenComments}
                onAssigneeChange={onAssigneeChange}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
                onDragOver={onTaskDragOver}
                onDrop={onTaskDrop}
              />
            </li>
          ))}
        </ul>
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
  boardMemberIds: string[]
  accountTeamMemberIds: string[]
  teamMemberLimit: number | null
  membersError: string | null
  membersBillingAction: BoardCreationBillingAction | null
  membersSaving: boolean
  dragState: DragState
  columnDragState: ColumnDragState
  savingTaskId: string | null
  assigneeError: string | null
  crudLocked: boolean
  selectionMode: boolean
  selectedTaskIds: Set<string>
  onToggleSelectionMode: () => void
  onToggleTaskSelect: (taskId: string) => void
  onSelectAllTasks: () => void
  onClearSelection: () => void
  onBulkDelete: () => void
  onBoardMembersChange: (ids: string[]) => void
  onCreateColumn: () => void
  onCreateTask: (columnId: string) => void
  onEditColumn: (column: BoardViewColumn) => void
  onDeleteColumn: (column: BoardViewColumn) => void
  onEditTask: (task: BoardTask) => void
  onDeleteTask: (task: BoardTask) => void
  onOpenComments: (task: BoardTask) => void
  onAssigneeChange: (taskId: string, assigneeIds: string[]) => void | Promise<void>
  onDragStart: (event: DragEvent<HTMLElement>, taskId: string, columnId: string) => void
  onDragEnd: () => void
  onColumnReorderStart: (event: DragEvent<HTMLElement>, columnId: string) => void
  onColumnReorderEnd: () => void
  onColumnDragOver: (event: DragEvent<HTMLElement>, columnId: string) => void
  onColumnDragLeave: (event: DragEvent<HTMLElement>, columnId: string) => void
  onColumnDrop: (event: DragEvent<HTMLElement>, columnId: string) => void
  onTaskDragOver: (event: DragEvent<HTMLElement>, columnId: string, taskId: string) => void
  onTaskDrop: (event: DragEvent<HTMLElement>, columnId: string, taskId: string) => void
}

function BoardViewContent({
  board,
  columns,
  profiles,
  profilesError,
  boardMemberIds,
  accountTeamMemberIds,
  teamMemberLimit,
  membersError,
  membersBillingAction,
  membersSaving,
  dragState,
  columnDragState,
  savingTaskId,
  assigneeError,
  crudLocked,
  selectionMode,
  selectedTaskIds,
  onToggleSelectionMode,
  onToggleTaskSelect,
  onSelectAllTasks,
  onClearSelection,
  onBulkDelete,
  onBoardMembersChange,
  onCreateColumn,
  onCreateTask,
  onEditColumn,
  onDeleteColumn,
  onEditTask,
  onDeleteTask,
  onOpenComments,
  onAssigneeChange,
  onDragStart,
  onDragEnd,
  onColumnReorderStart,
  onColumnReorderEnd,
  onColumnDragOver,
  onColumnDragLeave,
  onColumnDrop,
  onTaskDragOver,
  onTaskDrop,
}: BoardViewContentProps) {
  const totalTasks = columns.reduce((sum, column) => sum + column.tasks.length, 0)
  const selectedCount = selectedTaskIds.size
  const columnsAreaRef = useRef<HTMLDivElement>(null)
  const columnsScrollRef = useRef<HTMLDivElement>(null)
  const columnsScrollTopRef = useRef<HTMLDivElement>(null)
  const columnsScrollTopInnerRef = useRef<HTMLDivElement>(null)
  const columnsScrollSyncLockRef = useRef(false)
  const columnPanDragRef = useRef<ColumnPanDragState | null>(null)
  const [columnPanActive, setColumnPanActive] = useState(false)
  const [columnsHorizontallyScrollable, setColumnsHorizontallyScrollable] = useState(false)

  const syncTopColumnsScrollMetrics = useCallback(() => {
    const scrollEl = columnsScrollRef.current
    const topScrollEl = columnsScrollTopRef.current
    const topInnerEl = columnsScrollTopInnerRef.current
    if (!scrollEl || !topScrollEl || !topInnerEl) return

    topInnerEl.style.width = `${scrollEl.scrollWidth}px`
    setColumnsHorizontallyScrollable(scrollEl.scrollWidth > scrollEl.clientWidth + 1)

    if (!columnsScrollSyncLockRef.current) {
      columnsScrollSyncLockRef.current = true
      topScrollEl.scrollLeft = scrollEl.scrollLeft
      columnsScrollSyncLockRef.current = false
    }
  }, [])

  useEffect(() => {
    const scrollEl = columnsScrollRef.current
    const topScrollEl = columnsScrollTopRef.current
    if (!scrollEl || !topScrollEl) return

    const trackEl = scrollEl.querySelector('[data-board-columns-track]')
    if (!(trackEl instanceof HTMLElement)) return

    syncTopColumnsScrollMetrics()

    const syncFromMain = () => {
      if (columnsScrollSyncLockRef.current) return
      columnsScrollSyncLockRef.current = true
      topScrollEl.scrollLeft = scrollEl.scrollLeft
      columnsScrollSyncLockRef.current = false
    }

    const syncFromTop = () => {
      if (columnsScrollSyncLockRef.current) return
      columnsScrollSyncLockRef.current = true
      scrollEl.scrollLeft = topScrollEl.scrollLeft
      columnsScrollSyncLockRef.current = false
    }

    scrollEl.addEventListener('scroll', syncFromMain)
    topScrollEl.addEventListener('scroll', syncFromTop)

    const resizeObserver = new ResizeObserver(() => {
      syncTopColumnsScrollMetrics()
    })
    resizeObserver.observe(scrollEl)
    resizeObserver.observe(trackEl)

    return () => {
      scrollEl.removeEventListener('scroll', syncFromMain)
      topScrollEl.removeEventListener('scroll', syncFromTop)
      resizeObserver.disconnect()
    }
  }, [columns.length, syncTopColumnsScrollMetrics])

  useLayoutEffect(() => {
    const area = columnsAreaRef.current
    const scrollEl = columnsScrollRef.current
    if (!area || !scrollEl) return

    const handleWheel = (event: WheelEvent) => {
      if (!(event.target instanceof Node) || !area.contains(event.target)) return
      applyHorizontalColumnsWheelScroll(scrollEl, event)
    }

    area.addEventListener('wheel', handleWheel, { passive: false, capture: true })

    return () => {
      area.removeEventListener('wheel', handleWheel, true)
    }
  }, [columns.length, columnsHorizontallyScrollable])

  const endColumnPan = useCallback((pointerId: number) => {
    const scrollEl = columnsScrollRef.current
    const drag = columnPanDragRef.current
    if (!drag || drag.pointerId !== pointerId) return

    columnPanDragRef.current = null
    setColumnPanActive(false)

    if (scrollEl?.hasPointerCapture(pointerId)) {
      scrollEl.releasePointerCapture(pointerId)
    }
  }, [])

  const handleColumnsPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    if (!isColumnPanScrollTarget(event.target)) return

    const scrollEl = columnsScrollRef.current
    if (!scrollEl) return

    columnPanDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startScrollLeft: scrollEl.scrollLeft,
    }
    setColumnPanActive(true)
    scrollEl.setPointerCapture(event.pointerId)
  }, [])

  const handleColumnsPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = columnPanDragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return

    const scrollEl = columnsScrollRef.current
    if (!scrollEl) return

    scrollEl.scrollLeft = drag.startScrollLeft - (event.clientX - drag.startX)
  }, [])

  const handleColumnsPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      endColumnPan(event.pointerId)
    },
    [endColumnPan],
  )

  const handleColumnsPointerCancel = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      endColumnPan(event.pointerId)
    },
    [endColumnPan],
  )

  return (
    <>
      <div className="motion-fade-in mb-6 flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-navy/10 bg-white p-5 shadow-sm">
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
          <div className="mt-3 flex flex-wrap gap-2">
            {columns.map((column) => (
              <span key={column.id} className="chip">
                {column.title}: {column.tasks.length}
              </span>
            ))}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-3">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={onToggleSelectionMode}
              disabled={crudLocked && !selectionMode}
              className={`press-down rounded-xl border px-3 py-2 text-xs font-bold transition disabled:opacity-50 ${
                selectionMode
                  ? 'border-accent bg-accent/10 text-accent-dark'
                  : 'border-navy/10 bg-white text-navy/70 hover:border-accent/40 hover:text-accent'
              }`}
            >
              {selectionMode ? 'Готово' : 'Выбрать карточки'}
            </button>
            <BoardMembersPicker
              profiles={profiles}
              profilesError={profilesError}
              selectedMemberIds={boardMemberIds}
              accountTeamMemberIds={accountTeamMemberIds}
              teamMemberLimit={teamMemberLimit}
              membersError={membersError}
              membersBillingAction={membersBillingAction}
              onChange={onBoardMembersChange}
            />
            {membersSaving ? (
              <span className="text-[11px] font-medium text-navy/45">Сохранение доступа…</span>
            ) : null}
          </div>
        </div>
      </div>

      {selectionMode ? (
        <div className="motion-fade-in mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-accent/20 bg-accent/5 px-4 py-3">
          <span className="text-sm font-semibold text-navy">
            Выбрано: {selectedCount}
            {totalTasks > 0 ? ` из ${totalTasks}` : ''}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onSelectAllTasks}
              disabled={totalTasks === 0}
              className="rounded-xl border border-navy/10 bg-white px-3 py-2 text-xs font-bold text-navy/70 transition hover:border-accent/40 hover:text-accent disabled:opacity-50"
            >
              Выбрать все
            </button>
            <button
              type="button"
              onClick={onClearSelection}
              disabled={selectedCount === 0}
              className="rounded-xl border border-navy/10 bg-white px-3 py-2 text-xs font-bold text-navy/70 transition hover:border-accent/40 hover:text-accent disabled:opacity-50"
            >
              Снять выбор
            </button>
            <button
              type="button"
              onClick={onBulkDelete}
              disabled={selectedCount === 0 || crudLocked}
              className="rounded-xl bg-red-500 px-3 py-2 text-xs font-bold text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Удалить ({selectedCount})
            </button>
          </div>
        </div>
      ) : null}

      <div
        ref={columnsAreaRef}
        data-board-columns-area
        className="board-columns-area min-w-0 w-full"
        aria-label="Область колонок доски"
      >
        <div
          className={
            columnsHorizontallyScrollable
              ? 'mb-2 min-h-7'
              : 'pointer-events-none mb-0 h-0 overflow-hidden opacity-0'
          }
          aria-hidden={!columnsHorizontallyScrollable}
        >
          <div ref={columnsScrollTopRef} className="board-columns-scroll board-columns-scroll-rail w-full">
            <div ref={columnsScrollTopInnerRef} className="h-px" aria-hidden="true" />
          </div>
        </div>

        <div
          ref={columnsScrollRef}
          data-board-columns-scroll
          className={`board-columns-scroll min-w-0 w-full max-w-full overflow-x-scroll overscroll-x-contain pb-4 ${
            columnPanActive ? 'board-columns-scroll--panning' : ''
          }`}
          onPointerDown={handleColumnsPointerDown}
          onPointerMove={handleColumnsPointerMove}
          onPointerUp={handleColumnsPointerUp}
          onPointerCancel={handleColumnsPointerCancel}
        >
          <div data-board-columns-track className="flex w-max min-w-full gap-4">
          {columns.map((column, columnIndex) => (
            <BoardColumnSection
              key={column.id}
              column={column}
              columnIndex={columnIndex}
              profiles={profiles}
              profilesError={profilesError}
              dragState={dragState}
              columnDragState={columnDragState}
              savingTaskId={savingTaskId}
              assigneeError={assigneeError}
              crudLocked={crudLocked}
              selectionMode={selectionMode}
              selectedTaskIds={selectedTaskIds}
              onToggleTaskSelect={onToggleTaskSelect}
              onCreateTask={onCreateTask}
              onEditColumn={onEditColumn}
              onDeleteColumn={onDeleteColumn}
              onEditTask={onEditTask}
              onDeleteTask={onDeleteTask}
              onOpenComments={onOpenComments}
              onAssigneeChange={onAssigneeChange}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onColumnReorderStart={onColumnReorderStart}
              onColumnReorderEnd={onColumnReorderEnd}
              onColumnDragOver={onColumnDragOver}
              onColumnDragLeave={onColumnDragLeave}
              onColumnDrop={onColumnDrop}
              onTaskDragOver={onTaskDragOver}
              onTaskDrop={onTaskDrop}
            />
          ))}

          <button
            type="button"
            onClick={onCreateColumn}
            disabled={crudLocked || selectionMode}
            data-no-column-pan
            className="board-column-snap press-down flex h-[120px] w-[312px] shrink-0 items-center justify-center rounded-2xl border border-dashed border-navy/15 bg-white/60 text-sm font-bold text-navy/45 transition hover:border-accent/40 hover:bg-accent/5 hover:text-accent disabled:opacity-50"
          >
            + Колонка
          </button>
        </div>
        </div>
      </div>
    </>
  )
}

export function BoardViewPage() {
  const { boardId } = useParams<{ boardId: string }>()
  const navigate = useNavigate()
  const { account, loading, signOut } = useAuth()

  const [board, setBoard] = useState<BoardViewData | null>(null)
  const [columns, setColumns] = useState<BoardViewColumn[]>([])
  const [boardMemberIds, setBoardMemberIds] = useState<string[]>([])
  const [accountTeamMemberIds, setAccountTeamMemberIds] = useState<string[]>([])
  const [subscription, setSubscription] = useState<BillingSubscriptionRow | null>(null)
  const [membersError, setMembersError] = useState<string | null>(null)
  const [membersBillingAction, setMembersBillingAction] =
    useState<BoardCreationBillingAction | null>(null)
  const [membersSaving, setMembersSaving] = useState(false)
  const [boardLoading, setBoardLoading] = useState(true)
  const [boardError, setBoardError] = useState<string | null>(null)
  const [profiles, setProfiles] = useState<AssigneeProfile[]>([])
  const [profilesError, setProfilesError] = useState<string | null>(null)
  const [dragState, setDragState] = useState<DragState>(INITIAL_DRAG_STATE)
  const [columnDragState, setColumnDragState] = useState<ColumnDragState>(INITIAL_COLUMN_DRAG_STATE)
  const [savingTaskId, setSavingTaskId] = useState<string | null>(null)
  const [assigneeError, setAssigneeError] = useState<string | null>(null)
  const [taskForm, setTaskForm] = useState<TaskFormState | null>(null)
  const [taskToDelete, setTaskToDelete] = useState<TaskDeleteState | null>(null)
  const [tasksBulkDelete, setTasksBulkDelete] = useState<TasksBulkDeleteState | null>(null)
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(() => new Set())
  const [taskComments, setTaskComments] = useState<TaskCommentsState | null>(null)
  const [columnForm, setColumnForm] = useState<ColumnFormState | null>(null)
  const [columnToDelete, setColumnToDelete] = useState<ColumnDeleteState | null>(null)
  const [crudBusy, setCrudBusy] = useState(false)
  const [chatMessages, setChatMessages] = useState<BoardMessage[]>([])
  const [chatLoading, setChatLoading] = useState(false)
  const [chatSending, setChatSending] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)
  const dragContextRef = useRef<{ taskId: string; sourceColumnId: string } | null>(null)
  const columnDragRef = useRef<string | null>(null)
  const columnsRef = useRef(columns)
  const processingMessageIdsRef = useRef<Set<string>>(new Set())

  columnsRef.current = columns

  const teamMemberLimit = maxTeamMembersForPlan(subscription?.plan_id)
  const aiSplitEnabled = canUseAiSplit(subscription)
  const aiSplitBlockedMessage = aiSplitEnabled ? null : aiSplitUnavailableMessage(subscription)
  const aiSplitBillingAction: BoardCreationBillingAction | null = aiSplitEnabled
    ? null
    : !subscription || !isActiveSubscription(subscription)
      ? 'subscribe'
      : 'upgrade'

  const crudLocked =
    crudBusy ||
    savingTaskId !== null ||
    dragState.activeTaskId !== null ||
    columnDragState.activeColumnId !== null

  useEffect(() => {
    if (!selectionMode) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectionMode(false)
        setSelectedTaskIds(new Set())
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [selectionMode])

  const findColumnById = useCallback(
    (columnId: string) => columns.find((column) => column.id === columnId) ?? null,
    [columns],
  )

  const findTaskColumn = useCallback(
    (taskId: string) => {
      for (const column of columns) {
        const task = column.tasks.find((item) => item.id === taskId)
        if (task) return { column, task }
      }
      return null
    },
    [columns],
  )

  const mapTaskFromForm = useCallback(
    (taskId: string, values: TaskFormValues, column: BoardViewColumn): BoardTask => {
      const selectedProfiles = values.assigneeIds
        .map((assigneeId) => profiles.find((profile) => profile.id === assigneeId) ?? null)
        .filter((profile): profile is AssigneeProfile => profile !== null)
      const assigneeNames = selectedProfiles.map((profile) => profile.displayName)
      const primaryName = assigneeNames[0] ?? null

      return {
        id: taskId,
        title: values.title,
        status: column.statusKey,
        kind: 'task',
        priority: values.priority,
        description: values.description,
        assigneeId: values.assigneeIds[0] ?? null,
        assigneeIds: values.assigneeIds,
        assigneeName: primaryName,
        assigneeNames,
        assigneeInitials: primaryName ? getProfileInitials(primaryName) : null,
        dueAt: values.dueAt,
        tags: [],
      }
    },
    [profiles],
  )

  useEffect(() => {
    if (!boardId || loading || !account) return

    let cancelled = false

    async function loadBoard(currentBoardId: string) {
      setBoardLoading(true)
      setBoardError(null)

      try {
        const nextBoard = await fetchBoardView(currentBoardId)
        if (cancelled) return

        if (!nextBoard) {
          setBoard(null)
          setColumns([])
          setBoardMemberIds([])
          return
        }

        setBoard(nextBoard)
        setColumns(nextBoard.columns)
        setBoardMemberIds(nextBoard.memberIds)

        const [sub, teamIds] = await Promise.all([
          fetchCurrentSubscription(),
          fetchOwnerDistinctTeamMemberIds(),
        ])
        if (cancelled) return
        setSubscription(sub)
        setAccountTeamMemberIds(teamIds)
      } catch (err) {
        if (!cancelled) {
          setBoard(null)
          setColumns([])
          setBoardError(err instanceof Error ? err.message : 'Не удалось загрузить доску.')
        }
      } finally {
        if (!cancelled) setBoardLoading(false)
      }
    }

    void loadBoard(boardId)

    return () => {
      cancelled = true
    }
  }, [boardId, loading, account])

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

  useEffect(() => {
    if (!boardId || loading || !account) return

    let cancelled = false

    async function loadMessages(currentBoardId: string) {
      setChatLoading(true)
      setChatError(null)

      try {
        const nextMessages = await listBoardMessages(currentBoardId)
        if (!cancelled) setChatMessages(nextMessages)
      } catch (err) {
        if (!cancelled) {
          setChatMessages([])
          setChatError(
            err instanceof Error ? err.message : 'Не удалось загрузить сообщения чата.',
          )
        }
      } finally {
        if (!cancelled) setChatLoading(false)
      }
    }

    void loadMessages(boardId)

    const unsubscribe = subscribeBoardMessages(boardId, (message, event) => {
      setChatMessages((prev) => {
        const existingIndex = prev.findIndex((item) => item.id === message.id)
        if (existingIndex === -1) {
          return event === 'insert' ? [...prev, message] : prev
        }

        const next = [...prev]
        next[existingIndex] = message
        return next
      })
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [boardId, loading, account])

  const appendTasksToBacklog = useCallback((backlogColumnId: string, tasks: BoardTask[]) => {
    if (tasks.length === 0) return

    setColumns((prev) =>
      prev.map((column) =>
        column.id === backlogColumnId
          ? {
              ...column,
              tasks: [
                ...column.tasks,
                ...tasks.filter(
                  (task) => !column.tasks.some((existing) => existing.id === task.id),
                ),
              ],
            }
          : column,
      ),
    )
  }, [])

  const handleChatSubmit = useCallback(
    async (body: string) => {
      if (!boardId) return

      if (!canUseAiSplit(subscription)) {
        const message = aiSplitUnavailableMessage(subscription)
        setChatError(message)
        throw new Error(message)
      }

      setChatSending(true)
      setChatError(null)

      let message: BoardMessage
      try {
        message = await createBoardMessage(boardId, body)
        setChatMessages((prev) =>
          prev.some((item) => item.id === message.id) ? prev : [...prev, message],
        )
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Не удалось отправить сообщение.'
        setChatError(errorMessage)
        throw new Error(errorMessage)
      }

      if (processingMessageIdsRef.current.has(message.id)) {
        setChatSending(false)
        return
      }

      processingMessageIdsRef.current.add(message.id)

      try {
        const result = await runBoardMessageAiSplit({
          boardId,
          title: message.body,
          description: message.body,
        })

        const tasks = mapAiSplitToBoardTasks(result)
        appendTasksToBacklog(result.backlogColumnId, tasks)

        const subtaskCount = Math.max(tasks.length - 1, 0)
        const summary = `Создан эпик «${result.epic.title}» и ${subtaskCount} подзадач.`

        await updateBoardMessageAiStatus(message.id, 'success', summary)
        setChatMessages((prev) =>
          prev.map((item) =>
            item.id === message.id
              ? { ...item, aiRunStatus: 'success', aiResultSummary: summary }
              : item,
          ),
        )
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Не удалось разбить задачу через AI.'

        await updateBoardMessageAiStatus(message.id, 'error', errorMessage)
        setChatMessages((prev) =>
          prev.map((item) =>
            item.id === message.id
              ? { ...item, aiRunStatus: 'error', aiResultSummary: errorMessage }
              : item,
          ),
        )
        throw new Error(errorMessage)
      } finally {
        processingMessageIdsRef.current.delete(message.id)
        setChatSending(false)
      }
    },
    [appendTasksToBacklog, boardId, subscription],
  )

  const handleOpenCreateTask = useCallback((columnId: string) => {
    setTaskForm({ mode: 'create', columnId })
  }, [])

  const handleBoardMembersChange = useCallback(
    async (ids: string[]) => {
      if (!board) return

      const prev = boardMemberIds
      const added = ids.filter((id) => !prev.includes(id))

      for (const profileId of added) {
        if (accountTeamMemberIds.includes(profileId)) continue
        const max = maxTeamMembersForPlan(subscription?.plan_id)
        if (max !== null && accountTeamMemberIds.length >= max) {
          setMembersError(`На вашем тарифе доступно до ${max} участников во всех проектах.`)
          setMembersBillingAction('upgrade')
          return
        }
      }

      setMembersError(null)
      setMembersBillingAction(null)
      setBoardMemberIds(ids)
      setMembersSaving(true)

      try {
        await saveBoardMembers(board.id, ids)
        const teamIds = await fetchOwnerDistinctTeamMemberIds()
        setAccountTeamMemberIds(teamIds)
      } catch (err) {
        setBoardMemberIds(prev)
        if (err instanceof BoardLimitError) {
          setMembersError(err.message)
          setMembersBillingAction(err.billingAction)
        } else {
          setMembersError(
            err instanceof Error ? err.message : 'Не удалось обновить участников доски.',
          )
          setMembersBillingAction(null)
        }
      } finally {
        setMembersSaving(false)
      }
    },
    [board, boardMemberIds, accountTeamMemberIds, subscription?.plan_id],
  )

  const handleOpenCreateColumn = useCallback(() => {
    setColumnForm({ mode: 'create' })
  }, [])

  const handleOpenEditColumn = useCallback((column: BoardViewColumn) => {
    setColumnForm({ mode: 'edit', column })
  }, [])

  const handleOpenDeleteColumn = useCallback((column: BoardViewColumn) => {
    if (column.statusKey === BACKLOG_STATUS_KEY) return
    setColumnToDelete({ column })
  }, [])

  const handleOpenEditTask = useCallback(
    (task: BoardTask) => {
      const located = findTaskColumn(task.id)
      if (!located) return
      setTaskForm({ mode: 'edit', columnId: located.column.id, task: located.task })
    },
    [findTaskColumn],
  )

  const handleOpenDeleteTask = useCallback(
    (task: BoardTask) => {
      const located = findTaskColumn(task.id)
      if (!located) return
      setTaskToDelete({ task: located.task, columnId: located.column.id })
    },
    [findTaskColumn],
  )

  const handleToggleSelectionMode = useCallback(() => {
    setSelectionMode((prev) => {
      if (prev) setSelectedTaskIds(new Set())
      return !prev
    })
  }, [])

  const handleToggleTaskSelect = useCallback((taskId: string) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev)
      if (next.has(taskId)) next.delete(taskId)
      else next.add(taskId)
      return next
    })
  }, [])

  const handleSelectAllTasks = useCallback(() => {
    const allIds = columns.flatMap((column) => column.tasks.map((task) => task.id))
    setSelectedTaskIds(new Set(allIds))
  }, [columns])

  const handleClearSelection = useCallback(() => {
    setSelectedTaskIds(new Set())
  }, [])

  const handleOpenBulkDelete = useCallback(() => {
    if (selectedTaskIds.size === 0) return
    setTasksBulkDelete({ taskIds: [...selectedTaskIds] })
  }, [selectedTaskIds])

  const handleCloseDeleteModal = useCallback(() => {
    setTaskToDelete(null)
    setTasksBulkDelete(null)
  }, [])

  const handleOpenComments = useCallback(
    (task: BoardTask) => {
      const located = findTaskColumn(task.id)
      if (!located) return
      setTaskComments({ task: located.task })
    },
    [findTaskColumn],
  )

  const handleTaskFormSubmit = useCallback(
    async (values: TaskFormValues) => {
      if (!boardId || !taskForm) return

      const column = findColumnById(taskForm.columnId)
      if (!column) throw new Error('Колонка не найдена.')

      const previousColumns = columnsRef.current
      setBoardError(null)
      setCrudBusy(true)

      if (taskForm.mode === 'create') {
        const tempId = `temp-${Date.now()}`
        const optimisticTask = mapTaskFromForm(tempId, values, column)

        setColumns((prev) =>
          prev.map((item) =>
            item.id === column.id ? { ...item, tasks: [...item.tasks, optimisticTask] } : item,
          ),
        )

        try {
          const createdTask = await createTask({
            boardId,
            columnId: column.id,
            status: column.statusKey,
            title: values.title,
            priority: values.priority,
            description: values.description,
            dueAt: values.dueAt,
            assigneeIds: values.assigneeIds,
          })

          setColumns((prev) =>
            prev.map((item) =>
              item.id === column.id
                ? {
                    ...item,
                    tasks: item.tasks.map((task) => (task.id === tempId ? createdTask : task)),
                  }
                : item,
            ),
          )
        } catch (err) {
          setColumns(previousColumns)
          throw err
        } finally {
          setCrudBusy(false)
        }

        return
      }

      const { task } = taskForm
      const optimisticTask = mapTaskFromForm(task.id, values, column)

      setColumns((prev) =>
        prev.map((item) => ({
          ...item,
          tasks: item.tasks.map((entry) => (entry.id === task.id ? optimisticTask : entry)),
        })),
      )

      try {
        const updatedTask = await updateTask({
          taskId: task.id,
          boardId,
          title: values.title,
          priority: values.priority,
          description: values.description,
          dueAt: values.dueAt,
          assigneeIds: values.assigneeIds,
        })

        setColumns((prev) =>
          prev.map((item) => ({
            ...item,
            tasks: item.tasks.map((entry) => (entry.id === task.id ? updatedTask : entry)),
          })),
        )
      } catch (err) {
        setColumns(previousColumns)
        throw err
      } finally {
        setCrudBusy(false)
      }
    },
    [boardId, taskForm, findColumnById, mapTaskFromForm],
  )

  const handleConfirmDeleteTask = useCallback(async () => {
    if (!boardId || !taskToDelete) return

    const column = findColumnById(taskToDelete.columnId)
    if (!column) throw new Error('Колонка не найдена.')

    const previousColumns = columnsRef.current
    const remainingTaskIds = column.tasks
      .filter((task) => task.id !== taskToDelete.task.id)
      .map((task) => task.id)

    setBoardError(null)
    setCrudBusy(true)

    setColumns((prev) =>
      prev.map((item) =>
        item.id === column.id
          ? { ...item, tasks: item.tasks.filter((task) => task.id !== taskToDelete.task.id) }
          : item,
      ),
    )

    try {
      await deleteTask(
        taskToDelete.task.id,
        boardId,
        column.id,
        column.statusKey,
        remainingTaskIds,
      )
    } catch (err) {
      setColumns(previousColumns)
      const message = err instanceof Error ? err.message : 'Не удалось удалить карточку.'
      setBoardError(message)
      throw new Error(message)
    } finally {
      setCrudBusy(false)
    }
  }, [boardId, taskToDelete, findColumnById])

  const handleConfirmBulkDelete = useCallback(async () => {
    if (!boardId || !tasksBulkDelete) return

    const idsToDelete = new Set(tasksBulkDelete.taskIds)
    const previousColumns = columnsRef.current

    setBoardError(null)
    setCrudBusy(true)

    setColumns((prev) =>
      prev.map((column) => ({
        ...column,
        tasks: column.tasks.filter((task) => !idsToDelete.has(task.id)),
      })),
    )

    try {
      await deleteTasks(boardId, tasksBulkDelete.taskIds, previousColumns)
      setSelectedTaskIds(new Set())
      setSelectionMode(false)
    } catch (err) {
      setColumns(previousColumns)
      const message = err instanceof Error ? err.message : 'Не удалось удалить карточки.'
      setBoardError(message)
      throw new Error(message)
    } finally {
      setCrudBusy(false)
    }
  }, [boardId, tasksBulkDelete])

  const handleColumnFormSubmit = useCallback(
    async (title: string) => {
      if (!boardId || !columnForm) return

      const previousColumns = columnsRef.current
      setBoardError(null)
      setCrudBusy(true)

      if (columnForm.mode === 'create') {
        try {
          const createdColumn = await createBoardColumn(boardId, title)
          setColumns((prev) => [...prev, createdColumn])
        } catch (err) {
          setColumns(previousColumns)
          throw err
        } finally {
          setCrudBusy(false)
        }

        return
      }

      const { column } = columnForm

      setColumns((prev) =>
        prev.map((item) => (item.id === column.id ? { ...item, title } : item)),
      )

      try {
        await updateBoardColumn(column.id, title)
      } catch (err) {
        setColumns(previousColumns)
        throw err
      } finally {
        setCrudBusy(false)
      }
    },
    [boardId, columnForm],
  )

  const handleConfirmDeleteColumn = useCallback(async () => {
    if (!boardId || !columnToDelete) return

    const previousColumns = columnsRef.current
    setBoardError(null)
    setCrudBusy(true)

    try {
      const nextColumns = await deleteBoardColumn(
        boardId,
        columnToDelete.column.id,
        previousColumns,
      )
      setColumns(nextColumns)
    } catch (err) {
      setColumns(previousColumns)
      const message = err instanceof Error ? err.message : 'Не удалось удалить колонку.'
      setBoardError(message)
      throw new Error(message)
    } finally {
      setCrudBusy(false)
    }
  }, [boardId, columnToDelete])

  const handleAssigneeChange = useCallback(
    async (taskId: string, assigneeIds: string[]) => {
      const previousColumns = columnsRef.current

      setAssigneeError(null)
      setSavingTaskId(taskId)
      setColumns((prev) => applyAssigneeUpdate(prev, taskId, assigneeIds, profiles))

      try {
        await syncTaskAssignees(taskId, assigneeIds)
      } catch (err) {
        setColumns(previousColumns)
        const message =
          err instanceof Error ? err.message : 'Не удалось сохранить исполнителей.'
        setAssigneeError(message)
        throw new Error(message)
      } finally {
        setSavingTaskId(null)
      }
    },
    [profiles],
  )

  const handleDragStart = useCallback(
    (event: DragEvent<HTMLElement>, taskId: string, columnId: string) => {
      if (selectionMode) {
        event.preventDefault()
        return
      }

      if (isInteractiveDragTarget(event.target)) {
        event.preventDefault()
        return
      }

      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.setData('text/plain', taskId)
      event.dataTransfer.setDragImage(event.currentTarget, 24, 24)
      dragContextRef.current = { taskId, sourceColumnId: columnId }

      setDragState({
        activeTaskId: taskId,
        sourceColumnId: columnId,
        overColumnId: columnId,
        overTaskId: null,
      })
    },
    [selectionMode],
  )

  const handleDragEnd = useCallback(() => {
    dragContextRef.current = null
    setDragState(INITIAL_DRAG_STATE)
  }, [])

  const handleColumnReorderStart = useCallback(
    (event: DragEvent<HTMLElement>, columnId: string) => {
      if (selectionMode || crudBusy || savingTaskId !== null || dragState.activeTaskId !== null) {
        event.preventDefault()
        return
      }

      event.stopPropagation()
      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.setData('text/plain', columnId)
      event.dataTransfer.setData('application/x-board-column-id', columnId)
      columnDragRef.current = columnId

      setColumnDragState({
        activeColumnId: columnId,
        overColumnId: columnId,
      })
    },
    [selectionMode, crudBusy, savingTaskId, dragState.activeTaskId],
  )

  const handleColumnReorderEnd = useCallback(() => {
    columnDragRef.current = null
    setColumnDragState(INITIAL_COLUMN_DRAG_STATE)
  }, [])

  const handleColumnDragOver = useCallback((event: DragEvent<HTMLElement>, columnId: string) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'

    if (columnDragRef.current) {
      setColumnDragState((prev) => {
        if (!prev.activeColumnId || prev.overColumnId === columnId) return prev

        return {
          ...prev,
          overColumnId: columnId,
        }
      })
      return
    }

    setDragState((prev) => {
      if (!prev.activeTaskId) return prev

      return {
        ...prev,
        overColumnId: columnId,
        overTaskId: null,
      }
    })
  }, [])

  const handleColumnDragLeave = useCallback((event: DragEvent<HTMLElement>, columnId: string) => {
    const relatedTarget = event.relatedTarget
    if (relatedTarget instanceof Node && event.currentTarget.contains(relatedTarget)) {
      return
    }

    if (columnDragRef.current) {
      setColumnDragState((prev) => {
        if (prev.overColumnId !== columnId) return prev

        return {
          ...prev,
          overColumnId: null,
        }
      })
      return
    }

    setDragState((prev) => {
      if (prev.overColumnId !== columnId) return prev

      return {
        ...prev,
        overColumnId: null,
        overTaskId: null,
      }
    })
  }, [])

  const handleTaskDragOver = useCallback(
    (event: DragEvent<HTMLElement>, columnId: string, taskId: string) => {
      event.preventDefault()
      event.stopPropagation()
      event.dataTransfer.dropEffect = 'move'

      setDragState((prev) => {
        if (!prev.activeTaskId || prev.activeTaskId === taskId) return prev

        return {
          ...prev,
          overColumnId: columnId,
          overTaskId: taskId,
        }
      })
    },
    [],
  )

  const handleDrop = useCallback(
    (targetColumnId: string, targetTaskId: string | null) => {
      const dragContext = dragContextRef.current
      if (!dragContext || !boardId) return

      const previousColumns = columnsRef.current

      setColumns((prev) => {
        const nextColumns = moveTask(prev, {
          taskId: dragContext.taskId,
          sourceColumnId: dragContext.sourceColumnId,
          targetColumnId,
          targetTaskId,
        })

        void saveBoardColumnsState(boardId, nextColumns).catch((err) => {
          setColumns(previousColumns)
          setBoardError(
            err instanceof Error ? err.message : 'Не удалось сохранить порядок задач.',
          )
        })

        return nextColumns
      })

      dragContextRef.current = null
      setDragState(INITIAL_DRAG_STATE)
    },
    [boardId],
  )

  const handleColumnDrop = useCallback(
    (event: DragEvent<HTMLElement>, columnId: string) => {
      event.preventDefault()

      const sourceColumnId = columnDragRef.current
      if (sourceColumnId && boardId) {
        if (sourceColumnId !== columnId) {
          const previousColumns = columnsRef.current

          setColumns((prev) => {
            const nextColumns = moveColumn(prev, sourceColumnId, columnId)

            void reindexBoardColumns(
              boardId,
              nextColumns.map((column) => column.id),
            ).catch((err) => {
              setColumns(previousColumns)
              setBoardError(
                err instanceof Error ? err.message : 'Не удалось сохранить порядок колонок.',
              )
            })

            return nextColumns
          })
        }

        columnDragRef.current = null
        setColumnDragState(INITIAL_COLUMN_DRAG_STATE)
        return
      }

      handleDrop(columnId, null)
    },
    [boardId, handleDrop],
  )

  const handleTaskDrop = useCallback(
    (event: DragEvent<HTMLElement>, columnId: string, taskId: string) => {
      event.preventDefault()
      event.stopPropagation()
      handleDrop(columnId, taskId)
    },
    [handleDrop],
  )

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  if (loading || !account || boardLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <span className="text-sm text-navy/50">Загрузка…</span>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-surface to-surface-alt">
      <header className="sticky top-0 z-30 border-b border-navy/10 bg-surface/95 backdrop-blur">
        <div className="section-shell flex h-20 items-center justify-between">
          <Link to="/" aria-label="AiVibeBoard — на главную" className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 rotate-3 items-center justify-center rounded-2xl bg-navy text-accent shadow-card">
              <LogoIcon />
            </div>
            <span className="text-xl font-black tracking-[-0.04em] text-navy">
              AI VIBE<span className="text-accent">.</span>
            </span>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
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
        {boardError ? (
          <div
            className="mb-6 rounded-2xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-700"
            role="alert"
          >
            {boardError}
          </div>
        ) : null}

        {board ? (
          <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_280px] xl:gap-8 2xl:grid-cols-[minmax(0,1fr)_296px]">
            <div className="min-w-0">
              <BoardViewContent
                board={board}
                columns={columns}
                profiles={profiles}
                profilesError={profilesError}
                boardMemberIds={boardMemberIds}
                accountTeamMemberIds={accountTeamMemberIds}
                teamMemberLimit={teamMemberLimit}
                membersError={membersError}
                membersBillingAction={membersBillingAction}
                membersSaving={membersSaving}
                dragState={dragState}
                columnDragState={columnDragState}
                savingTaskId={savingTaskId}
                assigneeError={assigneeError}
                crudLocked={crudLocked}
                selectionMode={selectionMode}
                selectedTaskIds={selectedTaskIds}
                onToggleSelectionMode={handleToggleSelectionMode}
                onToggleTaskSelect={handleToggleTaskSelect}
                onSelectAllTasks={handleSelectAllTasks}
                onClearSelection={handleClearSelection}
                onBulkDelete={handleOpenBulkDelete}
                onBoardMembersChange={handleBoardMembersChange}
                onCreateColumn={handleOpenCreateColumn}
                onCreateTask={handleOpenCreateTask}
                onEditColumn={handleOpenEditColumn}
                onDeleteColumn={handleOpenDeleteColumn}
                onEditTask={handleOpenEditTask}
                onDeleteTask={handleOpenDeleteTask}
                onOpenComments={handleOpenComments}
                onAssigneeChange={handleAssigneeChange}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onColumnReorderStart={handleColumnReorderStart}
                onColumnReorderEnd={handleColumnReorderEnd}
                onColumnDragOver={handleColumnDragOver}
                onColumnDragLeave={handleColumnDragLeave}
                onColumnDrop={handleColumnDrop}
                onTaskDragOver={handleTaskDragOver}
                onTaskDrop={handleTaskDrop}
              />
            </div>

            <div className="min-w-0 xl:sticky xl:top-[5.25rem] xl:self-start">
              <BoardChatPanel
                boardId={board.id}
                currentUserId={account.id}
                messages={chatMessages}
                loading={chatLoading}
                sending={chatSending}
                error={chatError}
                aiSplitEnabled={aiSplitEnabled}
                aiSplitBlockedMessage={aiSplitBlockedMessage}
                aiSplitBillingAction={aiSplitBillingAction}
                onSendMessage={handleChatSubmit}
              />
            </div>
          </div>
        ) : (
          <BoardNotFound />
        )}
      </main>

      <TaskFormModal
        isOpen={taskForm !== null}
        mode={taskForm?.mode ?? 'create'}
        columnTitle={taskForm ? findColumnById(taskForm.columnId)?.title : undefined}
        initialTitle={taskForm?.mode === 'edit' ? taskForm.task.title : ''}
        initialPriority={taskForm?.mode === 'edit' ? taskForm.task.priority : 'medium'}
        initialDescription={taskForm?.mode === 'edit' ? taskForm.task.description : null}
        initialDueAt={taskForm?.mode === 'edit' ? taskForm.task.dueAt : null}
        initialAssigneeIds={
          taskForm?.mode === 'edit'
            ? (taskForm.task.assigneeIds ?? (taskForm.task.assigneeId ? [taskForm.task.assigneeId] : []))
            : []
        }
        profiles={profiles}
        profilesError={profilesError}
        onClose={() => setTaskForm(null)}
        onSubmit={handleTaskFormSubmit}
      />

      <DeleteTaskModal
        isOpen={taskToDelete !== null || tasksBulkDelete !== null}
        taskTitle={taskToDelete?.task.title ?? ''}
        taskCount={tasksBulkDelete?.taskIds.length ?? 1}
        onClose={handleCloseDeleteModal}
        onConfirm={tasksBulkDelete ? handleConfirmBulkDelete : handleConfirmDeleteTask}
      />

      <TaskCommentsModal
        isOpen={taskComments !== null}
        taskId={taskComments?.task.id ?? ''}
        taskTitle={taskComments?.task.title ?? ''}
        currentUserId={account?.id ?? null}
        onClose={() => setTaskComments(null)}
      />

      <ColumnFormModal
        isOpen={columnForm !== null}
        mode={columnForm?.mode ?? 'create'}
        initialTitle={columnForm?.mode === 'edit' ? columnForm.column.title : ''}
        onClose={() => setColumnForm(null)}
        onSubmit={handleColumnFormSubmit}
      />

      <DeleteColumnModal
        isOpen={columnToDelete !== null}
        columnTitle={columnToDelete?.column.title ?? ''}
        taskCount={columnToDelete?.column.tasks.length ?? 0}
        onClose={() => setColumnToDelete(null)}
        onConfirm={handleConfirmDeleteColumn}
      />
    </div>
  )
}
