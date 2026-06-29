'use client'

import Image from 'next/image'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { buildVaultColorMatchHref } from '@/components/color-sampler/color-match-navigation'
import EyedropperIcon from '@/components/color-sampler/EyedropperIcon'
import BackButton from '../../components/back-button'
import ThemeVisibilityPill from './theme-visibility-pill'
import { updateTheme } from './actions'

const ColorSamplerDialog = dynamic(
  () => import('@/components/color-sampler/ColorSamplerDialog'),
  { ssr: false }
)

type Props = {
  themeId: string
  name: string
  description: string | null
  tags: string[]
  heroUrl: string | null
  isOwner: boolean
  isPublic: boolean
}

export default function ThemeDetailHero({
  themeId,
  name,
  description,
  tags,
  heroUrl,
  isOwner,
  isPublic,
}: Props) {
  const router = useRouter()
  const [isEditing, setIsEditing] = useState(false)
  const [expandedImageUrl, setExpandedImageUrl] = useState<string | null>(null)
  const [samplerImageUrl, setSamplerImageUrl] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleUpdate(formData: FormData) {
    startTransition(async () => {
      await updateTheme(themeId, formData)
      setIsEditing(false)
      router.refresh()
    })
  }

  return (
    <section className="relative mt-4">
      <div className="relative h-[340px] overflow-hidden bg-white/[0.04]">
        {heroUrl ? (
          <button
            type="button"
            onClick={() => setExpandedImageUrl(heroUrl)}
            className="absolute inset-0 z-0 block"
            aria-label="Expand theme image"
          >
            <Image
              src={heroUrl}
              alt={name || 'Theme image'}
              fill
              priority
              sizes="(max-width: 768px) 100vw, 420px"
              className="object-cover"
            />
          </button>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/30 via-slate-900 to-black" />
        )}

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-[#07090d]" />

        <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-4 pt-4">
          <BackButton fallbackHref="/themes" />

          <div className="flex items-center gap-2">
            {isOwner ? (
              <ThemeVisibilityPill themeId={themeId} isPublic={isPublic} />
            ) : (
              <span className="rounded-full border border-white/10 bg-black/40 px-3 py-2 text-xs text-white/70 backdrop-blur">
                {isPublic ? 'Public theme' : 'Private theme'}
              </span>
            )}

            {isOwner ? (
              <button
                type="button"
                onClick={() => setIsEditing((current) => !current)}
                className="rounded-full border border-white/10 bg-black/40 px-4 py-2 text-xs font-semibold text-white backdrop-blur transition hover:bg-black/60"
              >
                {isEditing ? 'Close' : 'Edit'}
              </button>
            ) : null}
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-0 z-10 px-4 pb-6">
          <p className="text-xs uppercase tracking-[0.25em] text-cyan-400">
            Theme
          </p>
          <h1 className="mt-2 text-4xl font-bold leading-tight text-white">
            {name}
          </h1>
        </div>
      </div>

      <div className="px-4 py-4">
        {description ? (
          <p className="text-sm leading-6 text-white/65">{description}</p>
        ) : (
          <p className="text-sm leading-6 text-white/45">No description yet.</p>
        )}

        {tags.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-white/[0.06] px-3 py-1 text-xs text-white/55"
              >
                #{tag}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {isOwner && isEditing ? (
        <div className="px-4 pb-2">
          <form
            action={handleUpdate}
            className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4"
          >
            <div>
              <label className="mb-2 block text-sm font-medium text-white">
                Theme Name
              </label>
              <input
                name="name"
                defaultValue={name}
                required
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-white">
                Description
              </label>
              <textarea
                name="description"
                rows={4}
                defaultValue={description || ''}
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-white">
                Replace Hero Image
              </label>
              <input
                type="file"
                name="image"
                accept="image/*"
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/70"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-white">
                Tags
              </label>
              <input
                name="tags"
                defaultValue={tags.join(', ')}
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white outline-none"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isPending}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-2 font-bold text-slate-950 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-white/60 disabled:opacity-70"
              >
                {isPending ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : null}
                <span>{isPending ? 'Saving...' : 'Save'}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="rounded-xl border border-white/10 px-4 py-2 text-white"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {expandedImageUrl ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setExpandedImageUrl(null)
            }
          }}
          role="dialog"
          aria-modal="true"
          aria-label={`${name || 'Theme'} image`}
        >
          <div
            className="absolute left-4 top-4 z-50"
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
            onPointerUp={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setSamplerImageUrl(expandedImageUrl)}
              className="tap-press inline-flex h-9 w-9 items-center justify-center rounded-full border border-cyan-300/40 bg-black/70 text-cyan-100 shadow-lg backdrop-blur transition hover:bg-cyan-300/15 focus:outline-none focus:ring-2 focus:ring-cyan-300/70"
              aria-label="Match Paint from theme image"
              title="Match Paint"
            >
              <EyedropperIcon />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setExpandedImageUrl(null)}
            className="tap-press mobile-close-button absolute right-4 top-4 z-50 rounded-full bg-white/10 px-4 py-2 text-sm font-bold text-white backdrop-blur"
          >
            Close
          </button>

          <div
            className="mobile-scroll max-h-[88dvh] max-w-6xl overflow-auto"
            onClick={(event) => event.stopPropagation()}
          >
            <Image
              src={expandedImageUrl}
              alt={name || 'Theme image'}
              width={1400}
              height={1400}
              sizes="100vw"
              className="max-h-[88dvh] rounded-2xl object-contain"
            />
          </div>
        </div>
      ) : null}

      {samplerImageUrl ? (
        <ColorSamplerDialog
          open={Boolean(samplerImageUrl)}
          onOpenChange={(open) => {
            if (!open) setSamplerImageUrl(null)
          }}
          imageSource={{ src: samplerImageUrl, alt: name || 'Theme image' }}
          source="theme_gallery"
          allowCameraCapture={false}
          allowImageUpload={false}
          onConfirm={(sample) => {
            setSamplerImageUrl(null)
            setExpandedImageUrl(null)
            startTransition(() => {
              router.push(buildVaultColorMatchHref(sample))
            })
          }}
        />
      ) : null}
    </section>
  )
}
