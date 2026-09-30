import type { FormEvent } from 'react'
import { RoleSelectField } from '../RoleSelectField'
import { ButtonPrimary } from '../landing/ui'
import { AvatarPicker } from './AvatarPicker'
import { SettingsAlert } from './SettingsAlert'

type ProfileSettingsSectionProps = {
  accountEmail: string
  accountDisplayName: string
  displayName: string
  role: string
  roleOptions: string[]
  profileDirty: boolean
  profileSubmitting: boolean
  profileError: string | null
  profileSuccess: string | null
  avatarPreset: string | null
  avatarUrl: string | null
  onDisplayNameChange: (value: string) => void
  onRoleChange: (value: string) => void
  onSubmit: (event: FormEvent) => void | Promise<void>
  onAvatarUpdated: (next: { avatarPreset: string | null; avatarUrl: string | null }) => void
  onAvatarError: (message: string | null) => void
  onAvatarSuccess: (message: string | null) => void
}

export function ProfileSettingsSection({
  accountEmail,
  accountDisplayName,
  displayName,
  role,
  roleOptions,
  profileDirty,
  profileSubmitting,
  profileError,
  profileSuccess,
  avatarPreset,
  avatarUrl,
  onDisplayNameChange,
  onRoleChange,
  onSubmit,
  onAvatarUpdated,
  onAvatarError,
  onAvatarSuccess,
}: ProfileSettingsSectionProps) {
  const fieldClassName =
    'w-full rounded-xl border border-navy/15 bg-surface px-4 py-3 text-sm text-navy outline-none transition placeholder:text-navy/40 focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-60'

  return (
    <section id="profile-settings" className="panel-shell scroll-mt-24 p-6">
      <h2 className="text-base font-bold text-navy">Профиль</h2>
      <p className="mt-1 text-xs text-navy/55">Имя и должность видны команде при назначении задач.</p>

      <form className="mt-5 space-y-4" onSubmit={onSubmit}>
        <SettingsAlert error={profileError} success={profileSuccess} />

        <div id="avatar-settings" className="scroll-mt-24">
          <AvatarPicker
            displayName={displayName || accountDisplayName}
            avatarPreset={avatarPreset}
            avatarUrl={avatarUrl}
            disabled={profileSubmitting}
            onUpdated={onAvatarUpdated}
            onError={onAvatarError}
            onSuccess={onAvatarSuccess}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="settings-email" className="block text-sm font-semibold text-navy">
            Email
          </label>
          <input
            id="settings-email"
            type="email"
            value={accountEmail}
            readOnly
            className={`${fieldClassName} bg-white/80 text-navy/60`}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="settings-display-name" className="block text-sm font-semibold text-navy">
            Имя
          </label>
          <input
            id="settings-display-name"
            type="text"
            value={displayName}
            onChange={(event) => onDisplayNameChange(event.target.value)}
            autoComplete="name"
            disabled={profileSubmitting}
            className={fieldClassName}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="settings-role" className="block text-sm font-semibold text-navy">
            Должность в команде
          </label>
          <RoleSelectField
            id="settings-role"
            value={role}
            options={roleOptions}
            disabled={profileSubmitting}
            onChange={onRoleChange}
          />
        </div>

        <ButtonPrimary
          type="submit"
          disabled={profileSubmitting || !profileDirty}
          className="w-full justify-center py-3 sm:w-auto sm:min-w-[160px]"
        >
          {profileSubmitting ? 'Сохраняем…' : 'Сохранить профиль'}
        </ButtonPrimary>
      </form>
    </section>
  )
}
