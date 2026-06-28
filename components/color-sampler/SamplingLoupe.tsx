'use client'

import type { SampledImageColor } from './types'

export default function SamplingLoupe({
  sample,
  pointer,
  containerSize,
}: {
  sample: SampledImageColor | null
  pointer: { x: number; y: number } | null
  containerSize: { width: number; height: number }
}) {
  if (!sample || !pointer) return null

  const loupeSize = 112
  const edgePadding = 12
  const pointerGap = 36

  const preferredLeft = pointer.x - loupeSize - pointerGap
  const preferredTop = pointer.y - loupeSize - pointerGap
  const fallbackLeft = pointer.x + pointerGap
  const fallbackTop = pointer.y + pointerGap
  const maxLeft = Math.max(edgePadding, containerSize.width - loupeSize - edgePadding)
  const maxTop = Math.max(edgePadding, containerSize.height - loupeSize - edgePadding)

  const left =
    preferredLeft >= edgePadding
      ? preferredLeft
      : fallbackLeft + loupeSize <= containerSize.width - edgePadding
        ? fallbackLeft
        : Math.min(Math.max(pointer.x - loupeSize / 2, edgePadding), maxLeft)

  const top =
    preferredTop >= edgePadding
      ? preferredTop
      : fallbackTop + loupeSize <= containerSize.height - edgePadding
        ? fallbackTop
        : Math.min(Math.max(pointer.y - loupeSize / 2, edgePadding), maxTop)

  return (
    <div
      className="pointer-events-none absolute z-20 grid h-28 w-28 place-items-center rounded-full border-2 border-white bg-slate-950/95 shadow-[0_18px_40px_rgba(0,0,0,0.45)]"
      style={{
        left,
        top,
      }}
      aria-hidden="true"
    >
      <div
        className="h-20 w-20 rounded-full border border-white/20"
        style={{
          backgroundColor: sample.hex,
          boxShadow: `inset 0 0 0 16px ${sample.hex}`,
        }}
      />
      <span className="absolute left-1/2 top-3 h-[88px] w-px -translate-x-1/2 bg-white/80" />
      <span className="absolute left-3 top-1/2 h-px w-[88px] -translate-y-1/2 bg-white/80" />
      <span className="absolute bottom-3 rounded bg-black/60 px-2 py-0.5 font-mono text-[10px] font-black text-white">
        {sample.hex}
      </span>
    </div>
  )
}
