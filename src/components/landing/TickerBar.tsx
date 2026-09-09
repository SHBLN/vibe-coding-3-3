import { StarIcon } from './ui'

const items = [
  'СОЗДАНО ДЛЯ ЯСНОСТИ',
  'НА БАЗЕ ИИ',
  'ДЛЯ ДВИЖЕНИЯ ВПЕРЁД',
  'МЕНЬШЕ ХАОСА',
]

export function TickerBar() {
  return (
    <div className="section-shell py-3">
      <div className="panel-shell flex flex-wrap items-center justify-center gap-5 overflow-hidden bg-navy px-6 py-4 text-xs font-black uppercase tracking-[0.2em] text-white">
        {items.map((item, i) => (
          <span key={item} className="flex items-center gap-4">
            {item}
            {i < items.length - 1 && <StarIcon className="h-3 w-3 text-accent" />}
          </span>
        ))}
      </div>
    </div>
  )
}
