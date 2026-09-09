export type TaskStatus = string

export const BACKLOG_STATUS_KEY = 'backlog'
export const DONE_STATUS_KEY = 'done'

export type TaskKind = 'task' | 'epic'

export type TaskPriority = 'low' | 'medium' | 'high'

export type BoardTask = {
  id: string
  title: string
  status: TaskStatus
  kind: TaskKind
  priority: TaskPriority
  description: string | null
  /** Основной исполнитель для обратной совместимости со старым UI */
  assigneeId: string | null
  /** Множественные исполнители (UI-only), если нужно назначить нескольких */
  assigneeIds?: string[]
  /** Fallback для моков без реального profile id */
  assigneeName?: string | null
  /** Fallback для множественного назначения */
  assigneeNames?: string[]
  assigneeInitials?: string | null
  dueAt: string | null
  parentTitle?: string
  tags?: string[]
}

export type BoardViewColumn = {
  id: string
  title: string
  statusKey: string
  /** Статус задач в колонке — совпадает с statusKey колонки */
  status: TaskStatus
  tasks: BoardTask[]
}

export type BoardViewData = {
  id: string
  title: string
  description: string
  updatedAt: string
  memberIds: string[]
  columns: BoardViewColumn[]
}

const MOCK_BOARDS: Record<string, BoardViewData> = {
  'sprint-12': {
    id: 'sprint-12',
    title: 'Спринт 12',
    description: 'Фокус на Telegram-интеграции и roadmap по эпикам.',
    updatedAt: '2026-09-08T14:30:00.000Z',
    memberIds: [],
    columns: [
      {
        id: 'col-todo',
        title: 'Backlog',
        statusKey: 'backlog',
        status: 'backlog',
        tasks: [
          {
            id: 'task-1',
            title: 'Webhook Telegram с проверкой secret',
            status: 'backlog',
            kind: 'task',
            priority: 'medium',
            description: null,
            assigneeId: null,
            assigneeName: 'Алексей К.',
            assigneeInitials: 'АК',
            dueAt: '2026-09-12T18:00:00.000Z',
            parentTitle: 'Telegram-бот',
            tags: ['backend', 'telegram'],
          },
          {
            id: 'task-2',
            title: 'Маппинг Telegram user ↔ профиль',
            status: 'backlog',
            kind: 'task',
            priority: 'medium',
            description: null,
            assigneeId: null,
            assigneeName: 'Мария С.',
            assigneeInitials: 'МС',
            dueAt: '2026-09-10T18:00:00.000Z',
            parentTitle: 'Telegram-бот',
            tags: ['supabase'],
          },
          {
            id: 'task-3',
            title: 'Пустая колонка — демо состояния',
            status: 'backlog',
            kind: 'task',
            priority: 'medium',
            description: null,
            assigneeId: null,
            assigneeName: null,
            assigneeInitials: null,
            dueAt: null,
          },
        ],
      },
      {
        id: 'col-progress',
        title: 'In progress',
        statusKey: 'in_progress',
        status: 'in_progress',
        tasks: [
          {
            id: 'task-4',
            title: 'ИИ-разбиение глобальной задачи на подзадачи',
            status: 'in_progress',
            kind: 'task',
            priority: 'medium',
            description: null,
            assigneeId: null,
            assigneeName: 'Иван П.',
            assigneeInitials: 'ИП',
            dueAt: '2026-09-09T12:00:00.000Z',
            parentTitle: 'AI Board',
            tags: ['ai', 'edge-functions'],
          },
          {
            id: 'task-5',
            title: 'Roadmap: ось времени по due_at',
            status: 'in_progress',
            kind: 'task',
            priority: 'medium',
            description: null,
            assigneeId: null,
            assigneeName: 'Мария С.',
            assigneeInitials: 'МС',
            dueAt: '2026-09-15T18:00:00.000Z',
            parentTitle: 'Roadmap v1',
            tags: ['frontend'],
          },
        ],
      },
      {
        id: 'col-review',
        title: 'Review',
        statusKey: 'review',
        status: 'review',
        tasks: [],
      },
      {
        id: 'col-done',
        title: 'Done',
        statusKey: 'done',
        status: 'done',
        tasks: [
          {
            id: 'task-6',
            title: 'Страница списка досок',
            status: 'done',
            kind: 'task',
            priority: 'medium',
            description: null,
            assigneeId: null,
            assigneeName: 'Алексей К.',
            assigneeInitials: 'АК',
            dueAt: '2026-09-05T18:00:00.000Z',
            tags: ['frontend'],
          },
        ],
      },
    ],
  },
  'roadmap-q3': {
    id: 'roadmap-q3',
    title: 'Roadmap Q3',
    description: 'Эпики и вехи на третий квартал.',
    updatedAt: '2026-09-07T09:00:00.000Z',
    memberIds: [],
    columns: [
      {
        id: 'col-todo-r',
        title: 'Backlog',
        statusKey: 'backlog',
        status: 'backlog',
        tasks: [
          {
            id: 'epic-1',
            title: 'Telegram-бот для постановки задач',
            status: 'backlog',
            kind: 'epic',
            priority: 'medium',
            description: null,
            assigneeId: null,
            assigneeName: 'Алексей К.',
            assigneeInitials: 'АК',
            dueAt: '2026-09-30T18:00:00.000Z',
            tags: ['epic', 'telegram'],
          },
        ],
      },
      {
        id: 'col-progress-r',
        title: 'In progress',
        statusKey: 'in_progress',
        status: 'in_progress',
        tasks: [
          {
            id: 'epic-2',
            title: 'AI Board + распределение нагрузки',
            status: 'in_progress',
            kind: 'epic',
            priority: 'medium',
            description: null,
            assigneeId: null,
            assigneeName: 'Иван П.',
            assigneeInitials: 'ИП',
            dueAt: '2026-09-20T18:00:00.000Z',
            tags: ['epic', 'ai'],
          },
        ],
      },
      {
        id: 'col-review-r',
        title: 'Review',
        statusKey: 'review',
        status: 'review',
        tasks: [],
      },
      {
        id: 'col-done-r',
        title: 'Done',
        statusKey: 'done',
        status: 'done',
        tasks: [],
      },
    ],
  },
}

const DEFAULT_MOCK_BOARD: Omit<BoardViewData, 'id'> = {
  title: 'Демо-доска',
  description: 'UI-only просмотр доски с мок-данными.',
  updatedAt: '2026-09-09T10:00:00.000Z',
  memberIds: [],
  columns: MOCK_BOARDS['sprint-12'].columns,
}

export function getMockBoard(boardId: string | undefined): BoardViewData | null {
  if (!boardId) return null

  const exact = MOCK_BOARDS[boardId]
  if (exact) return exact

  // UI-only fallback: любой id из списка досок открывает демо-контент
  return {
    ...DEFAULT_MOCK_BOARD,
    id: boardId,
    title: 'Демо-доска',
  }
}

export function isKnownMockBoardId(boardId: string): boolean {
  return boardId in MOCK_BOARDS
}
