'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import BackButton from '../../components/back-button'
import ThemeVisibilityPill from './theme-visibility-pill'
import { updateTheme } from './actions'

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
          <Image
            src={heroUrl}
            alt={name || 'Theme image'}
            fill
            priority
            sizes="(max-width: 768px) 100vw, 420px"
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/30 via-slate-900 to-black" />
        )}

        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-[#07090d]" />

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
    </section>
  )
}
