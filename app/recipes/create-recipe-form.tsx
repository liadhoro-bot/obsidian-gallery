'use client'

import Image from 'next/image'
import { useMemo, useRef, useState } from 'react'

export default function CreateRecipeForm() {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const previewName = useMemo(() => {
    return name.trim() || 'Void Stalker Armor'
  }, [name])

  function handleImageChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]

    if (!file) return

    const imageUrl = URL.createObjectURL(file)
    setPreviewImageUrl(imageUrl)
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
        <h2 className="mb-5 text-sm font-bold tracking-[0.22em] text-cyan-300">
          CREATE CUSTOM RECIPE
        </h2>

        <div className="space-y-4">
          <label className="grid gap-2 text-sm text-white">
            Recipe Name
            <input
              name="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Shadow Knight Armor"
              className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none placeholder:text-white/35"
            />
          </label>

          <label className="grid gap-2 text-sm text-white">
            Description
            <textarea
              name="description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Describe the look and use..."
              rows={4}
              className="resize-none rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none placeholder:text-white/35"
            />
          </label>

          <div>
            <p className="mb-2 text-xs font-semibold tracking-[0.18em] text-white/60">
              COVER IMAGE (OPTIONAL)
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={handleImageChange}
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full overflow-hidden rounded-xl border border-dashed border-white/20 bg-black/20 text-center transition hover:border-cyan-400/50 hover:bg-cyan-400/5"
            >
              {previewImageUrl ? (
                <div className="relative aspect-video w-full">
                  <Image
                    src={previewImageUrl}
                    alt="Recipe cover preview"
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
              ) : (
                <div className="px-4 py-6">
                  <div className="text-2xl text-white/70">⇧</div>
                  <p className="mt-2 text-sm text-white">
                    Tap to upload or capture image
                  </p>
                  <p className="mt-1 text-xs text-white/45">
                    PNG, JPG, or WEBP • Max 5MB
                  </p>
                </div>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-cyan-400/40 bg-cyan-400/[0.04] p-4 shadow-[0_0_22px_rgba(34,211,238,0.18)]">
        <h2 className="mb-4 text-sm font-bold tracking-[0.22em] text-cyan-300">
          LIVE PREVIEW
        </h2>

        <div className="flex items-center gap-4 rounded-xl border border-white/10 bg-black/20 p-3">
          <div className="relative h-24 w-24 overflow-hidden rounded-lg bg-white/10">
            {previewImageUrl ? (
              <Image
                src={previewImageUrl}
                alt="Recipe preview"
                fill
                className="object-cover"
                unoptimized
              />
            ) : null}
          </div>

          <div>
            <h3 className="text-lg font-bold text-white">{previewName}</h3>

            <p className="mt-1 text-xs font-bold tracking-wider text-cyan-300">
              CUSTOM RECIPE
            </p>

            <span className="mt-3 inline-flex rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-bold text-cyan-300">
              PREVIEW
            </span>
          </div>
        </div>
      </div>

      <button
        type="button"
        className="w-full rounded-xl bg-cyan-400 px-4 py-4 text-sm font-black tracking-[0.2em] text-black shadow-[0_0_22px_rgba(34,211,238,0.35)]"
      >
        CREATE RECIPE
      </button>
    </div>
  )
}