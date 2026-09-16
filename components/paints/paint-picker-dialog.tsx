'use client'

import Image from 'next/image'
import { createPortal } from 'react-dom'
import type { KeyboardEvent, MouseEvent } from 'react'
import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import { capturePostHog } from '../../utils/analytics/client'
import { lockBodyScroll } from '../../utils/body-scroll-lock'
import styles from './paint-picker-dialog.module.css'

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

const EMPTY_PAINTS: PaintPickerPaint[] = []

type OwnershipFilter = 'all' | 'owned' | 'wishlist' | 'unowned'

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
      const matchesOwnership =
        ownership === 'all' ||
        (ownership === 'owned' && paint.is_owned) ||
        (ownership === 'wishlist' && paint.is_wishlist) ||
        (ownership === 'unowned' && !paint.is_owned)

      return (
        matchesSearch &&
        matchesBrand &&
        matchesLine &&
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
  initialPaints = EMPTY_PAINTS,
  disabled = false,
  mode = 'select',
}: PaintPickerDialogProps) {
  const [query, setQuery] = useState('')
  const [brand, setBrand] = useState('')
  const [line, setLine] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const filtersId = useId()
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
      ownership
    )
  }, [brand, error, initialPaints, line, ownership, paints, query])

  const activeBrands = brands.length > 0 ? brands : fallbackBrands
  const visibleResultLines = useMemo(
    () =>
      Array.from(
        new Set(
          filterInitialPaints(paints, query, brand, '', ownership)
            .map((paint) => paint.line)
            .filter((value): value is string => Boolean(value))
        )
      ),
    [brand, ownership, paints, query]
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
      capturePostHog(event, {
        context: source,
        source,
        brand: brand || null,
        line: line || null,
        ownership_filter: ownership,
        ...properties,
      })
    },
    [brand, line, ownership, source]
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

        const response = await fetch(`/api/theme-paint-search?${params}`, {
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error('Paint search failed')
        }

        const result = await response.json()
        if (controller.signal.aborted) return
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
  }, [brand, initialPaints, line, open, ownership, query])

  function closeDialog() {
    onOpenChange(false)
  }

  function updateFilter(
    key: 'query' | 'brand' | 'line' | 'ownership',
    value: string
  ) {
    if (key === 'query') setQuery(value)
    if (key === 'brand') {
      setBrand(value)
      setLine('')
    }
    if (key === 'line') setLine(value)
    if (key === 'ownership') setOwnership(value as OwnershipFilter)

    capture('paint_picker_filter_changed', {
      changed_filter: key,
      filter_value: value || null,
    })
  }

  async function toggleOwnership(
    event: MouseEvent<HTMLButtonElement>,
    paint: PaintPickerPaint,
    kind: 'owned' | 'wishlist'
  ) {
    event.stopPropagation()
    event.preventDefault()

    if (paint.source !== 'catalog' || pendingOwnedIds.has(paint.id)) return

    const previousOwned = Boolean(paint.is_owned)
    const previousWishlist = Boolean(paint.is_wishlist)
    const field = kind === 'owned' ? 'is_owned' : 'is_wishlist'
    const previousValue = kind === 'owned' ? previousOwned : previousWishlist

    setPendingOwnedIds((current) => new Set(current).add(paint.id))
    setPaints((current) =>
      current.map((item) =>
        item.source === 'catalog' && item.id === paint.id
          ? { ...item, [field]: !previousValue }
          : item
      )
    )

    try {
      const response = await fetch('/api/vault/ownership', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paintId: paint.id,
          action: kind,
          currentValue: previousValue,
        }),
      })

      if (!response.ok) {
        throw new Error('Ownership update failed')
      }

      capture(`paint_picker_${kind}_toggled`, {
        paint_id: paint.id,
        paint_source: paint.source,
        paint_name: paint.name,
        [field]: !previousValue,
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

  useEffect(() => {
    if (!open) return
    return lockBodyScroll()
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onOpenChange(false)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onOpenChange])

  if (!open || typeof document === 'undefined') return null

  const activeFilterCount = Number(Boolean(brand)) + Number(Boolean(line)) + Number(ownership !== 'all')

  return createPortal(
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(event) => {
        event.stopPropagation()
        closeDialog()
      }}
    >
      <section className={styles.sheet} onClick={(event) => event.stopPropagation()}>
        <header className={styles.header}>
          <div className={styles.titleRow}>
            <h3 className={styles.title}>{title}</h3>
            <button type="button" onClick={closeDialog} className={styles.close} aria-label="Close paint picker">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d="m6 6 12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
          <div className={styles.searchRow}>
            <input
              value={query}
              onChange={(event) => updateFilter('query', event.target.value)}
              placeholder="Search paints…"
              aria-label="Search paints"
              className={styles.search}
            />
            <button
              type="button"
              className={styles.filterButton}
              aria-expanded={filtersOpen}
              aria-controls={filtersId}
              data-active={activeFilterCount > 0}
              onClick={() => setFiltersOpen((current) => !current)}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                <path d="M4 7h16M4 17h16" /><circle cx="9" cy="7" r="2" /><circle cx="15" cy="17" r="2" />
              </svg>
              Filters{activeFilterCount ? ` (${activeFilterCount})` : ''}
            </button>
          </div>
          {filtersOpen ? (
            <div id={filtersId} className={styles.filterRow}>
              <label className={styles.filterLabel}>Brand
                <select aria-label="Brand" value={brand} onChange={(event) => updateFilter('brand', event.target.value)} className={styles.select}>
                  <option value="">All brands</option>
                  {activeBrands.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              <label className={styles.filterLabel}>Line
                <select aria-label="Line" value={line} onChange={(event) => updateFilter('line', event.target.value)} className={styles.select}>
                  <option value="">All lines</option>
                  {activeLines.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              <label className={styles.filterLabel}>Ownership
                <select aria-label="Ownership" value={ownership} onChange={(event) => updateFilter('ownership', event.target.value)} className={styles.select}>
                  <option value="all">All paints</option>
                  <option value="owned">Owned</option>
                  <option value="wishlist">Wishlist</option>
                  <option value="unowned">Unowned</option>
                </select>
              </label>
            </div>
          ) : null}
          <p className={styles.resultCount} aria-live="polite">
            {loading ? 'Searching paints…' : `Showing ${visiblePaints.length} matching paints`}
          </p>
        </header>
        <div className={`mobile-scroll ${styles.results}`}>
          {error ? <p role="alert" className={styles.error}>{error}</p> : null}
          {loading && visiblePaints.length === 0 ? (
            <p className={styles.empty}>Loading paints…</p>
          ) : visiblePaints.length === 0 ? (
            <p className={styles.empty}>No paints found.</p>
          ) : (
            <div className={styles.paintList}>
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
                    data-selected={isSelected}
                    onClick={() => selectPaint(paint)}
                    onKeyDown={(event) => selectPaintFromKeyboard(event, paint)}
                    className={styles.paintRow}
                  >
                    <div className={styles.swatch}>
                      {paint.swatch_image_url ? (
                        <Image src={paint.swatch_image_url} alt={paint.name || 'Paint swatch'} fill sizes="44px" className="object-cover" />
                      ) : <div className="h-full w-full" style={{backgroundColor: getPaintHex(paint)}} />}
                    </div>
                    <div className={styles.paintInfo}>
                      <p className={styles.paintName}>{paint.name || 'Unnamed paint'}</p>
                      <p className={styles.paintMeta}>
                        {[paint.brand, paint.line, paint.sku].filter(Boolean).join(' · ') || (paint.source === 'custom' ? 'Custom paint' : 'Catalog paint')}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={paint.source !== 'catalog' || isBusy}
                      onClick={(event) => toggleOwnership(event, paint, 'owned')}
                      className={styles.ownership}
                      data-owned={owned}
                    >
                      {isBusy ? 'Saving' : owned ? 'Owned' : 'Add owned'}
                    </button>
                    <button
                      type="button"
                      disabled={paint.source !== 'catalog' || isBusy}
                      onClick={(event) => toggleOwnership(event, paint, 'wishlist')}
                      className={styles.ownership}
                      data-owned={Boolean(paint.is_wishlist)}
                      aria-label={paint.is_wishlist ? 'Remove from wishlist' : 'Add to wishlist'}
                      aria-pressed={Boolean(paint.is_wishlist)}
                    >
                      <svg viewBox="0 0 24 24" width="18" height="18" fill={paint.is_wishlist ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                        <path d="m12 3 2.8 5.7 6.3.9-4.6 4.5 1.1 6.3-5.6-3-5.6 3 1.1-6.3L3 9.6l6.2-.9Z" />
                      </svg>
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>
    </div>,
    document.body
  )
}
