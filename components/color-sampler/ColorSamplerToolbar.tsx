'use client'

import type { SampledImageColor } from './types'
import SampledColorPreview from './SampledColorPreview'

export default function ColorSamplerToolbar({
  sample,
  canReplace,
  onReplace,
  onConfirm,
}: {
  sample: SampledImageColor | null
  canReplace: boolean
  onReplace: () => void
  onConfirm: () => void
}) {
  return (
    <div className="grid gap-3 md:grid-cols-[1fr_auto]">
      <SampledColorPreview sample={sample} />
      <div className="grid grid-cols-2 gap-2 md:grid-cols-1">
        <button
          type="button"
          onClick={onReplace}
          disabled={!canReplace}
          className="tap-press tap-target rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-white/65 transition hover:border-white/20 hover:text-white disabled:opacity-40"
        >
          Change Image
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={!sample}
          className="tap-press tap-target rounded-2xl border border-cyan-300/30 bg-cyan-300/10 px-5 py-4 text-xs font-black uppercase tracking-[0.16em] text-cyan-100 shadow-[0_0_24px_rgba(34,211,238,0.18)] transition hover:border-cyan-200/60 hover:bg-cyan-300/15 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-white/35 disabled:shadow-none"
        >
          Find Matching Paints
        </button>
      </div>
    </div>
  )
}
