'use client'

import { useState } from 'react'
import PaintPicker from './paint-picker'
import { Paint, StepPaintLink } from './types'

function getPaintSelectValue(
  paint: StepPaintLink['paint'] | null | undefined,
  paints: Paint[]
) {
  if (!paint) return ''

  const matchedPaint = paints.find((p) => p.id === paint.id)
  if (!matchedPaint) return ''

  return `${matchedPaint.source}:${matchedPaint.id}`
}

type Props = {
  paints: Paint[]
  existingPaints?: StepPaintLink[]
  keyPrefix: string
}

export default function StepPaintFields({
  paints,
  existingPaints = [],
  keyPrefix,
}: Props) {
  const [visiblePaints, setVisiblePaints] = useState(0)

  function addPaint() {
    setVisiblePaints((current) => Math.min(current + 1, 3))
  }

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3">
      {existingPaints.slice(visiblePaints, 3).map((existingPaint, index) => {
        const paintNumber = visiblePaints + index + 1
        const defaultValue = getPaintSelectValue(existingPaint.paint, paints)

        return defaultValue ? (
          <div key={`folded-${paintNumber}`}>
            <input
              type="hidden"
              name={`paintId${paintNumber}`}
              value={defaultValue}
              readOnly
            />
            <input
              type="hidden"
              name={`ratio${paintNumber}`}
              value={existingPaint.ratio_text || ''}
              readOnly
            />
          </div>
        ) : null
      })}

      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-white">Paints</p>
        </div>

        {visiblePaints === 0 ? (
          <button
            type="button"
            onClick={addPaint}
            className="shrink-0 rounded-xl border border-cyan-400/40 bg-cyan-400/10 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-cyan-200 transition hover:bg-cyan-400/20 active:scale-[0.98] active:opacity-70"
          >
            + Add Paint
          </button>
        ) : null}
      </div>

      {visiblePaints > 0 ? (
        <div className="mt-3 space-y-3">
          {Array.from({ length: visiblePaints }).map((_, index) => {
            const paintNumber = index + 1
            const existingPaint = existingPaints[index]
            const defaultValue = getPaintSelectValue(
              existingPaint?.paint,
              paints
            )
            const isLastVisiblePaint = paintNumber === visiblePaints
            const canAddAnotherPaint = visiblePaints < 3

            return (
              <div key={paintNumber} className="space-y-3">
                <div className="rounded-xl border border-white/10 bg-black p-4">
                  <p className="text-sm font-medium text-white">
                    Paint {paintNumber}
                  </p>

                  <div className="mt-3 space-y-3">
                    <PaintPicker
                      key={`${keyPrefix}-paint${paintNumber}-${defaultValue}`}
                      name={`paintId${paintNumber}`}
                      paints={paints}
                      defaultValue={defaultValue}
                    />

                    <input
                      name={`ratio${paintNumber}`}
                      type="text"
                      defaultValue={existingPaint?.ratio_text || ''}
                      placeholder="Optional ratio"
                      className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-white"
                    />
                  </div>
                </div>

                {isLastVisiblePaint && canAddAnotherPaint ? (
                  <button
                    type="button"
                    onClick={addPaint}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-xs font-black uppercase tracking-[0.14em] text-white/70 transition hover:border-cyan-400/40 hover:bg-cyan-400/10 hover:text-cyan-200 active:scale-[0.98] active:opacity-70"
                  >
                    + Add Another Paint
                  </button>
                ) : null}
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
