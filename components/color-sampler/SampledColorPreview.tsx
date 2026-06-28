'use client'

import type { SampledImageColor } from './types'

export default function SampledColorPreview({
  sample,
}: {
  sample: SampledImageColor | null
}) {
  return (
    <div className="grid grid-cols-[56px_1fr] gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
      <div
        className="h-14 rounded-xl border border-white/15 bg-slate-900"
        style={{ backgroundColor: sample?.hex || undefined }}
        aria-hidden="true"
      />
      <div className="flex min-w-0 flex-col justify-center">
        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-white/40">
          Sampled color
        </p>
        <p className="mt-1 font-mono text-lg font-black uppercase text-white">
          {sample?.hex || 'No sample'}
        </p>
        {sample ? (
          <p className="mt-0.5 text-xs text-white/45">
            RGB {sample.rgb.r}, {sample.rgb.g}, {sample.rgb.b}
          </p>
        ) : (
          <p className="mt-0.5 text-xs text-white/45">
            Tap or drag over the image.
          </p>
        )}
      </div>
    </div>
  )
}
