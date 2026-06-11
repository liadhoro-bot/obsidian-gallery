'use client'

export type DisplayMode = 'cards' | 'tiles'

type DisplayModeToggleProps = {
  mode: DisplayMode
  onModeChange: (mode: DisplayMode) => void
  className?: string
}

const options: {
  mode: DisplayMode
  label: string
}[] = [
  { mode: 'cards', label: 'Cards' },
  { mode: 'tiles', label: 'Tiles' },
]

function CardsIcon() {
  return (
    <span aria-hidden="true" className="grid gap-0.5">
      {Array.from({ length: 3 }).map((_, index) => (
        <span key={index} className="flex items-center gap-0.5">
          <span className="h-1.5 w-1.5 rounded-[2px] bg-current" />
          <span className="h-1 w-5 rounded-full bg-current" />
        </span>
      ))}
    </span>
  )
}

function TilesIcon() {
  return (
    <span aria-hidden="true" className="grid grid-cols-3 gap-0.5">
      {Array.from({ length: 9 }).map((_, index) => (
        <span
          key={index}
          className="h-1.5 w-1.5 rounded-[2px] border border-current bg-current/20"
        />
      ))}
    </span>
  )
}

export default function DisplayModeToggle({
  mode,
  onModeChange,
  className = '',
}: DisplayModeToggleProps) {
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/70 p-1.5 shadow-[0_0_18px_rgba(34,211,238,0.08)] ${className}`}
      aria-label="Display mode"
    >
      {options.map((option) => {
        const isActive = option.mode === mode

        return (
          <button
            key={option.mode}
            type="button"
            onClick={() => onModeChange(option.mode)}
            title={option.label}
            className={[
              'inline-flex h-7 w-7 items-center justify-center rounded-[10px] transition active:scale-[0.98] active:opacity-70',
              isActive
                ? 'bg-cyan-400/14 text-cyan-200 ring-1 ring-cyan-300/45 shadow-[0_0_12px_rgba(34,211,238,0.14)]'
                : 'text-white/45 hover:bg-white/6 hover:text-white/75',
            ].join(' ')}
            aria-pressed={isActive}
            aria-label={option.label}
          >
            {option.mode === 'cards' ? <CardsIcon /> : <TilesIcon />}
          </button>
        )
      })}
    </div>
  )
}
