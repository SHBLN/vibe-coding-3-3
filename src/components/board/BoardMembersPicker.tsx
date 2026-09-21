import { Link } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import type { BoardCreationBillingAction } from '../../lib/boards'
import { getProfileInitials, getUniqueRoles, type AssigneeProfile } from '../../lib/profiles'

type BoardMembersPickerProps = {
  profiles: AssigneeProfile[]
  profilesError: string | null
  selectedMemberIds: string[]
  accountTeamMemberIds: string[]
  teamMemberLimit: number | null
  membersError: string | null
  membersBillingAction: BoardCreationBillingAction | null
  onChange: (ids: string[]) => void
}

function PlusIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round" />
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

function canAddTeamMember(
  profileId: string,
  selectedMemberIds: string[],
  accountTeamMemberIds: string[],
  teamMemberLimit: number | null,
): boolean {
  if (selectedMemberIds.includes(profileId)) return true
  if (teamMemberLimit === null) return true
  if (accountTeamMemberIds.includes(profileId)) return true
  return accountTeamMemberIds.length < teamMemberLimit
}

export function BoardMembersPicker({
  profiles,
  profilesError,
  selectedMemberIds,
  accountTeamMemberIds,
  teamMemberLimit,
  membersError,
  membersBillingAction,
  onChange,
}: BoardMembersPickerProps) {
  const [isPopupOpen, setIsPopupOpen] = useState(false)
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

  const toggleMember = (profileId: string) => {
    const isSelected = selectedMemberIds.includes(profileId)
    if (
      !isSelected &&
      !canAddTeamMember(profileId, selectedMemberIds, accountTeamMemberIds, teamMemberLimit)
    ) {
      return
    }

    const nextIds = isSelected
      ? selectedMemberIds.filter((id) => id !== profileId)
      : [...selectedMemberIds, profileId]

    onChange(nextIds)
  }

  const handleOpen = () => {
    setSearchTerm('')
    setSelectedRole(null)
    setIsPopupOpen(true)
  }

  const removeMember = (profileId: string) => {
    onChange(selectedMemberIds.filter((id) => id !== profileId))
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
      <div className="modal-panel motion-scale-in relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-navy/10 bg-white shadow-hero">
        <div className="flex items-center justify-between border-b border-navy/10 bg-surface/50 px-4 py-3">
          <p className="text-sm font-black tracking-tight text-navy">Кто видит доску</p>
          <button
            type="button"
            onClick={() => setIsPopupOpen(false)}
            className="press-down rounded-lg p-1.5 text-navy/50 hover:bg-white hover:text-navy"
            aria-label="Закрыть"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="space-y-3 border-b border-navy/10 bg-surface/40 p-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-navy/45">Текущий доступ</p>
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
                      className="press-down rounded-lg border border-navy/15 px-2 py-1 text-[10px] font-semibold text-navy/60 hover:border-red-300 hover:text-red-600"
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

        {membersError ? (
          <div className="border-b border-navy/10 px-3 py-2 text-xs text-red-600" role="alert">
            <p>{membersError}</p>
            {membersBillingAction ? (
              <Link
                to="/billing"
                className="mt-1 inline-block font-semibold text-accent underline-offset-2 hover:underline"
              >
                {membersBillingAction === 'upgrade' ? 'Перейти к тарифам' : 'Оформить подписку'}
              </Link>
            ) : null}
          </div>
        ) : null}

        <div className="px-3 pt-2 text-[11px] text-navy/45">
          На доске: <span className="font-semibold text-navy/60">{selectedMemberIds.length}</span> ·
          В команде (все доски):{' '}
          <span className="font-semibold text-navy/60">
            {accountTeamMemberIds.length}
            {teamMemberLimit !== null ? ` / ${teamMemberLimit}` : ''}
          </span>
        </div>

        <ul className="max-h-64 overflow-y-auto p-2">
          {availableMembers.length > 0 ? (
            availableMembers.map((profile) => {
              const addBlocked = !canAddTeamMember(
                profile.id,
                selectedMemberIds,
                accountTeamMemberIds,
                teamMemberLimit,
              )

              return (
                <li key={profile.id}>
                  <button
                    type="button"
                    onClick={() => toggleMember(profile.id)}
                    disabled={addBlocked}
                    className="press-down flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left hover:bg-surface-alt disabled:cursor-not-allowed disabled:opacity-45"
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
              {profiles.length === 0 ? 'Пользователи не найдены' : 'Нет пользователей для добавления'}
            </li>
          )}
        </ul>
      </div>
    </div>
  )

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleOpen}
        aria-label="Открыть управление доступом к доске"
        className="press-down inline-flex items-center gap-2 rounded-xl border border-navy/15 bg-white px-2 py-1.5"
      >
        {selectedMembers.length > 0 ? (
          <span className="inline-flex items-center -space-x-2">
            {selectedMembers.slice(0, 4).map((member) => (
              <span
                key={member.id}
                title={`${member.displayName} (${member.role})`}
                className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-navy text-[10px] font-bold text-white shadow-sm"
              >
                {getProfileInitials(member.displayName)}
              </span>
            ))}
            {selectedMembers.length > 4 ? (
              <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-surface-alt text-[10px] font-bold text-navy/70">
                +{selectedMembers.length - 4}
              </span>
            ) : null}
          </span>
        ) : (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/15 text-accent">
            <PlusIcon className="h-4 w-4" />
          </span>
        )}
        <span className="ml-1 text-[11px] font-semibold text-navy/60">Доступ · {selectedMemberIds.length}</span>
      </button>
      {isPopupOpen && typeof document !== 'undefined' ? createPortal(popupContent, document.body) : null}
    </div>
  )
}
