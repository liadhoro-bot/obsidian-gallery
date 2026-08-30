'use client'

import Image from 'next/image'
import type { ReactNode } from 'react'
import { useId } from 'react'
import {
  ObsidianShareCardFrame,
  ObsidianShareDividerLabel,
  ObsidianShareOrnament,
  ObsidianSharePaletteIcon,
  ObsidianShareStepIcon,
  ObsidianShareTitle,
} from '@/components/share/ObsidianShareCardFrame'
import type { Recipe, RecipeImage, RecipeStep, StepPaintLink } from './types'

type RecipeGuidePaint = NonNullable<StepPaintLink['paint']> & {
  ratio_text?: string | null
}

function isUsableImageUrl(value?: string | null) {
  const url = typeof value === 'string' ? value.trim() : ''
  return (
    url.startsWith('http://') ||
    url.startsWith('https://') ||
    (url.startsWith('/') && !url.startsWith('//')) ||
    url.startsWith('blob:') ||
    url.startsWith('data:image/')
  )
}

function isInlinePreviewImageUrl(value?: string | null) {
  const url = typeof value === 'string' ? value.trim() : ''
  return url.startsWith('blob:') || url.startsWith('data:image/')
}

function getYoutubeVideoId(url: string | null) {
  if (!url) return null

  try {
    const parsed = new URL(url)

    if (parsed.hostname.includes('youtu.be')) {
      return parsed.pathname.replace('/', '') || null
    }

    if (parsed.hostname.includes('youtube.com')) {
      const watchId = parsed.searchParams.get('v')
      if (watchId) return watchId

      if (parsed.pathname.startsWith('/shorts/')) {
        return parsed.pathname.split('/')[2] || null
      }

      if (parsed.pathname.startsWith('/embed/')) {
        return parsed.pathname.split('/')[2] || null
      }
    }

    return null
  } catch {
    return null
  }
}

function getYoutubeEmbedUrl(url: string | null) {
  const id = getYoutubeVideoId(url)
  return id ? `https://www.youtube.com/embed/${id}` : null
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
        <p className="recipe-guide-paint-name font-serif leading-tight">
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
        <span className="recipe-guide-divider-rule h-px flex-1" />
        <p className="recipe-guide-paints-label text-center font-black uppercase">
          Paints Used
        </p>
        <span className="recipe-guide-divider-rule h-px flex-1" />
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
  showBrandMark = false,
}: {
  recipe: Recipe
  featuredImage: RecipeImage | null
  stepCount: number
  paintCount: number
  showBrandMark?: boolean
}) {
  const imageUrl = isUsableImageUrl(featuredImage?.image_url)
    ? featuredImage?.image_url
    : null
  const description = recipe.description?.trim()

  return (
    <ObsidianShareCardFrame showBrandMark={showBrandMark}>
      <div className="recipe-guide-cover-image relative -mx-1 -mt-1 h-[43%] shrink-0 overflow-hidden rounded-t-[18px] border">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={featuredImage?.alt_text || recipe.name}
            fill
            priority
            sizes="(max-width: 768px) 92vw, 420px"
            className="object-cover"
            unoptimized={isInlinePreviewImageUrl(imageUrl)}
          />
        ) : (
          <div className="h-full w-full bg-[radial-gradient(circle_at_30%_25%,rgba(45,212,191,0.34),transparent_30%),linear-gradient(135deg,#111827,#020617)]" />
        )}
        <div className="recipe-guide-cover-image-shade absolute inset-0" />
      </div>

      <ObsidianShareDividerLabel>
        Miniature Painting Guide
      </ObsidianShareDividerLabel>

      <div className="recipe-guide-cover-body flex min-h-0 flex-1 flex-col text-center">
        <div className="recipe-guide-cover-title">
          <ObsidianShareTitle title={recipe.name} />
        </div>
        <ObsidianShareOrnament />
        {description ? (
          <p className="recipe-guide-cover-description font-serif">
            {description}
          </p>
        ) : null}
        <ObsidianShareOrnament />
        <div className="recipe-guide-stats grid grid-cols-[1fr_auto_1fr] items-center font-serif uppercase">
          <CoverStat icon={<ObsidianShareStepIcon />} count={stepCount} label="Steps" />
          <span className="recipe-guide-stat-divider w-px" />
          <CoverStat icon={<ObsidianSharePaletteIcon />} count={paintCount} label="Paints" />
        </div>
      </div>
    </ObsidianShareCardFrame>
  )
}

export function RecipeGuideImageStepCard({
  step,
  stepsLength,
  paints,
  showBrandMark = false,
}: {
  step: RecipeStep
  stepsLength: number
  paints: RecipeGuidePaint[]
  showBrandMark?: boolean
}) {
  const imageUrl = isUsableImageUrl(step.image_url) ? step.image_url : null

  return (
    <ObsidianShareCardFrame showBrandMark={showBrandMark}>
      <div className="recipe-guide-step-head shrink-0 text-center">
        <p className="recipe-guide-step-number font-serif uppercase">
          <span className="recipe-guide-step-number-word">Step</span>
          <span className="recipe-guide-step-number-value">
            {step.step_number}
          </span>
          <span className="recipe-guide-step-number-word">of</span>
          <span className="recipe-guide-step-number-value">{stepsLength}</span>
        </p>
        <ObsidianShareOrnament />
        <ObsidianShareTitle title={step.title} compact />
      </div>
      <div className="recipe-guide-image-paints">
        <PaintsUsed paints={paints} columns />
      </div>
      <ObsidianShareOrnament />
      <div className="recipe-guide-step-image relative -mx-1 min-h-0 flex-1 overflow-hidden border-y">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={step.title}
            fill
            sizes="(max-width: 768px) 92vw, 420px"
            className="object-cover"
            unoptimized={isInlinePreviewImageUrl(imageUrl)}
          />
        ) : null}
      </div>
      <div className="recipe-guide-short-description shrink-0 text-center">
        <p className="recipe-guide-short-copy font-serif">
          {step.instructions}
        </p>
      </div>
    </ObsidianShareCardFrame>
  )
}

export function RecipeGuideDescriptiveStepCard({
  step,
  stepsLength,
  paints,
  showBrandMark = false,
}: {
  step: RecipeStep
  stepsLength: number
  paints: RecipeGuidePaint[]
  showBrandMark?: boolean
}) {
  return (
    <ObsidianShareCardFrame showBrandMark={showBrandMark}>
      <div className="recipe-guide-step-head recipe-guide-step-head-descriptive shrink-0 text-center">
        <p className="recipe-guide-step-number font-serif uppercase">
          <span className="recipe-guide-step-number-word">Step</span>
          <span className="recipe-guide-step-number-value">
            {step.step_number}
          </span>
          <span className="recipe-guide-step-number-word">of</span>
          <span className="recipe-guide-step-number-value">{stepsLength}</span>
        </p>
        <ObsidianShareOrnament />
        <ObsidianShareTitle title={step.title} compact />
      </div>
      <ObsidianShareOrnament />
      <PaintsUsed paints={paints} />
      <ObsidianShareOrnament />
      <div className="recipe-guide-long-description grid min-h-0 flex-1 place-items-start text-center">
        <p className="recipe-guide-long-copy max-h-full overflow-hidden font-serif">
          {step.instructions}
        </p>
      </div>
    </ObsidianShareCardFrame>
  )
}

function PaintOwnershipPill({ paint }: { paint: RecipeGuidePaint }) {
  if (paint?.is_owned) {
    return <span className="recipe-guide-paint-list-pill recipe-guide-paint-list-pill-owned">Owned</span>
  }

  if (paint?.is_wishlist) {
    return <span className="recipe-guide-paint-list-pill recipe-guide-paint-list-pill-wishlist">Wishlist</span>
  }

  return <span className="recipe-guide-paint-list-pill">Not Owned</span>
}

function PaintListSwatch({ paint }: { paint: RecipeGuidePaint }) {
  const color = paint?.hex_approx || '#8b8b8b'
  const swatchUrl = isUsableImageUrl(paint?.swatch_image_url)
    ? paint.swatch_image_url
    : null

  return (
    <span
      className="recipe-guide-paint-list-swatch"
      style={{ backgroundColor: color }}
    >
      {swatchUrl ? (
        <Image src={swatchUrl} alt="" fill sizes="48px" className="object-cover" />
      ) : null}
    </span>
  )
}

export function RecipeGuidePaintsCard({
  title,
  description,
  paints,
  showBrandMark = false,
}: {
  title: string
  description: string
  paints: RecipeGuidePaint[]
  showBrandMark?: boolean
}) {
  return (
    <ObsidianShareCardFrame showBrandMark={showBrandMark}>
      <div className="recipe-guide-step-head shrink-0 text-center">
        <p className="recipe-guide-step-number font-serif uppercase">
          <span className="recipe-guide-step-number-word">The Palette</span>
        </p>
        <ObsidianShareOrnament />
        <ObsidianShareTitle title={title} compact />
      </div>
      <ObsidianShareOrnament />
      <div className="recipe-guide-paint-list min-h-0 flex-1 overflow-y-auto">
        {paints.length ? (
          <ul className="recipe-guide-paint-list-items">
            {paints.map((paint, index) => (
              <li
                key={`${paint?.id || 'paint'}-${index}`}
                className="recipe-guide-paint-list-row"
              >
                <PaintListSwatch paint={paint} />
                <span className="recipe-guide-paint-list-copy">
                  <strong className="font-serif">{paint?.name || 'Unnamed paint'}</strong>
                  <small>
                    {[paint?.brand, paint?.line].filter(Boolean).join(' - ') || 'Unknown source'}
                  </small>
                </span>
                <PaintOwnershipPill paint={paint} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="recipe-guide-paint-list-empty font-serif">
            No paints have been added yet.
          </p>
        )}
      </div>
      {description ? (
        <div className="recipe-guide-short-description shrink-0 text-center">
          <p className="recipe-guide-short-copy font-serif">{description}</p>
        </div>
      ) : null}
    </ObsidianShareCardFrame>
  )
}

export function RecipeGuideVideoCard({
  title,
  description,
  youtubeUrl,
  showBrandMark = false,
}: {
  title: string
  description: string
  youtubeUrl: string | null
  showBrandMark?: boolean
}) {
  const embedUrl = getYoutubeEmbedUrl(youtubeUrl)

  return (
    <ObsidianShareCardFrame showBrandMark={showBrandMark}>
      <div className="recipe-guide-step-head shrink-0 text-center">
        <p className="recipe-guide-step-number font-serif uppercase">
          <span className="recipe-guide-step-number-word">Video</span>
        </p>
        <ObsidianShareOrnament />
        <ObsidianShareTitle title={title} compact />
      </div>
      <ObsidianShareOrnament />
      <div className="recipe-guide-video-frame relative -mx-1 min-h-0 flex-1 overflow-hidden border-y">
        {embedUrl ? (
          <iframe
            src={embedUrl}
            title={title}
            className="recipe-guide-video-iframe"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        ) : (
          <div className="recipe-guide-video-empty grid h-full place-items-center text-center font-serif">
            No video linked yet.
          </div>
        )}
      </div>
      {description ? (
        <div className="recipe-guide-short-description shrink-0 text-center">
          <p className="recipe-guide-short-copy font-serif">{description}</p>
        </div>
      ) : null}
    </ObsidianShareCardFrame>
  )
}
