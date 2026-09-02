import type { ReactNode } from 'react'

type IconProps = { className?: string }

export function StarIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7L12 17.8 5.7 21.2 8 14 2 9.4h7.6L12 2z" />
    </svg>
  )
}

export function ArrowUpRightIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M7 17L17 7M17 7H9M17 7v8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function ArrowDownRightIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M7 7l10 10M17 17V9M17 17H9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function PlayIcon({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7L8 5z" />
    </svg>
  )
}

export function CheckIcon({ className = 'h-3 w-3' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function LogoIcon({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7L12 17.8 5.7 21.2 8 14 2 9.4h7.6L12 2z" />
    </svg>
  )
}

export function ButtonPrimary({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      className={`inline-flex items-center gap-2 rounded-full bg-accent px-5 py-3 text-sm font-black text-white shadow-button transition duration-200 hover:-translate-y-0.5 hover:bg-accent-light focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${className}`}
    >
      {children}
    </button>
  )
}

export function OrangeUnderline({ children }: { children: ReactNode }) {
  return <span className="underline-accent text-accent">{children}</span>
}
