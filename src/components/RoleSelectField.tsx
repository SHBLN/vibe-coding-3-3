import { useEffect, useId, useRef, useState } from 'react'

type RoleSelectFieldProps = {
  id?: string
  value: string
  options: string[]
  placeholder?: string
  disabled?: boolean
  onChange: (value: string) => void
}

function ChevronDownIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`h-4 w-4 shrink-0 ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CheckIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`h-4 w-4 shrink-0 ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="m5 12 5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function RoleSelectField({
  id,
  value,
  options,
  placeholder = 'Выберите должность',
  disabled = false,
  onChange,
}: RoleSelectFieldProps) {
  const generatedId = useId()
  const triggerId = id ?? generatedId
  const listboxId = `${triggerId}-listbox`
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: MouseEvent) => {
      const root = rootRef.current
      if (!root || !(event.target instanceof Node) || root.contains(event.target)) return
      setOpen(false)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  const displayLabel = value || placeholder
  const isPlaceholder = !value

  return (
    <div ref={rootRef} className="relative">
      <button
        id={triggerId}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={() => setOpen((prev) => !prev)}
        className={`relative w-full rounded-xl border border-navy/15 bg-surface py-3 pl-4 pr-10 text-left text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-60 ${
          open ? 'border-accent ring-2 ring-accent/20' : ''
        }`}
      >
        <span className={`block truncate ${isPlaceholder ? 'text-navy/40' : 'font-medium text-navy'}`}>
          {displayLabel}
        </span>
        <span
          className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-navy/45 transition ${
            open ? 'rotate-180' : ''
          }`}
        >
          <ChevronDownIcon />
        </span>
      </button>

      {open ? (
        <ul
          id={listboxId}
          role="listbox"
          aria-labelledby={triggerId}
          className="absolute z-30 mt-2 max-h-60 w-full overflow-y-auto rounded-xl border border-navy/10 bg-white p-1.5 shadow-card"
        >
          {options.map((option) => {
            const selected = option === value
            return (
              <li key={option} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    onChange(option)
                    setOpen(false)
                  }}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition ${
                    selected
                      ? 'bg-accent/10 font-semibold text-accent-dark'
                      : 'text-navy/75 hover:bg-surface-alt hover:text-navy'
                  }`}
                >
                  <span className="min-w-0 flex-1 truncate">{option}</span>
                  {selected ? <CheckIcon className="text-accent" /> : null}
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
