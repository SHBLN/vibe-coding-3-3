import { useEffect, useMemo, useRef, useState } from 'react'
import { getProfileInitials, getUniqueRoles, type AssigneeProfile } from '../../lib/profiles'

type BoardMembersPickerProps = {
  profiles: AssigneeProfile[]
  profilesError: string | null
  selectedMemberIds: string[]
  onChange: (ids: string[]) => void
}

function PlusIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round" />
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

function CheckIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function BoardMembersPicker({
  profiles,
  profilesError,
  selectedMemberIds,
  onChange,
}: BoardMembersPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedRole, setSelectedRole] = useState<string | null>(null)

  const roles = getUniqueRoles(profiles)
  const normalizedSearch = searchTerm.trim().toLowerCase()
  const filteredProfiles = profiles.filter((profile) => {
    const matchesSearch =
      !normalizedSearch ||
      profile.displayName.toLowerCase().includes(normalizedSearch) ||
      profile.role.toLowerCase().includes(normalizedSearch)
    const matchesRole = !selectedRole || profile.role === selectedRole
    return matchesSearch && matchesRole
  })

  const selectedMembers = useMemo(
    () => profiles.filter((profile) => selectedMemberIds.includes(profile.id)),
    [profiles, selectedMemberIds],
  )
  const visibleMembers = selectedMembers
  const availableMembers = filteredProfiles.filter((profile) => !selectedMemberIds.includes(profile.id))

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

  const toggleMember = (profileId: string) => {
    const nextIds = selectedMemberIds.includes(profileId)
      ? selectedMemberIds.filter((id) => id !== profileId)
      : [...selectedMemberIds, profileId]

    onChange(nextIds)
  }

  const handleOpen = () => {
    setSearchTerm('')
    setSelectedRole(null)
    setIsOpen(true)
  }

  const removeMember = (profileId: string) => {
    onChange(selectedMemberIds.filter((id) => id !== profileId))
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={handleOpen}
        className="inline-flex items-center gap-2 rounded-full border border-navy/15 bg-white px-3 py-2 text-xs font-semibold text-navy/70 transition hover:border-accent/40 hover:text-accent"
      >
        <PlusIcon className="text-navy/45" />
        <span>{selectedMemberIds.length > 0 ? 'Участники' : 'Добавить участников'}</span>
      </button>

      {selectedMembers.length > 0 ? (
        <div className="ml-2 inline-flex items-center -space-x-2 align-middle">
          {selectedMembers.slice(0, 5).map((member) => (
            <span
              key={member.id}
              title={`${member.displayName} (${member.role})`}
              className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-navy text-[10px] font-bold text-white shadow-sm"
            >
              {getProfileInitials(member.displayName)}
            </span>
          ))}
          {selectedMembers.length > 5 ? (
            <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-surface-alt text-[10px] font-bold text-navy/70">
              +{selectedMembers.length - 5}
            </span>
          ) : null}
        </div>
      ) : null}

      {isOpen ? (
        <div className="absolute right-0 top-[calc(100%+8px)] z-30 w-80 overflow-hidden rounded-2xl border border-navy/10 bg-white shadow-hero">
          <div className="space-y-3 border-b border-navy/10 bg-surface/40 p-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-navy/45">Кто видит доску</p>
              <div className="mt-2 space-y-1.5">
                {visibleMembers.length > 0 ? (
                  visibleMembers.map((profile) => (
                    <div
                      key={profile.id}
                      className="flex items-center gap-2 rounded-xl border border-navy/10 bg-white px-2.5 py-2"
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy text-[10px] font-bold text-white">
                        {getProfileInitials(profile.displayName)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-semibold text-navy">
                          {profile.displayName}
                        </span>
                        <span className="block truncate text-[11px] text-navy/45">{profile.role}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => removeMember(profile.id)}
                        className="rounded-full border border-navy/15 px-2 py-1 text-[10px] font-semibold text-navy/60 transition hover:border-red-300 hover:text-red-600"
                      >
                        Убрать
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="rounded-xl border border-dashed border-navy/10 bg-white px-3 py-2 text-xs text-navy/45">
                    Пока никто не добавлен
                  </p>
                )}
              </div>
            </div>

            <div className="h-px bg-navy/10" />

            <p className="text-[11px] font-bold uppercase tracking-wide text-navy/45">
              Добавить пользователя
            </p>

            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-navy/35" />
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Поиск по имени или роли"
                autoFocus
                className="w-full rounded-xl border border-navy/10 bg-surface py-2 pl-9 pr-3 text-sm text-navy outline-none placeholder:text-navy/35 focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
            </div>

            <select
              value={selectedRole ?? ''}
              onChange={(event) => setSelectedRole(event.target.value || null)}
              className="w-full rounded-xl border border-navy/10 bg-white px-3 py-2 text-sm text-navy outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              aria-label="Фильтр роли участников"
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

          <div className="px-3 pt-2 text-[11px] text-navy/45">
            Выбрано: <span className="font-semibold text-navy/60">{selectedMemberIds.length}</span> ·
            Для добавления: <span className="font-semibold text-navy/60"> {availableMembers.length}</span>
          </div>

          <ul className="max-h-64 overflow-y-auto p-2">
            {availableMembers.length > 0 ? (
              availableMembers.map((profile) => {
                return (
                  <li key={profile.id}>
                    <button
                      type="button"
                      onClick={() => toggleMember(profile.id)}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left transition hover:bg-surface-alt"
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
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-navy/20 bg-white text-navy/40">
                        <CheckIcon className="h-3 w-3" />
                      </span>
                    </button>
                  </li>
                )
              })
            ) : (
              <li className="px-3 py-4 text-center text-xs text-navy/45">
                {profiles.length === 0
                  ? 'Пользователи не найдены'
                  : 'Нет пользователей для добавления'}
              </li>
            )}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
