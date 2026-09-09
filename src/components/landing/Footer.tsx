import { LogoIcon, StarIcon } from './ui'

export function Footer() {
  return (
    <footer className="bg-surface px-4 pb-4">
      <div className="mx-auto flex max-w-[1440px] flex-col items-center justify-between gap-8 rounded-3xl border border-navy/10 bg-navy px-6 py-10 shadow-hero sm:flex-row sm:px-10">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-navy">
            <LogoIcon className="h-4 w-4" />
          </div>
          <span className="text-xl font-black text-white">AI VIBE<span className="text-accent">.</span></span>
        </div>

        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-white/40">
          <StarIcon className="h-3 w-3 text-accent" />
          Работайте в своём ритме
          <StarIcon className="h-3 w-3 text-accent" />
        </p>

        <p className="text-xs text-white/35">© 2026 AiVibeBoard. Все права защищены.</p>
      </div>
    </footer>
  )
}
