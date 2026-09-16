'use client'

import Image from 'next/image'
import { useState, useTransition } from 'react'
import PaintPickerDialog, {
  type PaintPickerPaint,
} from '../../../components/paints/paint-picker-dialog'
import { setProjectPaletteSlot } from './actions'
import { setUnitPaletteSlot } from '../../units/[id]/actions'
import styles from './project-detail-silver.module.css'

type PaintOption = PaintPickerPaint

type Props = {
  projectId?: string
  unitId?: string
  slotIndex?: number
  initialPaint?: PaintOption | null
}

export default function ProjectPaletteStarter({
  projectId,
  unitId,
  slotIndex,
  initialPaint = null,
}: Props) {
  const [activeSlot, setActiveSlot] = useState<number | null>(null)
  const [selectedPaints, setSelectedPaints] = useState<Record<number, PaintOption>>({})
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function closePicker() {
    setActiveSlot(null)  }

  function choosePaint(paint: PaintOption) {
    if (activeSlot === null) return

    const slot = activeSlot
    const previousPaints = selectedPaints

    setError('')
    setSelectedPaints((current) => ({ ...current, [slot]: paint }))
    closePicker()

    startTransition(async () => {
      try {
        if (unitId) {
          await setUnitPaletteSlot(unitId, slot, paint.source, paint.id)
        } else if (projectId) {
          await setProjectPaletteSlot(projectId, slot, paint.source, paint.id)
        }
      } catch (slotError) {
        setSelectedPaints(previousPaints)
        setError(
          slotError instanceof Error
            ? slotError.message
            : 'Could not update palette.'
        )
      }
    })
  }

  return (
    <>
      <div className={slotIndex === undefined ? 'grid grid-cols-5 gap-2' : ''}>
        {Array.from({ length: slotIndex === undefined ? 5 : 1 }).map(
          (_, localIndex) => {
            const index = slotIndex ?? localIndex
            const selectedPaint = selectedPaints[index] ?? initialPaint

            return (
              <button
                key={index}
                type="button"
                disabled={isPending}
                aria-label={`Choose palette color ${index + 1}`}
                onClick={() => {
                  setActiveSlot(index)                }}
                className={`${styles.secondaryAction} flex aspect-square w-full min-w-0 items-center justify-center text-lg font-semibold transition active:scale-95`}
              >
                {selectedPaint ? (
                  selectedPaint.swatch_image_url ? (
                    <Image
                      src={selectedPaint.swatch_image_url}
                      alt={selectedPaint.name || 'Paint swatch'}
                      width={96}
                      height={96}
                      sizes="64px"
                      className="h-full w-full rounded-xl object-cover"
                    />
                  ) : (
                    <span
                      className="h-full w-full rounded-xl"
                      style={{ backgroundColor: selectedPaint.hex || '#262626' }}
                    />
                  )
                ) : (
                  '+'
                )}
              </button>
            )
          }
        )}
      </div>
      {error ? <p className="mt-2 text-xs text-red-300">{error}</p> : null}

      <PaintPickerDialog
        open={activeSlot !== null}
        onOpenChange={(open) => {
          if (!open) closePicker()
        }}
        title={activeSlot === null ? 'Choose Paint' : `Choose Color ${activeSlot + 1}`}
        selectedPaint={
          activeSlot === null ? null : selectedPaints[activeSlot] ?? initialPaint
        }
        onSelectPaint={choosePaint}
        source={unitId ? 'unit_palette_picker' : 'project_palette_picker'}
        disabled={isPending}
      />
    </>
  )
}
