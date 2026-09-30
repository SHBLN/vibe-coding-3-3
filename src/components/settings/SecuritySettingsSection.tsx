import type { FormEvent } from 'react'
import { ButtonPrimary } from '../landing/ui'
import { SettingsAlert } from './SettingsAlert'

type SecuritySettingsSectionProps = {
  canChangePassword: boolean
  newPassword: string
  confirmPassword: string
  passwordSubmitting: boolean
  passwordError: string | null
  passwordSuccess: string | null
  onNewPasswordChange: (value: string) => void
  onConfirmPasswordChange: (value: string) => void
  onSubmit: (event: FormEvent) => void | Promise<void>
}

export function SecuritySettingsSection({
  canChangePassword,
  newPassword,
  confirmPassword,
  passwordSubmitting,
  passwordError,
  passwordSuccess,
  onNewPasswordChange,
  onConfirmPasswordChange,
  onSubmit,
}: SecuritySettingsSectionProps) {
  const fieldClassName =
    'w-full rounded-xl border border-navy/15 bg-surface px-4 py-3 text-sm text-navy outline-none transition placeholder:text-navy/40 focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-60'

  return (
    <section id="security-settings" className="panel-shell scroll-mt-24 p-6">
      <h2 className="text-base font-bold text-navy">Безопасность</h2>
      <p className="mt-1 text-xs text-navy/55">Смена пароля для входа по email.</p>

      {canChangePassword ? (
        <form className="mt-5 space-y-4" onSubmit={onSubmit}>
          <SettingsAlert error={passwordError} success={passwordSuccess} />

          <div className="space-y-2">
            <label htmlFor="settings-new-password" className="block text-sm font-semibold text-navy">
              Новый пароль
            </label>
            <input
              id="settings-new-password"
              type="password"
              value={newPassword}
              onChange={(event) => onNewPasswordChange(event.target.value)}
              autoComplete="new-password"
              disabled={passwordSubmitting}
              className={fieldClassName}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="settings-confirm-password" className="block text-sm font-semibold text-navy">
              Повторите пароль
            </label>
            <input
              id="settings-confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(event) => onConfirmPasswordChange(event.target.value)}
              autoComplete="new-password"
              disabled={passwordSubmitting}
              className={fieldClassName}
            />
          </div>

          <p className="text-xs text-navy/45">Минимум 6 символов.</p>

          <ButtonPrimary
            type="submit"
            disabled={passwordSubmitting || !newPassword || newPassword !== confirmPassword}
            className="w-full justify-center py-3 sm:w-auto sm:min-w-[160px]"
          >
            {passwordSubmitting ? 'Сохраняем…' : 'Сменить пароль'}
          </ButtonPrimary>
        </form>
      ) : (
        <p className="mt-4 rounded-xl border border-navy/10 bg-surface-alt/50 px-4 py-3 text-sm text-navy/60">
          Вы вошли через Google — пароль в приложении не используется. Для смены пароля используйте настройки
          Google-аккаунта.
        </p>
      )}
    </section>
  )
}
