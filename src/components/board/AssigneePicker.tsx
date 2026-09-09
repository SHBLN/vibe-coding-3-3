import { useEffect, useId, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  filterProfiles,
  getProfileInitials,
  getUniqueRoles,
  type AssigneeProfile,
} from '../../lib/profiles'

type AssigneePickerProps = {
  profiles: AssigneeProfile[]
  profilesError: string | null
  selectedAssigneeIds: string[]
  fallbackAssigneeNames?: string[]
  disabled?: boolean
  saving?: boolean
  error?: string | null
  onChange: (assigneeIds: string[]) => void | Promise<void>
}

function ChevronDownIcon({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function SearchIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3-3" strokeLinecap="round" />
    </svg>
  )
}

function CloseIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CheckIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m5 12 5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function AssigneePicker({
  profiles,
  profilesError,
  selectedAssigneeIds,
  fallbackAssigneeNames,
  disabled = false,
  saving = false,
  error = null,
  onChange,
}: AssigneePickerProps) {
  const listId = useId()
  const [isPopupOpen, setIsPopupOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedRole, setSelectedRole] = useState<string | null>(null)
  const [draftAssigneeIds, setDraftAssigneeIds] = useState<string[]>(selectedAssigneeIds)
  const [applyError, setApplyError] = useState<string | null>(null)
  const [applying, setApplying] = useState(false)
  const isBusy = disabled || saving || applying

  const selectedProfiles = selectedAssigneeIds
    .map((id) => profiles.find((profile) => profile.id === id) ?? null)
    .filter((profile): profile is AssigneeProfile => profile !== null)
  const displayNames =
    selectedProfiles.length > 0
      ? selectedProfiles.map((profile) => profile.displayName)
      : (fallbackAssigneeNames ?? [])

  const roles = getUniqueRoles(profiles)
  const filteredProfiles = filterProfiles(profiles, searchTerm, selectedRole)

  useEffect(() => {
    if (!isPopupOpen) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsPopupOpen(false)
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isPopupOpen])

  const handleOpen = () => {
    if (isBusy) return
    setSearchTerm('')
    setSelectedRole(null)
    setDraftAssigneeIds(selectedAssigneeIds)
    setApplyError(null)
    setIsPopupOpen(true)
  }

  const handleToggle = (assigneeId: string) => {
    setDraftAssigneeIds((prev) =>
      prev.includes(assigneeId) ? prev.filter((id) => id !== assigneeId) : [...prev, assigneeId],
    )
  }

  const handleApply = async () => {
    setApplyError(null)
    setApplying(true)

    try {
      await onChange(draftAssigneeIds)
      setIsPopupOpen(false)
    } catch (err) {
      setApplyError(err instanceof Error ? err.message : 'Не удалось сохранить исполнителей.')
    } finally {
      setApplying(false)
    }
  }

  const popupContent = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setIsPopupOpen(false)
      }}
    >
      <div className="modal-overlay absolute inset-0 bg-navy/60 backdrop-blur-sm" aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Выбор исполнителей"
        className="modal-panel motion-scale-in relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-navy/10 bg-white shadow-hero"
      >
        <div className="flex items-center justify-between border-b border-navy/10 bg-surface/50 px-4 py-3">
          <div>
            <p className="text-sm font-black tracking-tight text-navy">Выбор исполнителей</p>
            <p className="text-xs text-navy/45">Можно выбрать одного или нескольких</p>
          </div>
          <button
            type="button"
            onClick={() => setIsPopupOpen(false)}
            disabled={isBusy}
            className="press-down rounded-lg p-1.5 text-navy/50 hover:bg-white hover:text-navy disabled:opacity-50"
            aria-label="Закрыть"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="space-y-3 border-b border-navy/10 bg-surface/40 p-3">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-navy/35" />
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Поиск по имени…"
              autoFocus
              className="w-full rounded-xl border border-navy/10 bg-surface py-2 pl-9 pr-3 text-sm text-navy outline-none placeholder:text-navy/35 focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </div>

          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-navy/45">Роль</p>
            <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
              <button
                type="button"
                onClick={() => setSelectedRole(null)}
                className={`whitespace-nowrap rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
                  selectedRole === null
                    ? 'border-accent/30 bg-accent/10 text-accent-dark'
                    : 'border-navy/10 bg-white text-navy/60 hover:border-navy/20'
                }`}
              >
                Все роли
              </button>
              {roles.map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => setSelectedRole(role)}
                  className={`whitespace-nowrap rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
                    selectedRole === role
                      ? 'border-accent/30 bg-accent/10 text-accent-dark'
                      : 'border-navy/10 bg-white text-navy/60 hover:border-navy/20'
                  }`}
                >
                  {role}
                </button>
              ))}
            </div>
          </div>
        </div>

        {profilesError || error || applyError ? (
          <p className="border-b border-navy/10 px-3 py-2 text-xs text-red-600" role="alert">
            {applyError ?? error ?? profilesError}
          </p>
        ) : null}

        <div className="px-3 pt-2 text-[11px] text-navy/45">
          Найдено: <span className="font-semibold text-navy/60">{filteredProfiles.length}</span> ·
          Выбрано: <span className="font-semibold text-navy/60">{draftAssigneeIds.length}</span>
        </div>

        <ul id={listId} role="listbox" className="max-h-72 overflow-y-auto p-2">
          {filteredProfiles.length > 0 ? (
            filteredProfiles.map((profile) => {
              const isSelected = draftAssigneeIds.includes(profile.id)

              return (
                <li key={profile.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleToggle(profile.id)}
                    disabled={isBusy}
                    className={`press-down flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left hover:bg-surface-alt disabled:opacity-60 ${
                      isSelected ? 'bg-accent/10' : ''
                    }`}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy text-[10px] font-bold text-white">
                      {getProfileInitials(profile.displayName)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-navy">
                        {profile.displayName}
                      </span>
                      <span className="block truncate text-xs text-navy/45">{profile.role}</span>
                    </span>
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded border ${
                        isSelected
                          ? 'border-accent bg-accent/15 text-accent-dark'
                          : 'border-navy/20 text-transparent'
                      }`}
                      aria-hidden="true"
                    >
                      <CheckIcon className="h-3.5 w-3.5" />
                    </span>
                  </button>
                </li>
              )
            })
          ) : (
            <li className="px-3 py-4 text-center text-xs text-navy/45">
              {profiles.length === 0 ? 'Пользователи не найдены' : 'Никого не найдено по фильтрам'}
            </li>
          )}
        </ul>

        <div className="flex gap-2 border-t border-navy/10 bg-surface/40 p-3">
          <button
            type="button"
            onClick={() => setDraftAssigneeIds([])}
            disabled={isBusy}
            className="press-down rounded-xl border border-navy/10 bg-white px-3 py-2 text-xs font-semibold text-navy/60 hover:border-navy/20 disabled:opacity-60"
          >
            Снять всех
          </button>
          <button
            type="button"
            onClick={() => void handleApply()}
            disabled={isBusy}
            className="press-down ml-auto rounded-xl bg-navy px-3 py-2 text-xs font-bold text-white hover:bg-navy-light disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isBusy ? 'Сохраняем…' : 'Применить'}
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <>
      <div className="min-w-0 w-full">
      <button
        type="button"
        onClick={handleOpen}
        disabled={isBusy}
        aria-expanded={isPopupOpen}
        aria-haspopup="listbox"
        aria-controls={listId}
        className="press-down flex h-9 w-full min-w-0 items-center gap-2 overflow-hidden rounded-xl border border-navy/10 bg-surface px-2 py-1 text-left hover:border-accent/40 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {displayNames.length > 0 ? (
          <>
            <span className="flex -space-x-2">
              {displayNames.slice(0, 2).map((name, index) => (
                <span
                  key={`${name}-${index}`}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white bg-navy text-[10px] font-bold text-white"
                >
                  {getProfileInitials(name)}
                </span>
              ))}
            </span>
            <span className="truncate text-xs font-medium text-navy/70">
              {displayNames[0]}
              {displayNames.length > 1 ? ` +${displayNames.length - 1}` : ''}
            </span>
          </>
        ) : (
          <span className="px-1 text-xs italic text-navy/40">Назначить исполнителей</span>
        )}
        <ChevronDownIcon className="shrink-0 text-navy/40" />
      </button>
      </div>
      {isPopupOpen && typeof document !== 'undefined' ? createPortal(popupContent, document.body) : null}
    </>
  )
}
