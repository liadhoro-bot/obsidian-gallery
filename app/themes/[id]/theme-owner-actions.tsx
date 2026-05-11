'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { updateTheme } from './actions'
import ThemePaletteEditor from './theme-palette-editor'

type PaintOption = {
  id: string
  source: 'catalog' | 'custom'
  name: string
  brand: string | null
  line: string | null
  sku?: string | null
  swatch_image_url: string | null
  hex: string | null
}

type PaletteSlot = {
  id: string
  paintId: string
  paintSource: 'catalog' | 'custom'
  name: string
  imageUrl: string | null
  hex: string | null
} | null

type Props = {
  themeId: string
  name: string
  description: string | null
  tags: string[]
  isPublic: boolean
  slots: PaletteSlot[]
  paintOptions: PaintOption[]
}

export default function ThemeOwnerActions({
  themeId,
  name,
  description,
  tags,
  slots,
  paintOptions,
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
    <div className="space-y-3 px-4 pt-6">
      <button
        type="button"
        onClick={() => setIsEditing((current) => !current)}
        className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 text-sm font-semibold text-white/75 transition hover:bg-white/[0.07]"
      >
        {isEditing ? 'Close Editor' : 'Edit Theme'}
      </button>

      {isEditing && (
        <form
          action={handleUpdate}
          className="space-y-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4"
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
            <label className="mb-3 block text-sm font-medium text-white">
              Edit Palette
            </label>

            <ThemePaletteEditor
              themeId={themeId}
              isOwner={true}
              slots={slots}
              paintOptions={paintOptions}
              mode="edit"
            />

            <p className="mt-2 text-xs text-white/40">
              Tap a color to replace it.
            </p>
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

          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-xl bg-cyan-500 px-4 py-3 font-semibold text-black disabled:opacity-50"
          >
            {isPending ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      )}
    </div>
  )
}