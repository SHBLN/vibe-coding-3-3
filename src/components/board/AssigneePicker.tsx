import { useEffect, useId, useRef, useState } from 'react'
import {
  filterProfiles,
  getProfileInitials,
  getUniqueRoles,
  type AssigneeProfile,
} from '../../lib/profiles'

type AssigneePickerProps = {
  profiles: AssigneeProfile[]
  profilesError: string | null
  selectedAssigneeId: string | null
  fallbackName?: string | null
  fallbackInitials?: string | null
  onSelect: (assigneeId: string | null) => void
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

export function AssigneePicker({
  profiles,
  profilesError,
  selectedAssigneeId,
  fallbackName,
  fallbackInitials,
  onSelect,
}: AssigneePickerProps) {
  const listId = useId()
  const containerRef = useRef<HTMLDivElement>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedRole, setSelectedRole] = useState<string | null>(null)

  const selectedProfile = profiles.find((profile) => profile.id === selectedAssigneeId) ?? null
  const displayName = selectedProfile?.displayName ?? fallbackName ?? null
  const displayInitials = selectedProfile
    ? getProfileInitials(selectedProfile.displayName)
    : fallbackInitials ?? null

  const roles = getUniqueRoles(profiles)
  const filteredProfiles = filterProfiles(profiles, searchTerm, selectedRole)

  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false)
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const handleOpen = () => {
    setSearchTerm('')
    setSelectedRole(null)
    setIsOpen(true)
  }

  const handleSelect = (assigneeId: string | null) => {
    onSelect(assigneeId)
    setIsOpen(false)
  }

  return (
    <div ref={containerRef} className="relative min-w-0">
      <button
        type="button"
        onClick={handleOpen}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls={listId}
        className="flex min-w-0 max-w-full items-center gap-2 rounded-full border border-navy/10 bg-surface-alt/80 px-2 py-1 text-left transition hover:border-accent/40 hover:bg-white"
      >
        {displayName ? (
          <>
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy text-[10px] font-bold text-white">
              {displayInitials}
            </span>
            <span className="truncate text-xs font-medium text-navy/70">{displayName}</span>
          </>
        ) : (
          <span className="px-1 text-xs italic text-navy/40">Назначить исполнителя</span>
        )}
        <ChevronDownIcon className="shrink-0 text-navy/40" />
      </button>

      {isOpen ? (
        <div
          className="absolute left-0 top-[calc(100%+6px)] z-30 w-72 overflow-hidden rounded-2xl border border-navy/10 bg-white shadow-hero"
          role="dialog"
          aria-label="Выбор исполнителя"
        >
          <div className="space-y-3 border-b border-navy/10 p-3">
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

            <select
              value={selectedRole ?? ''}
              onChange={(event) => setSelectedRole(event.target.value || null)}
              className="w-full rounded-xl border border-navy/10 bg-surface px-3 py-2 text-sm text-navy outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              aria-label="Фильтр по роли"
            >
              <option value="">Все роли</option>
              {roles.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </div>

          {profilesError ? (
            <p className="border-b border-navy/10 px-3 py-2 text-xs text-red-600" role="alert">
              {profilesError}
            </p>
          ) : null}

          <ul id={listId} role="listbox" className="max-h-56 overflow-y-auto p-2">
            <li>
              <button
                type="button"
                role="option"
                aria-selected={selectedAssigneeId === null}
                onClick={() => handleSelect(null)}
                className="flex w-full items-center rounded-xl px-3 py-2 text-left text-sm text-navy/60 transition hover:bg-surface-alt"
              >
                Снять исполнителя
              </button>
            </li>

            {filteredProfiles.length > 0 ? (
              filteredProfiles.map((profile) => {
                const isSelected = profile.id === selectedAssigneeId

                return (
                  <li key={profile.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => handleSelect(profile.id)}
                      className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left transition hover:bg-surface-alt ${
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
        </div>
      ) : null}
    </div>
  )
}
