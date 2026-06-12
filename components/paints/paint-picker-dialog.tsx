'use client'

import Image from 'next/image'
import type { KeyboardEvent, MouseEvent } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import posthog from 'posthog-js'

export type PaintPickerPaint = {
  id: string
  source: 'catalog' | 'custom'
  name: string | null
  brand: string | null
  line: string | null
  sku?: string | null
  paint_type?: string | null
  swatch_image_url: string | null
  hex?: string | null
  hex_approx?: string | null
  is_owned?: boolean
  is_wishlist?: boolean
}

type OwnershipFilter = 'all' | 'owned' | 'wishlist' | 'unowned'

const COLOR_GROUP_OPTIONS = [
  'Blacks & Greys',
  'Whites',
  'Browns',
  'Reds',
  'Oranges',
  'Yellows',
  'Greens',
  'Blues',
  'Purples',
  'Flesh Tones',
  'Metallics',
  'Auxiliary',
]

function getPaintColorGroup(paint: PaintPickerPaint) {
  const text = [
    paint.name,
    paint.brand,
    paint.line,
    paint.sku,
    paint.paint_type,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  if (/metal|steel|silver|gold|brass|bronze|copper|iron|gunmetal/.test(text)) {
    return 'Metallics'
  }

  if (/skin|flesh|fair|tan|khaki|bone|ivory/.test(text)) {
    return 'Flesh Tones'
  }

  if (/black|grey|gray|charcoal|slate|ash|smoke/.test(text)) {
    return 'Blacks & Greys'
  }

  if (/white|cream|offwhite|off-white|pale sand/.test(text)) {
    return 'Whites'
  }

  if (/brown|umber|sienna|leather|wood|earth|sepia|chestnut/.test(text)) {
    return 'Browns'
  }

  if (/red|scarlet|crimson|burgundy|magenta|pink|rose/.test(text)) {
    return 'Reds'
  }

  if (/orange|amber|ochre|rust/.test(text)) {
    return 'Oranges'
  }

  if (/yellow|sun|lemon|dorn|yriel/.test(text)) {
    return 'Yellows'
  }

  if (/green|olive|emerald|moot|caliban|warpstone/.test(text)) {
    return 'Greens'
  }

  if (/blue|cyan|turquoise|teal|navy|azure|sotek/.test(text)) {
    return 'Blues'
  }

  if (/purple|violet|lavender|lilac|plum/.test(text)) {
    return 'Purples'
  }

  return 'Auxiliary'
}

type PaintPickerDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  selectedPaintId?: string | null
  selectedPaint?: PaintPickerPaint | null
  onSelectPaint?: (paint: PaintPickerPaint) => void
  userId?: string
  source?: string
  initialPaints?: PaintPickerPaint[]
  disabled?: boolean
  mode?: 'select' | 'collection'
}

function getPaintKey(paint: Pick<PaintPickerPaint, 'source' | 'id'>) {
  return `${paint.source}:${paint.id}`
}

function getPaintHex(paint: PaintPickerPaint) {
  return paint.hex || paint.hex_approx || '#1f2937'
}

function normalizePaint(paint: PaintPickerPaint): PaintPickerPaint {
  return {
    ...paint,
    name: paint.name || 'Unnamed paint',
    source: paint.source || 'catalog',
    hex: paint.hex || paint.hex_approx || null,
    hex_approx: paint.hex_approx || paint.hex || null,
    is_owned: paint.source === 'custom' ? true : Boolean(paint.is_owned),
    is_wishlist: Boolean(paint.is_wishlist),
  }
}

function filterInitialPaints(
  paints: PaintPickerPaint[],
  query: string,
  brand: string,
  line: string,
  colorGroup: string,
  ownership: OwnershipFilter
) {
  const q = query.trim().toLowerCase()

  return paints
    .map(normalizePaint)
    .filter((paint) => {
      const haystack = [
        paint.name,
        paint.brand,
        paint.line,
        paint.sku,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      const matchesSearch = !q || haystack.includes(q)
      const matchesBrand = !brand || paint.brand === brand
      const matchesLine = !line || paint.line === line
      const matchesColorGroup =
        !colorGroup || getPaintColorGroup(paint) === colorGroup
      const matchesOwnership =
        ownership === 'all' ||
        (ownership === 'owned' && paint.is_owned) ||
        (ownership === 'wishlist' && paint.is_wishlist) ||
        (ownership === 'unowned' && !paint.is_owned)

      return (
        matchesSearch &&
        matchesBrand &&
        matchesLine &&
        matchesColorGroup &&
        matchesOwnership
      )
    })
    .sort((a, b) => {
      return (
        (a.brand || '').localeCompare(b.brand || '') ||
        (a.line || '').localeCompare(b.line || '') ||
        (a.name || '').localeCompare(b.name || '')
      )
    })
}

export default function PaintPickerDialog({
  open,
  onOpenChange,
  title = 'Choose Paint',
  selectedPaintId,
  selectedPaint,
  onSelectPaint,
  source = 'paint_picker',
  initialPaints = [],
  disabled = false,
  mode = 'select',
}: PaintPickerDialogProps) {
  const [query, setQuery] = useState('')
  const [brand, setBrand] = useState('')
  const [line, setLine] = useState('')
  const [colorGroup, setColorGroup] = useState('')
  const [ownership, setOwnership] = useState<OwnershipFilter>('all')
  const [paints, setPaints] = useState<PaintPickerPaint[]>(
    initialPaints.map(normalizePaint)
  )
  const [brands, setBrands] = useState<string[]>([])
  const [lines, setLines] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingOwnedIds, setPendingOwnedIds] = useState<Set<string>>(new Set())

  const fallbackBrands = useMemo(
    () =>
      Array.from(
        new Set(
          initialPaints
            .map((paint) => paint.brand)
            .filter((value): value is string => Boolean(value))
        )
      ).sort((a, b) => a.localeCompare(b)),
    [initialPaints]
  )

  const fallbackLines = useMemo(
    () =>
      Array.from(
        new Set(
          initialPaints
            .filter((paint) => !brand || paint.brand === brand)
            .map((paint) => paint.line)
            .filter((value): value is string => Boolean(value))
        )
      ).sort((a, b) => a.localeCompare(b)),
    [brand, initialPaints]
  )

  const visiblePaints = useMemo(() => {
    const sourcePaints = error && paints.length === 0 ? initialPaints : paints

    return filterInitialPaints(
      sourcePaints,
      query,
      brand,
      line,
      colorGroup,
      ownership
    )
  }, [brand, colorGroup, error, initialPaints, line, ownership, paints, query])

  const activeBrands = brands.length > 0 ? brands : fallbackBrands
  const visibleResultLines = useMemo(
    () =>
      Array.from(
        new Set(
          filterInitialPaints(paints, query, brand, '', colorGroup, ownership)
            .map((paint) => paint.line)
            .filter((value): value is string => Boolean(value))
        )
      ),
    [brand, colorGroup, ownership, paints, query]
  )
  const activeLines = useMemo(
    () =>
      Array.from(
        new Set([
          ...(lines.length > 0 ? lines : fallbackLines),
          ...visibleResultLines,
          ...(line ? [line] : []),
        ])
      ).sort((a, b) => a.localeCompare(b)),
    [fallbackLines, line, lines, visibleResultLines]
  )

  const selectedKey =
    selectedPaint?.id && selectedPaint.source
      ? getPaintKey(selectedPaint)
      : selectedPaintId || ''
  const isCollectionMode = mode === 'collection'

  const capture = useCallback(
    (event: string, properties: Record<string, unknown> = {}) => {
      posthog.capture(event, {
        context: source,
        source,
        brand: brand || null,
        line: line || null,
        color_group: colorGroup || null,
        ownership_filter: ownership,
        ...properties,
      })
    },
    [brand, colorGroup, line, ownership, source]
  )

  useEffect(() => {
    if (!open) return

    capture('paint_picker_opened')
  }, [capture, open])

  useEffect(() => {
    if (!open) return

    const controller = new AbortController()

    async function loadPaints() {
      setLoading(true)
      setError(null)

      try {
        const params = new URLSearchParams()
        params.set('limit', '100')
        params.set('includeFilters', 'true')
        params.set('ownership', ownership)

        if (query.trim()) params.set('q', query.trim())
        if (brand) params.set('brand', brand)
        if (line) params.set('line', line)
        if (colorGroup) params.set('colorGroup', colorGroup)

        const response = await fetch(`/api/theme-paint-search?${params}`, {
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error('Paint search failed')
        }

        const result = await response.json()
        const resultPaints = Array.isArray(result.paints) ? result.paints : []
        setPaints(resultPaints.map(normalizePaint))
        setBrands(Array.isArray(result.filters?.brands) ? result.filters.brands : [])
        setLines(Array.isArray(result.filters?.lines) ? result.filters.lines : [])
      } catch (fetchError) {
        if (controller.signal.aborted) return

        console.error(fetchError)
        setError('Could not load paints. Try again in a moment.')
        setPaints(
          filterInitialPaints(
            initialPaints,
            query,
            brand,
            line,
            colorGroup,
            ownership
          )
        )
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    const timeout = window.setTimeout(loadPaints, 250)

    return () => {
      controller.abort()
      window.clearTimeout(timeout)
    }
  }, [brand, colorGroup, initialPaints, line, open, ownership, query])

  function closeDialog() {
    onOpenChange(false)
  }

  function updateFilter(
    key: 'query' | 'brand' | 'line' | 'colorGroup' | 'ownership',
    value: string
  ) {
    if (key === 'query') setQuery(value)
    if (key === 'brand') {
      setBrand(value)
      setLine('')
    }
    if (key === 'line') setLine(value)
    if (key === 'colorGroup') setColorGroup(value)
    if (key === 'ownership') setOwnership(value as OwnershipFilter)

    capture('paint_picker_filter_changed', {
      changed_filter: key,
      filter_value: value || null,
    })
  }

  async function toggleOwned(
    event: MouseEvent<HTMLButtonElement>,
    paint: PaintPickerPaint
  ) {
    event.stopPropagation()
    event.preventDefault()

    if (paint.source !== 'catalog' || pendingOwnedIds.has(paint.id)) return

    const previousOwned = Boolean(paint.is_owned)
    const previousWishlist = Boolean(paint.is_wishlist)

    setPendingOwnedIds((current) => new Set(current).add(paint.id))
    setPaints((current) =>
      current.map((item) =>
        item.source === 'catalog' && item.id === paint.id
          ? { ...item, is_owned: !previousOwned, is_wishlist: previousWishlist }
          : item
      )
    )

    try {
      const response = await fetch('/api/vault/ownership', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paintId: paint.id,
          action: 'owned',
          currentValue: previousOwned,
        }),
      })

      if (!response.ok) {
        throw new Error('Ownership update failed')
      }

      capture('paint_picker_owned_toggled', {
        paint_id: paint.id,
        paint_source: paint.source,
        paint_name: paint.name,
        is_owned: !previousOwned,
      })
    } catch (toggleError) {
      console.error(toggleError)
      setPaints((current) =>
        current.map((item) =>
          item.source === 'catalog' && item.id === paint.id
            ? {
                ...item,
                is_owned: previousOwned,
                is_wishlist: previousWishlist,
              }
            : item
        )
      )
      setError('Could not update ownership.')
    } finally {
      setPendingOwnedIds((current) => {
        const next = new Set(current)
        next.delete(paint.id)
        return next
      })
    }
  }

  function selectPaint(paint: PaintPickerPaint) {
    if (disabled || isCollectionMode || !onSelectPaint) return

    capture('paint_picker_paint_selected', {
      paint_id: paint.id,
      paint_source: paint.source,
      paint_name: paint.name,
      is_owned: Boolean(paint.is_owned),
      is_wishlist: Boolean(paint.is_wishlist),
    })

    onSelectPaint(paint)
    closeDialog()
  }

  function selectPaintFromKeyboard(
    event: KeyboardEvent<HTMLDivElement>,
    paint: PaintPickerPaint
  ) {
    if (event.key !== 'Enter' && event.key !== ' ') return

    event.preventDefault()
    selectPaint(paint)
  }

  if (!open) return null

  return (
    <div
      className="mobile-sheet-overlay fixed inset-0 z-50 flex justify-center bg-black/75 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={closeDialog}
    >
      <div
        className="mobile-sheet max-w-lg rounded-3xl border border-white/10 bg-[#07111b] shadow-[0_0_42px_rgba(34,211,238,0.18)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-white/10 p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-black text-white">{title}</h3>

            <button
              type="button"
              onClick={closeDialog}
              className="tap-press mobile-close-button flex items-center justify-center rounded-xl border border-white/10 bg-white/5 text-lg font-bold text-white/60 hover:border-cyan-300/40 hover:text-white"
              aria-label="Close paint picker"
            >
              x
            </button>
          </div>

          <input
            value={query}
            onChange={(event) => updateFilter('query', event.target.value)}
            placeholder="Search by name, brand, line, or SKU"
            className="mt-4 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/10"
            autoFocus
          />

          <div
            className={[
              'mt-3 grid grid-cols-1 gap-2',
              isCollectionMode ? 'sm:grid-cols-3' : 'sm:grid-cols-4',
            ].join(' ')}
          >
            <select
              value={brand}
              onChange={(event) => updateFilter('brand', event.target.value)}
              className="min-w-0 rounded-xl border border-white/10 bg-slate-950/80 px-3 py-3 text-sm text-white outline-none focus:border-cyan-400/60"
            >
              <option value="" className="bg-slate-950 text-white">
                Brand
              </option>
              {activeBrands.map((brandOption) => (
                <option
                  key={brandOption}
                  value={brandOption}
                  className="bg-slate-950 text-white"
                >
                  {brandOption}
                </option>
              ))}
            </select>

            <select
              value={line}
              onChange={(event) => updateFilter('line', event.target.value)}
              className="min-w-0 rounded-xl border border-white/10 bg-slate-950/80 px-3 py-3 text-sm text-white outline-none focus:border-cyan-400/60"
            >
              <option value="" className="bg-slate-950 text-white">
                Line
              </option>
              {activeLines.map((lineOption) => (
                <option
                  key={lineOption}
                  value={lineOption}
                  className="bg-slate-950 text-white"
                >
                  {lineOption}
                </option>
              ))}
            </select>

            <select
              value={colorGroup}
              onChange={(event) =>
                updateFilter('colorGroup', event.target.value)
              }
              className="min-w-0 rounded-xl border border-white/10 bg-slate-950/80 px-3 py-3 text-sm text-white outline-none focus:border-cyan-400/60"
            >
              <option value="" className="bg-slate-950 text-white">
                Color group
              </option>
              {COLOR_GROUP_OPTIONS.map((option) => (
                <option
                  key={option}
                  value={option}
                  className="bg-slate-950 text-white"
                >
                  {option}
                </option>
              ))}
            </select>

            {!isCollectionMode ? (
              <select
                value={ownership}
                onChange={(event) =>
                  updateFilter('ownership', event.target.value)
                }
                className="min-w-0 rounded-xl border border-white/10 bg-slate-950/80 px-3 py-3 text-sm text-white outline-none focus:border-cyan-400/60"
              >
                <option value="all" className="bg-slate-950 text-white">
                  All
                </option>
                <option value="owned" className="bg-slate-950 text-white">
                  Owned
                </option>
                <option value="wishlist" className="bg-slate-950 text-white">
                  Wishlist
                </option>
                <option value="unowned" className="bg-slate-950 text-white">
                  Unowned
                </option>
              </select>
            ) : null}
          </div>

          <p className="mt-3 text-xs text-white/40">
            {loading
              ? 'Searching paints...'
              : `Showing ${visiblePaints.length} matching paints`}
          </p>
        </div>

        <div className="mobile-scroll min-h-0 flex-1 overflow-y-auto p-3">
          {error ? (
            <div className="mb-3 rounded-2xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-100/80">
              {error}
            </div>
          ) : null}

          {loading && visiblePaints.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/45">
              Loading paints...
            </div>
          ) : visiblePaints.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/45">
              No paints found.
            </div>
          ) : (
            <div className="space-y-2">
              {visiblePaints.map((paint) => {
                const paintKey = getPaintKey(paint)
                const isSelected = selectedKey === paintKey || selectedPaintId === paint.id
                const isBusy = pendingOwnedIds.has(paint.id)
                const owned = Boolean(paint.is_owned)

                return (
                  <div
                    key={paintKey}
                    role={isCollectionMode ? undefined : 'button'}
                    tabIndex={disabled || isCollectionMode ? -1 : 0}
                    aria-disabled={disabled}
                    onClick={() => selectPaint(paint)}
                    onKeyDown={(event) => selectPaintFromKeyboard(event, paint)}
                    className={[
                      'tap-card flex min-h-16 w-full items-center gap-3 rounded-2xl border p-3 text-left outline-none focus:border-cyan-300/70 focus:ring-2 focus:ring-cyan-300/15 aria-disabled:cursor-not-allowed aria-disabled:opacity-60',
                      isCollectionMode ? 'cursor-default' : 'cursor-pointer',
                      isSelected
                        ? 'border-cyan-300/60 bg-cyan-300/[0.12] shadow-[0_0_18px_rgba(34,211,238,0.12)]'
                        : 'border-white/10 bg-white/[0.035] hover:border-cyan-400/40 hover:bg-cyan-400/[0.08]',
                    ].join(' ')}
                  >
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white/[0.04]">
                      {paint.swatch_image_url ? (
                        <Image
                          src={paint.swatch_image_url}
                          alt={paint.name || 'Paint swatch'}
                          fill
                          sizes="48px"
                          className="object-cover"
                        />
                      ) : (
                        <div
                          className="h-full w-full"
                          style={{ backgroundColor: getPaintHex(paint) }}
                        />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-white">
                        {paint.name || 'Unnamed paint'}
                      </p>
                      <p className="mt-1 truncate text-xs text-white/45">
                        {[paint.brand, paint.line, paint.sku]
                          .filter(Boolean)
                          .join(' / ') ||
                          (paint.source === 'custom'
                            ? 'Custom paint'
                            : 'Catalog paint')}
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={paint.source !== 'catalog' || isBusy}
                      onClick={(event) => toggleOwned(event, paint)}
                      className={[
                        'tap-press tap-target shrink-0 rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-wide disabled:cursor-default disabled:opacity-70',
                        owned
                          ? 'border-cyan-400/40 bg-cyan-400/15 text-cyan-200 shadow-[0_0_12px_rgba(34,211,238,0.18)]'
                          : 'border-white/10 bg-white/5 text-white/45 hover:border-cyan-400/30 hover:text-cyan-200',
                      ].join(' ')}
                    >
                      {isBusy ? 'Saving' : owned ? 'Owned' : 'Add owned'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
