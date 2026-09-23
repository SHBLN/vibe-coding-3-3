import {
  getProfileInitialsFromName,
  resolveAvatarPresetClass,
  type AvatarDisplaySource,
} from '../lib/profileAvatar'

type UserAvatarProps = AvatarDisplaySource & {
  className?: string
  textClassName?: string
}

export function UserAvatar({
  displayName,
  avatarPreset,
  avatarUrl,
  className = 'h-9 w-9 rounded-xl',
  textClassName = 'text-xs font-black text-white',
}: UserAvatarProps) {
  const initials = getProfileInitialsFromName(displayName)
  const presetClass = resolveAvatarPresetClass(avatarPreset)

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt=""
        className={`${className} shrink-0 object-cover`}
      />
    )
  }

  return (
    <div
      className={`flex shrink-0 items-center justify-center ${className} ${presetClass}`}
      aria-hidden="true"
    >
      <span className={textClassName}>{initials}</span>
    </div>
  )
}
