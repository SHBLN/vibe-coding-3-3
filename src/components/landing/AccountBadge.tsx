import type { AuthAccount } from '../../lib/auth'

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

type AccountBadgeProps = {
  account: AuthAccount
  onSignOut: () => void
  signingOut?: boolean
}

export function AccountBadge({ account, onSignOut, signingOut = false }: AccountBadgeProps) {
  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <div className="hidden items-center gap-3 rounded-2xl border border-navy/10 bg-white px-3 py-2 sm:flex">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-accent-dark text-xs font-black text-white">
          {getInitials(account.displayName)}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-navy">{account.displayName}</p>
          <p className="truncate text-xs text-navy/55">{account.role}</p>
        </div>
      </div>

      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-accent-dark text-xs font-black text-white sm:hidden">
        {getInitials(account.displayName)}
      </div>

      <button
        type="button"
        onClick={onSignOut}
        disabled={signingOut}
        className="rounded-xl border border-navy/10 bg-white px-3 py-2 text-xs font-bold text-navy/70 transition hover:border-accent hover:text-accent disabled:opacity-60"
      >
        {signingOut ? 'Выход…' : 'Выйти'}
      </button>
    </div>
  )
}

type AuthWelcomeBannerProps = {
  account: AuthAccount
  onDismiss: () => void
}

export function AuthWelcomeBanner({ account, onDismiss }: AuthWelcomeBannerProps) {
  return (
    <div className="section-shell bg-surface py-3">
      <div className="flex items-start justify-between gap-4 rounded-2xl border border-emerald-400/40 bg-emerald-100 px-4 py-3 sm:items-center">
        <div>
          <p className="text-sm font-bold text-emerald-900">Вы успешно вошли</p>
          <p className="text-sm text-emerald-800">
            {account.displayName} · {account.role} · {account.email}
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 text-xs font-semibold text-emerald-800 hover:text-emerald-950"
        >
          Скрыть
        </button>
      </div>
    </div>
  )
}
