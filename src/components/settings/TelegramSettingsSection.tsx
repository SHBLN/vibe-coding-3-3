import type { FormEvent } from 'react'
import { ButtonPrimary, TelegramIcon } from '../landing/ui'
import { SettingsAlert } from './SettingsAlert'

type TelegramSettingsSectionProps = {
  username: string
  savedUsername: string
  telegramDirty: boolean
  telegramSubmitting: boolean
  telegramError: string | null
  telegramSuccess: string | null
  onUsernameChange: (value: string) => void
  onSubmit: (event: FormEvent) => void | Promise<void>
}

export function TelegramSettingsSection({
  username,
  savedUsername,
  telegramDirty,
  telegramSubmitting,
  telegramError,
  telegramSuccess,
  onUsernameChange,
  onSubmit,
}: TelegramSettingsSectionProps) {
  return (
    <section id="telegram-settings" className="panel-shell scroll-mt-24 p-6">
      <div className="mb-5 flex items-start gap-3 rounded-2xl border border-[#229ED9]/25 bg-[#229ED9]/8 px-4 py-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#229ED9] text-white shadow-sm">
          <TelegramIcon className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-navy">Telegram</h2>
          <p className="mt-1 text-xs leading-relaxed text-navy/60">
            Username для бота: постановка задач и уведомления.
          </p>
        </div>
      </div>

      <form className="space-y-4" onSubmit={onSubmit}>
        <SettingsAlert error={telegramError} success={telegramSuccess} />

        <div className="space-y-2">
          <label htmlFor="telegram-username" className="flex items-center gap-2 text-sm font-semibold text-navy">
            <TelegramIcon className="h-4 w-4 text-[#229ED9]" aria-hidden="true" />
            Telegram username
          </label>
          <div className="flex overflow-hidden rounded-2xl border border-navy/15 bg-surface transition focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20">
            <span className="flex items-center border-r border-navy/10 bg-white px-4 text-sm font-semibold text-navy/45">
              @
            </span>
            <input
              id="telegram-username"
              name="telegramUsername"
              type="text"
              value={username}
              onChange={(event) => onUsernameChange(event.target.value)}
              placeholder="username"
              autoComplete="off"
              spellCheck={false}
              disabled={telegramSubmitting}
              className="min-w-0 flex-1 bg-surface px-4 py-3 text-sm text-navy outline-none placeholder:text-navy/40 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>
          <p className="text-xs text-navy/45">5–32 символа: латиница, цифры и подчёркивание.</p>
        </div>

        {savedUsername ? (
          <p className="text-xs text-navy/50">
            Сейчас в профиле: <span className="font-semibold text-navy">@{savedUsername}</span>
          </p>
        ) : null}

        <ButtonPrimary
          type="submit"
          disabled={telegramSubmitting || !telegramDirty}
          className="w-full justify-center py-3 sm:w-auto sm:min-w-[160px]"
        >
          {telegramSubmitting ? (
            'Сохраняем…'
          ) : (
            <>
              <TelegramIcon className="h-4 w-4" aria-hidden="true" />
              Сохранить Telegram
            </>
          )}
        </ButtonPrimary>
      </form>
    </section>
  )
}
