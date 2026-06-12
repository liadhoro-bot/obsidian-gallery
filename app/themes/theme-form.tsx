'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import { createTheme } from './actions'
import PaintPickerDialog, {
  PaintPickerPaint,
} from '../../components/paints/paint-picker-dialog'

type PaintOption = PaintPickerPaint & {
  id: string
  source: 'catalog' | 'custom'
  name: string
  brand: string | null
  line: string | null
  sku?: string | null
  swatch_image_url: string | null
  hex: string | null
}

export default function ThemeForm({
  paints,
}: {
  paints: PaintOption[]
}) {
  const [selectedPaints, setSelectedPaints] = useState<(PaintOption | null)[]>(
    [null, null, null, null, null]
  )
  const [activeSlot, setActiveSlot] = useState<number | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  const previewName = useMemo(() => name.trim() || 'Ghostly Ether', [name])
  const previewDescription = useMemo(
    () =>
      description.trim() ||
      'A custom palette with reference art, paint swatches, and project-ready mood.',
    [description]
  )

  function choosePaint(paint: PaintPickerPaint) {
    if (activeSlot === null) return

    setSelectedPaints((current) =>
      current.map((item, index) =>
        index === activeSlot ? (paint as PaintOption) : item
      )
    )
  }

  function handleImageChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]

    setImagePreview(file ? URL.createObjectURL(file) : null)
  }

  return (
    <form action={createTheme} className="space-y-5">
      <div>
        <label className="mb-2 block text-sm font-medium text-white">
          Theme Name
        </label>

        <input
          type="text"
          name="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-white outline-none"
          placeholder="Ghostly Ether"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-white">
          Hero Image
        </label>

        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-white/10 bg-white/[0.03] p-3 transition hover:border-cyan-400/50">
          <span className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white/[0.06] text-2xl text-white/45">
            {imagePreview ? (
              <Image
                src={imagePreview}
                alt=""
                fill
                className="object-cover"
                unoptimized
              />
            ) : (
              '+'
            )}
          </span>
          <span className="min-w-0 text-sm text-white/55">
            Upload a hero image to anchor this theme preview.
          </span>
          <input
            type="file"
            name="image"
            accept="image/*"
            onChange={handleImageChange}
            className="sr-only"
          />
        </label>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-white">
          Description
        </label>

        <textarea
          name="description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={4}
          className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-white outline-none"
          placeholder="Describe the theme..."
        />
      </div>

      <div>
        <label className="mb-3 block text-sm font-medium text-white">
          Palette Colors
        </label>

        <div className="grid grid-cols-5 gap-2">
          {selectedPaints.map((paint, index) => (
            <button
              key={index}
              type="button"
              onClick={() => setActiveSlot(index)}
              className="relative aspect-square overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]"
            >
              {paint?.swatch_image_url ? (
                <Image
                  src={paint.swatch_image_url}
                  alt={paint.name}
                  fill
                  className="object-cover"
                />
              ) : paint?.hex ? (
                <div
                  className="h-full w-full"
                  style={{ backgroundColor: paint.hex }}
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-2xl text-white/50">
                  +
                </span>
              )}

              <input
                type="hidden"
                name={`paint_source_${index}`}
                value={paint?.source || ''}
              />
              <input
                type="hidden"
                name={`paint_id_${index}`}
                value={paint?.id || ''}
              />
            </button>
          ))}
        </div>
      </div>

      <PaintPickerDialog
        open={activeSlot !== null}
        onOpenChange={(isOpen) => setActiveSlot(isOpen ? activeSlot : null)}
        title={
          activeSlot === null ? 'Choose Paint' : `Choose Color ${activeSlot + 1}`
        }
        selectedPaint={activeSlot === null ? null : selectedPaints[activeSlot]}
        onSelectPaint={choosePaint}
        source="theme_picker"
        initialPaints={paints}
      />

      <div>
        <label className="mb-2 block text-sm font-medium text-white">
          Tags
        </label>

        <input
          type="text"
          name="tags"
          className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-white outline-none"
          placeholder="nighthaunt, spectral, glowing"
        />
      </div>

      <div className="space-y-3">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
          Live Preview
        </p>

        <div className="relative overflow-hidden rounded-2xl border border-cyan-400/25 bg-[#061018] p-4">
          <div className="absolute inset-0">
            {imagePreview ? (
              <Image
                src={imagePreview}
                alt=""
                fill
                className="object-cover opacity-55"
                unoptimized
              />
            ) : null}

            <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-black/20" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(34,211,238,0.16),transparent_34%)]" />
          </div>

          <div
            className="absolute top-4 z-20 flex flex-col gap-1 rounded-full border border-white/10 bg-black/35 p-1.5 backdrop-blur"
            style={{ right: '1rem', left: 'auto' }}
          >
            {selectedPaints.map((paint, index) => (
              <div
                key={paint?.id || index}
                className="relative h-7 w-7 overflow-hidden rounded-md border border-white/20 bg-white/10 shadow-sm"
              >
                {paint?.swatch_image_url ? (
                  <Image
                    src={paint.swatch_image_url}
                    alt={paint.name}
                    fill
                    className="object-cover"
                  />
                ) : paint?.hex ? (
                  <div
                    className="h-full w-full"
                    style={{ backgroundColor: paint.hex }}
                  />
                ) : null}
              </div>
            ))}
          </div>

          <div className="relative min-h-40 pr-16">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">
              Theme Preview
            </p>
            <h3 className="mt-2 max-w-[260px] text-2xl font-black leading-tight text-white">
              {previewName}
            </h3>
            <p className="mt-2 max-w-[280px] text-sm leading-6 text-white/65">
              {previewDescription}
            </p>

            <div className="mt-5 grid gap-2">
              <div className="rounded-xl border border-white/10 bg-black/35 px-3 py-2">
                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/35">
                  Visibility
                </p>
                <p className="mt-1 text-sm font-black text-white">Private</p>
              </div>
            </div>

            <div className="sr-only">
              {selectedPaints.map((paint, index) => (
                <span key={paint?.id || index}>{paint?.name || 'Empty'}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <button
        type="submit"
        className="w-full rounded-xl bg-cyan-500 px-4 py-3 font-semibold text-black transition hover:bg-cyan-400"
      >
        Create Theme
      </button>
    </form>
  )
}
