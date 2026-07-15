import Link from 'next/link'
import type { ReactNode } from 'react'

export function ObsidianShareCardFrame({
  children,
  showBrandMark = false,
  brandMarkHref = '/',
}: {
  children: ReactNode
  showBrandMark?: boolean
  brandMarkHref?: string | null
}) {
  return (
    <article className="recipe-guide-card relative isolate flex h-full w-full overflow-hidden border border-[#b98137]/70 bg-[#020806] text-white shadow-[0_24px_80px_rgba(0,0,0,0.75)]">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_78%_18%,rgba(29,221,211,0.2),transparent_25%),radial-gradient(circle_at_50%_100%,rgba(38,236,224,0.16),transparent_16%),linear-gradient(135deg,#010504,#061715_48%,#020403)]" />
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-70 [background-image:linear-gradient(120deg,transparent_0,rgba(255,255,255,0.035)_1px,transparent_2px),radial-gradient(circle_at_20%_30%,rgba(255,255,255,0.06),transparent_1px)] [background-size:28px_28px,13px_13px]" />
      <div className="pointer-events-none absolute inset-[9px] rounded-[20px] border border-[#d6a253]/70" />
      <div className="pointer-events-none absolute inset-[15px] rounded-[16px] border border-[#6f471f]/80" />
      <ObsidianShareCorner className="left-[21px] top-[21px]" />
      <ObsidianShareCorner className="right-[21px] top-[21px] rotate-90" />
      <ObsidianShareCorner className="bottom-[21px] right-[21px] rotate-180" />
      <ObsidianShareCorner className="bottom-[21px] left-[21px] -rotate-90" />
      <div className="relative z-10 flex min-h-0 w-full flex-col">{children}</div>
      {showBrandMark ? (
        <ObsidianShareBrandMark href={brandMarkHref} />
      ) : null}
    </article>
  )
}

export function ObsidianShareBrandMark({
  href = '/',
}: {
  href?: string | null
}) {
  const className = 'recipe-guide-brand-mark'

  if (!href) {
    return <span className={className}>made with the Obsidian Gallery</span>
  }

  return (
    <Link
      href={href}
      className={className}
      aria-label="Made with Obsidian Gallery"
    >
      made with the Obsidian Gallery
    </Link>
  )
}

export function ObsidianShareCorner({ className }: { className: string }) {
  return (
    <div
      className={`pointer-events-none absolute h-12 w-12 border-l border-t border-[#d8a24a]/80 ${className}`}
    >
      <span className="absolute left-2 top-2 h-3 w-3 border border-[#d8a24a]/70" />
      <span className="absolute left-0 top-7 h-px w-9 bg-[#d8a24a]/70" />
      <span className="absolute left-7 top-0 h-9 w-px bg-[#d8a24a]/70" />
    </div>
  )
}

export function ObsidianShareOrnament() {
  return (
    <div className="recipe-guide-ornament flex shrink-0 items-center gap-2 text-[#d69a45]">
      <span className="h-px flex-1 bg-gradient-to-r from-transparent via-[#b98137] to-[#b98137]" />
      <span className="h-2 w-2 rotate-45 border border-[#d69a45] bg-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.85)]" />
      <span className="h-px flex-1 bg-gradient-to-l from-transparent via-[#b98137] to-[#b98137]" />
    </div>
  )
}

export function ObsidianShareDividerLabel({ children }: { children: ReactNode }) {
  return (
    <div className="recipe-guide-cover-divider flex items-center gap-2 text-[#d69a45]">
      <span className="h-px flex-1 bg-[#8d5d2d]" />
      <p className="recipe-guide-kicker font-black uppercase">{children}</p>
      <span className="h-px flex-1 bg-[#8d5d2d]" />
    </div>
  )
}

export function ObsidianShareTitle({
  title,
  compact = false,
}: {
  title: string
  compact?: boolean
}) {
  return (
    <h2
      className={[
        'recipe-guide-title font-serif font-black uppercase text-[#9cf5ed] drop-shadow-[0_2px_0_rgba(255,255,255,0.22)]',
        compact ? 'recipe-guide-title-compact' : '',
      ].join(' ')}
    >
      {getTitleLines(title).map((line) => (
        <span key={line} className="block">
          {line}
        </span>
      ))}
    </h2>
  )
}

export function ObsidianShareStepIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 48 48"
      className="recipe-guide-stat-icon"
    >
      <circle cx="24" cy="24" r="17" fill="none" stroke="currentColor" />
      <circle cx="24" cy="24" r="5" fill="currentColor" opacity="0.22" />
      <path
        d="M24 2v8M24 38v8M2 24h8M38 24h8M34.5 13.5l-5.6 5.6M19.1 28.9l-5.6 5.6"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function ObsidianSharePaletteIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 48 48"
      className="recipe-guide-stat-icon"
    >
      <path
        d="M24 5C13.5 5 5.5 12.4 5.5 22.7c0 9.8 7.3 17.8 17.1 19.1 2.5.3 4.5-1.5 4.5-4 0-1.8 1.4-3.2 3.2-3.2h3.5c5.5 0 8.7-3.5 8.7-8.8C42.5 14.5 34.5 5 24 5Z"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
      />
      <circle cx="16" cy="18" r="3" fill="currentColor" opacity="0.45" />
      <circle cx="25" cy="14" r="3" fill="currentColor" opacity="0.72" />
      <circle cx="33" cy="22" r="3" fill="currentColor" opacity="0.9" />
      <circle cx="18" cy="29" r="3" fill="currentColor" opacity="0.62" />
    </svg>
  )
}

function getTitleLines(title: string) {
  const words = title.trim().split(/\s+/).filter(Boolean)

  if (words.length <= 2) return words

  const midpoint = Math.ceil(words.length / 2)
  return [words.slice(0, midpoint).join(' '), words.slice(midpoint).join(' ')]
}
