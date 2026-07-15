import {
  formatShareCompletedDate,
  formatShareDuration,
  type UnitCompletedShareImage,
} from '@/lib/share/unitCompleted'
import {
  ObsidianShareCardFrame,
  ObsidianShareDividerLabel,
  ObsidianShareOrnament,
  ObsidianShareTitle,
} from './ObsidianShareCardFrame'

type Props = {
  unitName: string
  image: UnitCompletedShareImage
  totalSeconds: number
  completedAt: string
  sessionCount: number
  quote: string
}

export default function UnitCompletedCardPreview({
  unitName,
  image,
  totalSeconds,
  completedAt,
  sessionCount,
  quote,
}: Props) {
  const hasImage = image.source !== 'placeholder' && Boolean(image.url)
  const displayQuote =
    quote.length > 150 ? `${quote.slice(0, 147).trim()}...` : quote
  const sessionLabel = sessionCount === 1 ? 'Session' : 'Sessions'

  return (
    <div className="h-[960px] w-[540px] bg-black p-[15px]">
      <ObsidianShareCardFrame showBrandMark brandMarkHref={null}>
        <div className="relative -mx-1 -mt-1 h-[43%] shrink-0 overflow-hidden rounded-t-[18px] border border-[#8d5d2d]/60 bg-black">
          {hasImage ? (
            <>
              <img
                src={image.url}
                alt=""
                crossOrigin="anonymous"
                className="absolute inset-0 h-full w-full scale-110 object-cover opacity-45 blur-xl"
              />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,transparent_0,transparent_42%,rgba(0,0,0,0.58)_100%)]" />
              <img
                src={image.url}
                alt={image.alt}
                crossOrigin="anonymous"
                className="relative z-10 h-full w-full object-contain"
              />
            </>
          ) : (
            <div className="grid h-full w-full place-items-center bg-[radial-gradient(circle_at_30%_25%,rgba(45,212,191,0.34),transparent_30%),linear-gradient(135deg,#111827,#020617)] px-16 text-center">
              <span className="font-serif text-[72px] font-black uppercase leading-none tracking-[0.06em] text-[#9cf5ed]">
                {unitName}
              </span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#020806] via-transparent to-black/20" />
        </div>

        <ObsidianShareDividerLabel>Unit Completed</ObsidianShareDividerLabel>

        <div className="recipe-guide-cover-body flex min-h-0 flex-1 flex-col text-center">
          <div className="recipe-guide-cover-title">
            <ObsidianShareTitle title={unitName} />
          </div>

          <ObsidianShareOrnament />

          <p className="recipe-guide-cover-description font-serif text-white">
            &quot;{displayQuote}&quot;
            <br />
            <span className="text-white/82">- The Curator</span>
          </p>

          <ObsidianShareOrnament />

          <div className="recipe-guide-stats !gap-1 !px-2 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1.18fr)_auto_minmax(0,1fr)] items-start font-serif uppercase text-white">
            <UnitStat
              icon={<TimeIcon />}
              value={formatShareDuration(totalSeconds)}
              label="Worked"
            />
            <span className="recipe-guide-stat-divider h-full w-px bg-[#8d5d2d]" />
            <UnitStat
              icon={<DateIcon />}
              value={formatShareCompletedDate(completedAt)}
              label="Completed"
            />
            <span className="recipe-guide-stat-divider h-full w-px bg-[#8d5d2d]" />
            <UnitStat
              icon={<SessionIcon />}
              value={String(sessionCount)}
              label={sessionLabel}
            />
          </div>
        </div>
      </ObsidianShareCardFrame>
    </div>
  )
}

function UnitStat({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode
  value: string
  label: string
}) {
  return (
    <div className="flex min-w-0 flex-col items-center justify-start gap-1 text-center">
      <span className="recipe-guide-stat-icon-shell">{icon}</span>
      <span className="block min-w-0 max-w-full leading-[0.98]">
        <span className="block truncate font-black">{value}</span>
        <span className="block truncate text-[0.6em] font-black tracking-[0.08em] text-white/90">
          {label}
        </span>
      </span>
    </div>
  )
}

function TimeIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" className="recipe-guide-stat-icon">
      <path
        d="M14 5H34M14 43H34M16 5C16 15 22 16.2 24 24C26 16.2 32 15 32 5M16 43C16 33 22 31.8 24 24C26 31.8 32 33 32 43"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M19 36H29" fill="none" stroke="currentColor" strokeLinecap="round" />
    </svg>
  )
}

function DateIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" className="recipe-guide-stat-icon">
      <path
        d="M10 13H38V41H10V13Z"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
      />
      <path
        d="M16 7V17M32 7V17M10 21H38"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
      />
      <path
        d="M17 28H17.2M24 28H24.2M31 28H31.2M17 35H17.2M24 35H24.2"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="3"
      />
    </svg>
  )
}

function SessionIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" className="recipe-guide-stat-icon">
      <path
        d="M24 7L29.2 18L41 19.7L32.5 28L34.5 40L24 34.3L13.5 40L15.5 28L7 19.7L18.8 18L24 7Z"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
      />
      <circle cx="24" cy="24" r="4" fill="currentColor" opacity="0.22" />
    </svg>
  )
}
