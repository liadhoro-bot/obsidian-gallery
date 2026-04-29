'use client'

import { useMemo, useState } from 'react'
import { updateRecipeYoutubeUrl } from './recipe-actions'

type RecipeVideoCardProps = {
  recipeId: string
  youtubeUrl: string | null
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

export default function RecipeVideoCard({
  recipeId,
  youtubeUrl,
}: RecipeVideoCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [draftUrl, setDraftUrl] = useState(youtubeUrl || '')

  const embedUrl = useMemo(() => getYoutubeEmbedUrl(youtubeUrl), [youtubeUrl])
  const draftVideoId = useMemo(() => getYoutubeVideoId(draftUrl), [draftUrl])

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-xl">
      {!embedUrl && !isEditing ? (
        <div className="flex flex-col gap-5">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-500 text-sm font-black text-white">
                ▶
              </div>

              <h2 className="text-2xl font-bold text-white">
                YouTube Tutorial
              </h2>
            </div>

            <p className="mt-4 text-lg leading-relaxed text-slate-300">
              Enhance this recipe with a step-by-step video guide from your
              channel.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="rounded-2xl bg-cyan-400 px-5 py-4 text-base font-bold text-slate-950 shadow-lg"
          >
            🔗 Add Video Link
          </button>
        </div>
      ) : null}

      {isEditing ? (
        <form
          action={async (formData) => {
            await updateRecipeYoutubeUrl(formData)
            setIsEditing(false)
          }}
          className="flex flex-col gap-4"
        >
          <input type="hidden" name="recipeId" value={recipeId} />

          <div>
            <label className="text-sm font-semibold text-slate-200">
              YouTube link
            </label>

            <input
              name="youtubeUrl"
              type="url"
              value={draftUrl}
              onChange={(e) => setDraftUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
            />
          </div>

          {draftVideoId ? (
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-black">
              <div className="relative">
                <img
                  src={`https://img.youtube.com/vi/${draftVideoId}/hqdefault.jpg`}
                  alt="YouTube video preview"
                  className="aspect-video w-full object-cover"
                />

                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500 text-xl font-black text-white shadow-lg">
                    ▶
                  </div>
                </div>
              </div>

              <div className="border-t border-white/10 px-4 py-3">
                <p className="text-sm font-semibold text-white">
                  Preview ready
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  This thumbnail will become the embedded recipe video.
                </p>
              </div>
            </div>
          ) : draftUrl.trim() ? (
            <p className="rounded-2xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-200">
              Paste a valid YouTube link to see the preview.
            </p>
          ) : null}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={!draftVideoId}
              className="flex-1 rounded-2xl bg-cyan-400 px-4 py-3 font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Add Video
            </button>

            <button
              type="button"
              onClick={() => {
                setDraftUrl(youtubeUrl || '')
                setIsEditing(false)
              }}
              className="rounded-2xl border border-white/10 px-4 py-3 font-semibold text-slate-300"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {embedUrl && !isEditing ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-bold text-white">YouTube Tutorial</h2>

            <button
              type="button"
              onClick={() => {
                setDraftUrl(youtubeUrl || '')
                setIsEditing(true)
              }}
              className="text-sm font-semibold text-cyan-300"
            >
              Edit
            </button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/10 bg-black">
            <iframe
              src={embedUrl}
              title="Recipe YouTube tutorial"
              className="aspect-video w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        </div>
      ) : null}
    </section>
  )
}