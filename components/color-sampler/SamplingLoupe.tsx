'use client'

import type { SampledImageColor } from './types'

export default function SamplingLoupe({
  sample,
  pointer,
}: {
  sample: SampledImageColor | null
  pointer: { x: number; y: number } | null
}) {
  if (!sample || !pointer) return null

  const placeLeft = pointer.x > 150
  const placeTop = pointer.y > 150

  return (
    <div
      className="pointer-events-none absolute z-20 grid h-28 w-28 place-items-center rounded-full border-2 border-white bg-slate-950/95 shadow-[0_18px_40px_rgba(0,0,0,0.45)]"
      style={{
        left: placeLeft ? pointer.x - 132 : pointer.x + 24,
        top: placeTop ? pointer.y - 132 : pointer.y + 24,
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
