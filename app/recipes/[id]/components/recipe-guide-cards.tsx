'use client'

import Image from 'next/image'
import type { ReactNode } from 'react'
import { useId } from 'react'
import type { Recipe, RecipeImage, RecipeStep, StepPaintLink } from './types'

type RecipeGuidePaint = NonNullable<StepPaintLink['paint']> & {
  ratio_text?: string | null
}

function isUsableImageUrl(value?: string | null) {
  const url = typeof value === 'string' ? value.trim() : ''
  return url.startsWith('http://') || url.startsWith('https://')
}

function CardFrame({ children }: { children: ReactNode }) {
  return (
    <article className="recipe-guide-card relative isolate flex h-full w-full overflow-hidden border border-[#b98137]/70 bg-[#020806] text-white shadow-[0_24px_80px_rgba(0,0,0,0.75)]">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_78%_18%,rgba(29,221,211,0.2),transparent_25%),radial-gradient(circle_at_50%_100%,rgba(38,236,224,0.16),transparent_16%),linear-gradient(135deg,#010504,#061715_48%,#020403)]" />
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-70 [background-image:linear-gradient(120deg,transparent_0,rgba(255,255,255,0.035)_1px,transparent_2px),radial-gradient(circle_at_20%_30%,rgba(255,255,255,0.06),transparent_1px)] [background-size:28px_28px,13px_13px]" />
      <div className="pointer-events-none absolute inset-[9px] rounded-[20px] border border-[#d6a253]/70" />
      <div className="pointer-events-none absolute inset-[15px] rounded-[16px] border border-[#6f471f]/80" />
      <Corner className="left-[21px] top-[21px]" />
      <Corner className="right-[21px] top-[21px] rotate-90" />
      <Corner className="bottom-[21px] right-[21px] rotate-180" />
      <Corner className="bottom-[21px] left-[21px] -rotate-90" />
      <div className="relative z-10 flex min-h-0 w-full flex-col">{children}</div>
    </article>
  )
}

function Corner({ className }: { className: string }) {
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

function Ornament() {
  return (
    <div className="recipe-guide-ornament flex shrink-0 items-center gap-2 text-[#d69a45]">
      <span className="h-px flex-1 bg-gradient-to-r from-transparent via-[#b98137] to-[#b98137]" />
      <span className="h-2 w-2 rotate-45 border border-[#d69a45] bg-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.85)]" />
      <span className="h-px flex-1 bg-gradient-to-l from-transparent via-[#b98137] to-[#b98137]" />
    </div>
  )
}

function StepIcon() {
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

function PaletteIcon() {
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

function CoverStat({
  icon,
  count,
  label,
}: {
  icon: ReactNode
  count: number
  label: string
}) {
  return (
    <div className="recipe-guide-stat-item">
      <span className="recipe-guide-stat-icon-shell">{icon}</span>
      <span>
        {count} {label}
      </span>
    </div>
  )
}

function getTitleLines(title: string) {
  const words = title.trim().split(/\s+/).filter(Boolean)

  if (words.length <= 2) return words

  const midpoint = Math.ceil(words.length / 2)
  return [words.slice(0, midpoint).join(' '), words.slice(midpoint).join(' ')]
}

function getPaintDaubPresentation(color: string) {
  const match = color.match(/^#?([0-9a-f]{6})$/i)

  if (!match) {
    return {
      color,
      sheenOpacity: 0.08,
    }
  }

  const value = match[1]
  const red = parseInt(value.slice(0, 2), 16) / 255
  const green = parseInt(value.slice(2, 4), 16) / 255
  const blue = parseInt(value.slice(4, 6), 16) / 255
  const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue
  const isDark = luminance < 0.18

  return {
    color,
    sheenOpacity: isDark ? 0.035 : 0.08,
  }
}

function GuideTitle({
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

function PaintMark({
  paint,
  showParts,
}: {
  paint: RecipeGuidePaint
  showParts: boolean
}) {
  const maskId = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const color = paint?.hex_approx || '#8b8b8b'
  const ratio = Math.max(1, Math.min(parseInt(paint?.ratio_text || '1', 10) || 1, 6))
  const name = paint?.name || 'Unnamed paint'
  const label = showParts ? `${ratio} ${ratio === 1 ? 'Pt' : 'Pts'} ${name}` : name
  const daub = getPaintDaubPresentation(color)
  const swatchUrl = isUsableImageUrl(paint?.swatch_image_url)
    ? paint.swatch_image_url
    : null

  return (
    <div className="recipe-guide-paint-row flex min-w-0 flex-col items-center text-center">
      <div
        className="recipe-guide-paint-daub-stack"
        aria-label={label}
        title={label}
      >
        <span className="recipe-guide-paint-daub">
          <svg
            aria-hidden="true"
            viewBox="0 0 590 300"
            preserveAspectRatio="xMidYMid meet"
            className="recipe-guide-paint-daub-svg"
          >
            <defs>
              <mask id={`${maskId}-paint-daub-mask`} maskUnits="userSpaceOnUse">
                <image
                  href="/recipe-guide/paint-daub-mask.png"
                  width="590"
                  height="300"
                  preserveAspectRatio="xMidYMid meet"
                />
              </mask>
              <radialGradient id={`${maskId}-paint-daub-sheen`}>
                <stop offset="0%" stopColor="#ffffff" stopOpacity={daub.sheenOpacity} />
                <stop offset="58%" stopColor="#ffffff" stopOpacity="0" />
              </radialGradient>
              <linearGradient
                id={`${maskId}-paint-daub-shadow`}
                x1="0"
                x2="1"
                y1="0"
                y2="1"
              >
                <stop offset="35%" stopColor="#000000" stopOpacity="0" />
                <stop offset="100%" stopColor="#000000" stopOpacity="0.2" />
              </linearGradient>
            </defs>
            <g mask={`url(#${maskId}-paint-daub-mask)`}>
              <rect width="590" height="300" fill={daub.color} />
              {swatchUrl ? (
                <image
                  href={swatchUrl}
                  width="590"
                  height="300"
                  preserveAspectRatio="xMidYMid slice"
                  opacity="0.96"
                />
              ) : null}
              <rect
                width="590"
                height="300"
                fill={`url(#${maskId}-paint-daub-sheen)`}
              />
              <rect
                width="590"
                height="300"
                fill={`url(#${maskId}-paint-daub-shadow)`}
              />
            </g>
          </svg>
        </span>
      </div>
      <div className="recipe-guide-paint-copy min-w-0">
        <p className="recipe-guide-paint-name font-serif leading-tight text-white">
          {label}
        </p>
      </div>
    </div>
  )
}

function PaintsUsed({
  paints,
  columns = false,
}: {
  paints: RecipeGuidePaint[]
  columns?: boolean
}) {
  if (paints.length === 0) return null

  return (
    <section className="recipe-guide-paints shrink-0">
      <div className="flex items-center gap-2">
        <span className="h-px flex-1 bg-[#8d5d2d]" />
        <p className="recipe-guide-paints-label text-center font-black uppercase text-[#d69a45]">
          Paints Used
        </p>
        <span className="h-px flex-1 bg-[#8d5d2d]" />
      </div>
      <div
        className={[
          'recipe-guide-paints-grid',
          columns ? 'grid' : 'grid',
        ].join(' ')}
        style={{
          gridTemplateColumns: `repeat(${Math.min(paints.length, 4)}, minmax(0, 1fr))`,
        }}
      >
        {paints.slice(0, 4).map((paint, index) => (
          <PaintMark
            key={`${paint?.id || 'paint'}-${index}`}
            paint={paint}
            showParts={paints.length > 1}
          />
        ))}
      </div>
    </section>
  )
}

export function RecipeGuideCoverCard({
  recipe,
  featuredImage,
  stepCount,
  paintCount,
}: {
  recipe: Recipe
  featuredImage: RecipeImage | null
  stepCount: number
  paintCount: number
}) {
  const imageUrl = isUsableImageUrl(featuredImage?.image_url)
    ? featuredImage?.image_url
    : null

  return (
    <CardFrame>
      <div className="relative -mx-1 -mt-1 h-[43%] shrink-0 overflow-hidden rounded-t-[18px] border border-[#8d5d2d]/60 bg-black">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={featuredImage?.alt_text || recipe.name}
            fill
            priority
            sizes="(max-width: 768px) 92vw, 420px"
            className="object-cover"
          />
        ) : (
          <div className="h-full w-full bg-[radial-gradient(circle_at_30%_25%,rgba(45,212,191,0.34),transparent_30%),linear-gradient(135deg,#111827,#020617)]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#020806] via-transparent to-black/20" />
      </div>

      <div className="recipe-guide-cover-divider flex items-center gap-2 text-[#d69a45]">
        <span className="h-px flex-1 bg-[#8d5d2d]" />
        <p className="recipe-guide-kicker font-black uppercase">
          Miniature Painting Recipe
        </p>
        <span className="h-px flex-1 bg-[#8d5d2d]" />
      </div>

      <div className="recipe-guide-cover-body flex min-h-0 flex-1 flex-col text-center">
        <div className="recipe-guide-cover-title">
          <GuideTitle title={recipe.name} />
        </div>
        <Ornament />
        <div className="recipe-guide-stats grid grid-cols-[1fr_auto_1fr] items-center font-serif uppercase text-white">
          <CoverStat icon={<StepIcon />} count={stepCount} label="Steps" />
          <span className="recipe-guide-stat-divider w-px bg-[#8d5d2d]" />
          <CoverStat icon={<PaletteIcon />} count={paintCount} label="Paints" />
        </div>
      </div>
    </CardFrame>
  )
}

export function RecipeGuideImageStepCard({
  step,
  stepsLength,
  paints,
}: {
  step: RecipeStep
  stepsLength: number
  paints: RecipeGuidePaint[]
}) {
  const imageUrl = isUsableImageUrl(step.image_url) ? step.image_url : null

  return (
    <CardFrame>
      <div className="recipe-guide-step-head shrink-0 text-center">
        <p className="recipe-guide-step-number font-serif uppercase text-cyan-300">
          <span className="recipe-guide-step-number-word">Step</span>
          <span className="recipe-guide-step-number-value">
            {step.step_number}
          </span>
          <span className="recipe-guide-step-number-word">of</span>
          <span className="recipe-guide-step-number-value">{stepsLength}</span>
        </p>
        <Ornament />
        <GuideTitle title={step.title} compact />
      </div>
      <div className="recipe-guide-image-paints">
        <PaintsUsed paints={paints} columns />
      </div>
      <Ornament />
      <div className="relative -mx-1 min-h-0 flex-1 overflow-hidden border-y border-[#8d5d2d]/70 bg-black">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={step.title}
            fill
            sizes="(max-width: 768px) 92vw, 420px"
            className="object-cover"
          />
        ) : null}
      </div>
      <div className="recipe-guide-short-description shrink-0 text-center">
        <p className="recipe-guide-short-copy font-serif text-white">
          {step.instructions}
        </p>
      </div>
    </CardFrame>
  )
}

export function RecipeGuideDescriptiveStepCard({
  step,
  stepsLength,
  paints,
}: {
  step: RecipeStep
  stepsLength: number
  paints: RecipeGuidePaint[]
}) {
  return (
    <CardFrame>
      <div className="recipe-guide-step-head recipe-guide-step-head-descriptive shrink-0 text-center">
        <p className="recipe-guide-step-number font-serif uppercase text-cyan-300">
          <span className="recipe-guide-step-number-word">Step</span>
          <span className="recipe-guide-step-number-value">
            {step.step_number}
          </span>
          <span className="recipe-guide-step-number-word">of</span>
          <span className="recipe-guide-step-number-value">{stepsLength}</span>
        </p>
        <Ornament />
        <GuideTitle title={step.title} compact />
      </div>
      <Ornament />
      <PaintsUsed paints={paints} />
      <Ornament />
      <div className="recipe-guide-long-description grid min-h-0 flex-1 place-items-start text-center">
        <p className="recipe-guide-long-copy max-h-full overflow-hidden font-serif text-white">
          {step.instructions}
        </p>
      </div>
    </CardFrame>
  )
}
