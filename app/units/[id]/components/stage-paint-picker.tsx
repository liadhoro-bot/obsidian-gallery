'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { addPaintToStage } from '../actions'

type PaintSearchResult = {
  id: string
  source?: 'catalog' | 'custom'
  paint_source?: 'catalog' | 'custom'
  name: string | null
  brand?: string | null
  line?: string | null
  manufacturer?: string | null
  series?: string | null
  hex?: string | null
  hex_approx?: string | null
  color_hex?: string | null
  swatch_image_url?: string | null
}

type Props = {
  unitId: string
  progressStepId: string
}

function getPaintSource(paint: PaintSearchResult): 'catalog' | 'custom' {
  return paint.source || paint.paint_source || 'catalog'
}

function getPaintHex(paint: PaintSearchResult) {
  return paint.hex || paint.hex_approx || paint.color_hex || '#262626'
}

function getPaintMeta(paint: PaintSearchResult) {
  if (getPaintSource(paint) === 'custom') {
    return [paint.manufacturer, paint.series].filter(Boolean).join(' · ')
  }

  return [paint.brand, paint.line].filter(Boolean).join(' · ')
}

export default function StagePaintPicker({
  unitId,
  progressStepId,
}: Props) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [paints, setPaints] = useState<PaintSearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isPending, startTransition] = useTransition()

  const cleanQuery = query.trim()

  useEffect(() => {
    if (!isOpen) return

    let isCancelled = false

    async function loadPaints() {
      setIsLoading(true)

      try {
        const params = new URLSearchParams()

        if (cleanQuery) {
          params.set('q', cleanQuery)
        }

        const response = await fetch(`/api/theme-paint-search?${params.toString()}`)

        if (!response.ok) {
          throw new Error('Failed to search paints')
        }

        const result = await response.json()

        const nextPaints = Array.isArray(result)
          ? result
          : Array.isArray(result.paints)
            ? result.paints
            : Array.isArray(result.results)
              ? result.results
              : []

        if (!isCancelled) {
          setPaints(nextPaints)
        }
      } catch {
        if (!isCancelled) {
          setPaints([])
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    }

    const timeout = setTimeout(loadPaints, 250)

    return () => {
      isCancelled = true
      clearTimeout(timeout)
    }
  }, [isOpen, cleanQuery])

  const visiblePaints = useMemo(() => paints.slice(0, 40), [paints])

  const handleSelectPaint = (paint: PaintSearchResult) => {
    startTransition(async () => {
      const formData = new FormData()

      formData.set('unitId', unitId)
      formData.set('progressStepId', progressStepId)
      formData.set('paintSource', getPaintSource(paint))
      formData.set('paintId', paint.id)

      await addPaintToStage(formData)

      setIsOpen(false)
      setQuery('')
      router.refresh()
    })
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="mt-2 flex w-full items-center justify-between rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-left text-sm text-white/70 transition hover:border-cyan-400/40 hover:bg-cyan-400/10"
      >
        <span>Pick from Paint Library</span>
        <span className="text-cyan-300">+</span>
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 px-4 pb-4 pt-16 backdrop-blur-sm">
          <div className="max-h-[82vh] w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-[#07111b] shadow-[0_0_40px_rgba(34,211,238,0.18)]">
            <div className="border-b border-white/10 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-black text-white">
                    Pick Paints Used
                  </h3>
                  <p className="mt-1 text-xs text-white/45">
                    Search your catalog and custom colors.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-bold text-white/60"
                >
                  ✕
                </button>
              </div>

              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by name, brand, line..."
                className="mt-4 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-400/50"
                autoFocus
              />
            </div>

            <div className="max-h-[58vh] overflow-y-auto p-3">
              {isLoading ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/45">
                  Searching paints...
                </div>
              ) : visiblePaints.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/45">
                  No paints found.
                </div>
              ) : (
                <div className="space-y-2">
                  {visiblePaints.map((paint) => {
                    const source = getPaintSource(paint)
                    const hex = getPaintHex(paint)
                    const meta = getPaintMeta(paint)

                    return (
                      <button
                        key={`${source}-${paint.id}`}
                        type="button"
                        onClick={() => handleSelectPaint(paint)}
                        disabled={isPending}
                        className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 text-left transition hover:border-cyan-400/40 hover:bg-cyan-400/[0.08] disabled:opacity-60"
                      >
                        {paint.swatch_image_url ? (
                          <img
                            src={paint.swatch_image_url}
                            alt={paint.name || 'Paint swatch'}
                            className="h-12 w-12 shrink-0 rounded-xl border border-white/10 object-cover"
                          />
                        ) : (
                          <div
                            className="h-12 w-12 shrink-0 rounded-xl border border-white/10"
                            style={{ backgroundColor: hex }}
                          />
                        )}

                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-black text-white">
                            {paint.name || 'Unnamed paint'}
                          </div>

                          <div className="mt-1 truncate text-xs text-white/40">
                            {meta || (source === 'custom' ? 'Custom paint' : 'Catalog paint')}
                          </div>
                        </div>

                        <div className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-cyan-300">
                          {source}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}