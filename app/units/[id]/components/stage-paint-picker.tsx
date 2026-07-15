'use client'

import { useState, useTransition } from 'react'
import { addPaintToStage } from '../actions'
import PaintPickerDialog, {
  PaintPickerPaint,
} from '../../../../components/paints/paint-picker-dialog'

type StagePaintResult = Awaited<ReturnType<typeof addPaintToStage>>

type Props = {
  unitId: string
  progressStepId: string
  onPaintAdded?: (stagePaint: NonNullable<StagePaintResult>) => void
  triggerClassName?: string
}

export default function StagePaintPicker({
  unitId,
  progressStepId,
  onPaintAdded,
  triggerClassName,
}: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleSelectPaint = (paint: PaintPickerPaint) => {
    setIsOpen(false)

    startTransition(async () => {
      const formData = new FormData()

      formData.set('unitId', unitId)
      formData.set('progressStepId', progressStepId)
      formData.set('paintSource', paint.source)
      formData.set('paintId', paint.id)

      try {
        const stagePaint = await addPaintToStage(formData)
        if (stagePaint) {
          onPaintAdded?.(stagePaint)
        }
      } catch (error) {
        setIsOpen(true)
        throw error
      }
    })
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={
          triggerClassName ||
          'mt-2 flex w-full items-center justify-between rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-left text-sm text-white/70 transition hover:border-cyan-400/40 hover:bg-cyan-400/10'
        }
      >
        <span>Pick from Paint Library</span>
        <span className="text-cyan-300">+</span>
      </button>

      <PaintPickerDialog
        open={isOpen}
        onOpenChange={setIsOpen}
        title="Pick Paints Used"
        onSelectPaint={handleSelectPaint}
        source="unit_stage_picker"
        disabled={isPending}
      />
    </div>
  )
}
