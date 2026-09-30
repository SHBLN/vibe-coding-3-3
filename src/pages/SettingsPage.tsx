import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AccountBadge } from '../components/landing/AccountBadge'
import { LogoIcon } from '../components/landing/ui'
import { ProfileSettingsSection } from '../components/settings/ProfileSettingsSection'
import { SecuritySettingsSection } from '../components/settings/SecuritySettingsSection'
import { TelegramSettingsSection } from '../components/settings/TelegramSettingsSection'
import { useAuth } from '../hooks/useAuth'
import { useSettingsState } from '../hooks/useSettingsState'

function BackIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M19 12H5M5 12l6-6M5 12l6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function SettingsPage() {
  const navigate = useNavigate()
  const { account, loading, signOut, refresh } = useAuth()
  const settings = useSettingsState({
    account,
    refreshAccount: refresh,
  })

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  const handleProfileSubmit = async (event: FormEvent) => {
    event.preventDefault()
    await settings.submitProfile()
  }

  const handleTelegramSubmit = async (event: FormEvent) => {
    event.preventDefault()
    await settings.submitTelegram()
  }

  const handlePasswordSubmit = async (event: FormEvent) => {
    event.preventDefault()
    await settings.submitPassword()
  }

  if (loading || !account || settings.settingsLoading) {
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
        <div className="mx-auto max-w-2xl space-y-6">
          <Link
            to="/boards"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-navy/50 transition hover:text-accent"
          >
            <BackIcon />
            К доскам
          </Link>

          <div>
            <h1 className="text-3xl font-black tracking-[-0.04em] text-navy">Настройки</h1>
            <p className="mt-2 text-sm text-navy/60">
              Профиль, Telegram и безопасность аккаунта.
            </p>
          </div>

          <ProfileSettingsSection
            accountEmail={account.email}
            accountDisplayName={account.displayName}
            displayName={settings.displayName}
            role={settings.role}
            roleOptions={settings.roleOptions}
            profileDirty={settings.profileDirty}
            profileSubmitting={settings.profileSubmitting}
            profileError={settings.profileError}
            profileSuccess={settings.profileSuccess}
            avatarPreset={settings.avatarPreset}
            avatarUrl={settings.avatarUrl}
            onDisplayNameChange={settings.updateDisplayNameDraft}
            onRoleChange={settings.updateRoleDraft}
            onSubmit={(event) => void handleProfileSubmit(event)}
            onAvatarUpdated={settings.handleAvatarUpdated}
            onAvatarError={settings.setProfileError}
            onAvatarSuccess={settings.setProfileSuccess}
          />

          <TelegramSettingsSection
            username={settings.username}
            savedUsername={settings.savedUsername}
            telegramDirty={settings.telegramDirty}
            telegramSubmitting={settings.telegramSubmitting}
            telegramError={settings.telegramError}
            telegramSuccess={settings.telegramSuccess}
            onUsernameChange={settings.updateUsernameDraft}
            onSubmit={(event) => void handleTelegramSubmit(event)}
          />

          <SecuritySettingsSection
            canChangePassword={settings.canChangePassword}
            newPassword={settings.newPassword}
            confirmPassword={settings.confirmPassword}
            passwordSubmitting={settings.passwordSubmitting}
            passwordError={settings.passwordError}
            passwordSuccess={settings.passwordSuccess}
            onNewPasswordChange={settings.updateNewPasswordDraft}
            onConfirmPasswordChange={settings.updateConfirmPasswordDraft}
            onSubmit={(event) => void handlePasswordSubmit(event)}
          />
        </div>
      </main>
    </div>
  )
}
