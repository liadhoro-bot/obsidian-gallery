'use client'

import { useEffect, useState } from 'react'
import PaintConversionChartGrid from './paint-conversion-chart-grid'
import type { SimilarPaintResult } from '../../../../utils/paint-conversions'

export default function PaintConversionChartLoader({
  paintId,
}: {
  paintId: string
}) {
  const [paints, setPaints] = useState<SimilarPaintResult[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    let isMounted = true

    async function loadEquivalencies() {
      setIsLoading(true)
      setHasError(false)

      try {
        const response = await fetch(
          `/api/vault/paint-equivalencies?paintId=${encodeURIComponent(
            paintId
          )}&limit=9&minimum=3&v=${Date.now()}`,
          {
            cache: 'no-store',
            headers: {
              Accept: 'application/json',
            },
          }
        )

        if (!response.ok) throw new Error('Failed to load paint equivalencies')

        const payload = (await response.json()) as {
          paints?: SimilarPaintResult[]
        }

        if (isMounted) {
          setPaints(payload.paints || [])
        }
      } catch {
        if (isMounted) {
          setHasError(true)
          setPaints([])
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadEquivalencies()

    return () => {
      isMounted = false
    }
  }, [paintId])

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/70 p-5 text-sm text-slate-400">
        Loading paint equivalencies...
      </div>
    )
  }

  if (hasError) {
    return (
      <div className="rounded-2xl border border-dashed border-red-400/20 bg-red-950/20 p-5 text-sm text-red-100">
        Paint equivalencies could not be loaded.
      </div>
    )
  }

  if (paints.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/70 p-5 text-sm text-slate-400">
        No paint equivalencies found for this paint yet.
      </div>
    )
  }

  return <PaintConversionChartGrid initialPaints={paints} />
}
