import { createServiceRoleClient } from '../../../../utils/supabase/service-role'
import {
  getSimilarPaints,
  type SimilarPaintResult,
} from '../../../../utils/paint-conversions'
import PaintConversionChartGrid from './paint-conversion-chart-grid'

type PaintRef = {
  source: 'catalog' | 'custom'
  paintId: string
  userId: string
}

function mergeUniquePaints(groups: SimilarPaintResult[][], limit: number) {
  const seen = new Set<string>()
  const merged: SimilarPaintResult[] = []

  for (const group of groups) {
    for (const paint of group) {
      if (seen.has(paint.id)) continue

      seen.add(paint.id)
      merged.push(paint)

      if (merged.length >= limit) return merged
    }
  }

  return merged
}

export default async function PaintConversionChartCard({
  paintRef,
}: {
  paintRef: PaintRef
}) {
  if (paintRef.source === 'custom') {
    return null
  }

  const supabase = createServiceRoleClient()
  const chartPaints = await getSimilarPaints(supabase, paintRef.paintId, {
    limit: 9,
    officialOnly: true,
    includeLooseMatches: true,
    userId: paintRef.userId,
  })
  const colorPaints =
    chartPaints.length < 9
      ? await getSimilarPaints(supabase, paintRef.paintId, {
          limit: Math.max(18, 9 - chartPaints.length),
          hexOnly: true,
          includeLooseMatches: true,
          userId: paintRef.userId,
        })
      : []
  const conversionPaints = mergeUniquePaints([chartPaints, colorPaints], 9)

  return (
    <section className="space-y-5 rounded-2xl bg-slate-900/80 p-6 shadow-lg">
      <div>
        <h2 className="text-xs font-black uppercase tracking-[0.3em] text-cyan-300">
          Paint Conversion Chart
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Pre-indexed chart and color equivalencies
        </p>
      </div>

      {conversionPaints.length > 0 ? (
        <PaintConversionChartGrid initialPaints={conversionPaints} />
      ) : (
        <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/70 p-5 text-sm text-slate-400">
          No pre-indexed equivalencies found for this paint yet.
        </div>
      )}
    </section>
  )
}
