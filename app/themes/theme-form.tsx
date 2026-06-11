'use client'

import { useState } from 'react'
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

  function choosePaint(paint: PaintPickerPaint) {
    if (activeSlot === null) return

    setSelectedPaints((current) =>
      current.map((item, index) =>
        index === activeSlot ? (paint as PaintOption) : item
      )
    )
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
          required
          className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-white outline-none"
          placeholder="Ghostly Ether"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-white">
          Hero Image
        </label>

        <input
          type="file"
          name="image"
          accept="image/*"
          className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/70"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-white">
          Description
        </label>

        <textarea
          name="description"
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

      <button
        type="submit"
        className="w-full rounded-xl bg-cyan-500 px-4 py-3 font-semibold text-black transition hover:bg-cyan-400"
      >
        Create Theme
      </button>
    </form>
  )
}
