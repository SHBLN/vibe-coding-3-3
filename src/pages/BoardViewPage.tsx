import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
} from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AssigneePicker } from '../components/board/AssigneePicker'
import { BoardMembersPicker } from '../components/board/BoardMembersPicker'
import { ColumnFormModal } from '../components/board/ColumnFormModal'
import { DeleteColumnModal } from '../components/board/DeleteColumnModal'
import { DeleteTaskModal } from '../components/board/DeleteTaskModal'
import { TaskFormModal, type TaskFormValues } from '../components/board/TaskFormModal'
import { AccountBadge } from '../components/landing/AccountBadge'
import { ButtonPrimary, LogoIcon } from '../components/landing/ui'
import { useAuth } from '../hooks/useAuth'
import {
  BACKLOG_STATUS_KEY,
  createBoardColumn,
  createTask,
  deleteBoardColumn,
  deleteTask,
  fetchBoardView,
  reindexBoardColumns,
  saveBoardColumnsState,
  syncTaskAssignees,
  updateBoardColumn,
  updateTask,
} from '../lib/boardTasks'
import { getProfileInitials, listProfiles, type AssigneeProfile } from '../lib/profiles'
import {
  DONE_STATUS_KEY,
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
  onEdit: (task: BoardTask) => void
  onDelete: (task: BoardTask) => void
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
  onEdit,
  onDelete,
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

  return (
    <article
      draggable
      onDragStart={(event) => onDragStart(event, task.id, columnId)}
      onDragEnd={onDragEnd}
      onDragOver={(event) => onDragOver(event, columnId, task.id)}
      onDrop={(event) => onDrop(event, columnId, task.id)}
      className={`group flex h-[210px] sm:h-[220px] flex-col overflow-hidden rounded-xl border bg-white p-4 shadow-sm transition ${
        isDragging
          ? 'cursor-grabbing border-accent/40 opacity-50 shadow-none'
          : 'hover-lift cursor-grab border-navy/10 hover:border-accent/30 hover:shadow-card'
      } ${isDropTarget ? 'border-t-2 border-t-accent ring-2 ring-accent/20' : ''}`}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-start gap-2">
        <span
          className="mt-0.5 shrink-0 rounded-md p-0.5 text-navy/25 transition group-hover:text-navy/45"
          aria-hidden="true"
        >
          <DragGripIcon />
        </span>
        <div className="flex min-w-0 flex-1 flex-wrap items-start gap-2">
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
        </div>
        <div className="flex shrink-0 gap-1 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100" data-no-drag>
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
        </div>
      </div>

      <h4 className="line-clamp-2 min-h-[2.75rem] text-sm font-bold leading-snug text-navy">
        {task.title}
      </h4>

      <p
        className={`mt-1.5 min-h-[1rem] text-xs ${
          task.parentTitle ? 'text-navy/45' : 'select-none text-transparent'
        }`}
      >
        {task.parentTitle ? `↳ ${task.parentTitle}` : '—'}
      </p>

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
  onCreateTask: (columnId: string) => void
  onEditColumn: (column: BoardViewColumn) => void
  onDeleteColumn: (column: BoardViewColumn) => void
  onEditTask: (task: BoardTask) => void
  onDeleteTask: (task: BoardTask) => void
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
  onCreateTask,
  onEditColumn,
  onDeleteColumn,
  onEditTask,
  onDeleteTask,
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
      className={`motion-stagger flex w-[312px] shrink-0 flex-col rounded-2xl border bg-surface p-4 shadow-sm transition ${
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
              disabled={crudLocked}
              aria-label="Редактировать колонку"
              className="press-down rounded-lg p-1.5 text-navy/40 hover:bg-white hover:text-navy disabled:opacity-50"
            >
              <PencilIcon />
            </button>
            {!isBacklog ? (
              <button
                type="button"
                onClick={() => onDeleteColumn(column)}
                disabled={crudLocked}
                aria-label="Удалить колонку"
                className="press-down rounded-lg p-1.5 text-navy/40 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
              >
                <TrashIcon />
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => onCreateTask(column.id)}
              disabled={crudLocked}
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
                onEdit={onEditTask}
                onDelete={onDeleteTask}
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
  dragState: DragState
  columnDragState: ColumnDragState
  savingTaskId: string | null
  assigneeError: string | null
  crudLocked: boolean
  onBoardMembersChange: (ids: string[]) => void
  onCreateColumn: () => void
  onCreateTask: (columnId: string) => void
  onEditColumn: (column: BoardViewColumn) => void
  onDeleteColumn: (column: BoardViewColumn) => void
  onEditTask: (task: BoardTask) => void
  onDeleteTask: (task: BoardTask) => void
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
  dragState,
  columnDragState,
  savingTaskId,
  assigneeError,
  crudLocked,
  onBoardMembersChange,
  onCreateColumn,
  onCreateTask,
  onEditColumn,
  onDeleteColumn,
  onEditTask,
  onDeleteTask,
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

        <div className="shrink-0">
          <BoardMembersPicker
            profiles={profiles}
            profilesError={profilesError}
            selectedMemberIds={boardMemberIds}
            onChange={onBoardMembersChange}
          />
        </div>
      </div>

      <div className="-mx-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
        <div className="flex min-w-min gap-4">
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
              onCreateTask={onCreateTask}
              onEditColumn={onEditColumn}
              onDeleteColumn={onDeleteColumn}
              onEditTask={onEditTask}
              onDeleteTask={onDeleteTask}
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
            disabled={crudLocked}
            className="press-down flex h-[120px] w-[312px] shrink-0 items-center justify-center rounded-2xl border border-dashed border-navy/15 bg-white/60 text-sm font-bold text-navy/45 transition hover:border-accent/40 hover:bg-accent/5 hover:text-accent disabled:opacity-50"
          >
            + Колонка
          </button>
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
  const [columnForm, setColumnForm] = useState<ColumnFormState | null>(null)
  const [columnToDelete, setColumnToDelete] = useState<ColumnDeleteState | null>(null)
  const [crudBusy, setCrudBusy] = useState(false)
  const dragContextRef = useRef<{ taskId: string; sourceColumnId: string } | null>(null)
  const columnDragRef = useRef<string | null>(null)
  const columnsRef = useRef(columns)

  columnsRef.current = columns

  const crudLocked =
    crudBusy ||
    savingTaskId !== null ||
    dragState.activeTaskId !== null ||
    columnDragState.activeColumnId !== null

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

  const handleOpenCreateTask = useCallback((columnId: string) => {
    setTaskForm({ mode: 'create', columnId })
  }, [])

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
    [],
  )

  const handleDragEnd = useCallback(() => {
    dragContextRef.current = null
    setDragState(INITIAL_DRAG_STATE)
  }, [])

  const handleColumnReorderStart = useCallback(
    (event: DragEvent<HTMLElement>, columnId: string) => {
      if (crudBusy || savingTaskId !== null || dragState.activeTaskId !== null) {
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
    [crudBusy, savingTaskId, dragState.activeTaskId],
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

          <AccountBadge account={account} onSignOut={handleSignOut} />
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
          <BoardViewContent
            board={board}
            columns={columns}
            profiles={profiles}
            profilesError={profilesError}
            boardMemberIds={boardMemberIds}
            dragState={dragState}
            columnDragState={columnDragState}
            savingTaskId={savingTaskId}
            assigneeError={assigneeError}
            crudLocked={crudLocked}
            onBoardMembersChange={setBoardMemberIds}
            onCreateColumn={handleOpenCreateColumn}
            onCreateTask={handleOpenCreateTask}
            onEditColumn={handleOpenEditColumn}
            onDeleteColumn={handleOpenDeleteColumn}
            onEditTask={handleOpenEditTask}
            onDeleteTask={handleOpenDeleteTask}
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
        ) : (
          <BoardNotFound />
        )}
      </main>

      <TaskFormModal
        isOpen={taskForm !== null}
        mode={taskForm?.mode ?? 'create'}
        columnTitle={taskForm ? findColumnById(taskForm.columnId)?.title : undefined}
        initialTitle={taskForm?.mode === 'edit' ? taskForm.task.title : ''}
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
        isOpen={taskToDelete !== null}
        taskTitle={taskToDelete?.task.title ?? ''}
        onClose={() => setTaskToDelete(null)}
        onConfirm={handleConfirmDeleteTask}
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
