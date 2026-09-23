import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRightIcon, ButtonPrimary, LogoIcon } from './ui'
import { AccountBadge } from './AccountBadge'
import type { AuthAccount } from '../../lib/auth'

const navLinks = ['Продукт', 'Как это работает', 'Тарифы']

type HeaderProps = {
  account: AuthAccount | null
  authLoading?: boolean
  onLoginClick: () => void
  onRegisterClick: () => void
  onSignOut: () => Promise<void>
}

export function Header({
  account,
  authLoading = false,
  onLoginClick,
  onRegisterClick,
  onSignOut,
}: HeaderProps) {
  const [signingOut, setSigningOut] = useState(false)

  const handleSignOut = async () => {
    setSigningOut(true)
    try {
      await onSignOut()
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b border-navy/10 bg-surface/95 backdrop-blur">
      <div className="section-shell flex h-20 items-center justify-between">
        <Link to="/" aria-label="AiVibeBoard — на главную" className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy text-accent shadow-card">
            <LogoIcon />
          </div>
          <span className="text-xl font-black tracking-[-0.04em] text-navy">
            AI VIBE<span className="text-accent">.</span>
          </span>
        </Link>

        <nav
          aria-label="Основная навигация"
          className="hidden items-center gap-2 rounded-2xl border border-navy/10 bg-white p-1.5 shadow-sm md:flex"
        >
          {navLinks.map((link) => (
            <a
              key={link}
              href={`#${link.toLowerCase().replace(/\s+/g, '-')}`}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-navy/65 transition hover:bg-navy hover:text-white"
            >
              {link}
            </a>
          ))}
          {account ? (
            <Link
              to="/boards"
              className="rounded-xl px-4 py-2 text-sm font-semibold text-navy/65 transition hover:bg-navy hover:text-white"
            >
              Доски
            </Link>
          ) : null}
        </nav>

        <div className="flex items-center gap-3">
          {authLoading ? (
            <span className="text-sm text-navy/50">Загрузка…</span>
          ) : account ? (
            <>
              <Link
                to="/boards"
                className="rounded-xl border border-navy/10 bg-white px-3 py-2 text-sm font-bold text-navy/70 transition hover:border-accent hover:text-accent md:hidden"
              >
                Доски
              </Link>
              <AccountBadge account={account} onSignOut={handleSignOut} signingOut={signingOut} />
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onLoginClick}
                className="hidden text-sm font-bold text-navy/70 sm:inline hover:text-accent"
              >
                Войти
              </button>
              <ButtonPrimary onClick={onRegisterClick}>
                Начать бесплатно
                <ArrowUpRightIcon />
              </ButtonPrimary>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
