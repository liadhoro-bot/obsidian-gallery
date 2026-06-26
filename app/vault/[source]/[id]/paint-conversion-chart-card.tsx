import PaintConversionChartLoader from './paint-conversion-chart-loader'

type PaintRef = {
  source: 'catalog' | 'custom'
  paintId: string
  userId: string
}

export default async function PaintConversionChartCard({
  paintRef,
}: {
  paintRef: PaintRef
}) {
  if (paintRef.source === 'custom') {
    return null
  }

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

      <PaintConversionChartLoader paintId={paintRef.paintId} />
    </section>
  )
}
