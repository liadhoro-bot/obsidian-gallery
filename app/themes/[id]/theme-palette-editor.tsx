'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState, useTransition } from 'react'
import { setThemePaintSlot } from './actions'
import PaintPickerDialog, {
  PaintPickerPaint,
} from '../../../components/paints/paint-picker-dialog'

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

type PaletteSlot = {
  id: string
  paintId: string
  paintSource: 'catalog' | 'custom'
  name: string
  imageUrl: string | null
  hex: string | null
} | null

export default function ThemePaletteEditor({
  themeId,
  isOwner,
  slots,
  paintOptions,
  mode = 'display',
}: {
  themeId: string
  isOwner: boolean
  slots: PaletteSlot[]
  paintOptions: PaintOption[]
  mode?: 'display' | 'edit'
}) {
  const [activeSlot, setActiveSlot] = useState<number | null>(null)
  const [localSlots, setLocalSlots] = useState(slots)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    setLocalSlots(slots)
  }, [slots])

  function openPicker(index: number) {
    if (!isOwner) return

    setActiveSlot(index)
  }

  function closePicker() {
    setActiveSlot(null)
  }

  function choosePaint(paint: PaintPickerPaint) {
    if (activeSlot === null) return

    const slotIndex = activeSlot
    const previousSlots = localSlots
    const optimisticSlot: NonNullable<PaletteSlot> = {
      id: localSlots[slotIndex]?.id || `optimistic-${slotIndex}`,
      paintId: paint.id,
      paintSource: paint.source,
      name: paint.name || 'Unnamed paint',
      imageUrl: paint.swatch_image_url,
      hex: paint.hex || paint.hex_approx || null,
    }

    setError('')
    setLocalSlots((current) =>
      current.map((slot, index) => (index === slotIndex ? optimisticSlot : slot))
    )
    closePicker()

    startTransition(async () => {
      try {
        await setThemePaintSlot(themeId, slotIndex, paint.source, paint.id)
      } catch (slotError) {
        setLocalSlots(previousSlots)
        setError(
          slotError instanceof Error
            ? slotError.message
            : 'Could not update palette.'
        )
      }
    })
  }

  function renderSwatch(slot: PaletteSlot) {
    return (
      <>
        <div className="relative aspect-square overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
          {slot?.imageUrl ? (
            <Image
              src={slot.imageUrl}
              alt={slot.name}
              fill
              sizes="20vw"
              className="object-cover"
            />
          ) : slot?.hex ? (
            <div
              className="h-full w-full"
              style={{ backgroundColor: slot.hex }}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-3xl font-light text-white/25">
              +
            </div>
          )}
        </div>

        <p className="line-clamp-2 text-center text-[10px] leading-tight text-white/50">
          {slot?.name || 'Empty'}
        </p>
      </>
    )
  }

  return (
    <>
      <div className="grid grid-cols-5 gap-2">
        {localSlots.map((slot, index) => {
          if (!slot || mode === 'edit') {
            return (
              <button
                key={slot?.id || index}
                type="button"
                disabled={!isOwner}
                onClick={() => openPicker(index)}
                className="space-y-2 disabled:cursor-default"
              >
                {renderSwatch(slot)}
              </button>
            )
          }

          const href =
            slot.paintSource === 'catalog'
              ? `/vault/catalog/${slot.paintId}`
              : `/vault/custom/${slot.paintId}`

          return (
            <Link key={slot.id} href={href} className="space-y-2">
              {renderSwatch(slot)}
            </Link>
          )
        })}
      </div>

      <PaintPickerDialog
        open={activeSlot !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) closePicker()
        }}
        title={
          activeSlot === null ? 'Choose Paint' : `Choose Color ${activeSlot + 1}`
        }
        selectedPaintId={
          activeSlot === null
            ? null
            : localSlots[activeSlot]
              ? `${localSlots[activeSlot]?.paintSource}:${localSlots[activeSlot]?.paintId}`
              : null
        }
        onSelectPaint={choosePaint}
        source="theme_picker"
        initialPaints={paintOptions}
        disabled={isPending}
      />
      {error ? <p className="mt-2 text-xs text-red-300">{error}</p> : null}
    </>
  )
}
