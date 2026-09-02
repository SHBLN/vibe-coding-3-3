import { ArrowUpRightIcon, ButtonPrimary, LogoIcon } from './ui'

const navLinks = ['Продукт', 'Как это работает', 'Тарифы']

export function Header() {
  return (
    <header className="relative z-40 bg-surface">
      <div className="section-shell flex h-20 items-center justify-between">
      <a href="#" aria-label="AiVibeBoard — на главную" className="flex items-center gap-2.5">
        <div className="flex h-10 w-10 rotate-3 items-center justify-center rounded-2xl bg-navy text-accent shadow-card">
          <LogoIcon />
        </div>
        <span className="text-xl font-black tracking-[-0.04em] text-navy">AI VIBE<span className="text-accent">.</span></span>
      </a>

      <nav aria-label="Основная навигация" className="hidden items-center gap-2 rounded-full border border-navy/10 bg-white/70 p-1.5 shadow-sm md:flex">
        {navLinks.map((link) => (
          <a
            key={link}
            href={`#${link.toLowerCase().replace(/\s+/g, '-')}`}
            className="rounded-full px-4 py-2 text-sm font-semibold text-navy/65 transition hover:bg-navy hover:text-white"
          >
            {link}
          </a>
        ))}
      </nav>

      <div className="flex items-center gap-3">
        <a href="#" className="hidden text-sm font-bold text-navy/70 sm:inline hover:text-accent">
          Войти
        </a>
        <ButtonPrimary>
          Начать бесплатно
          <ArrowUpRightIcon />
        </ButtonPrimary>
      </div>
      </div>
    </header>
  )
}
