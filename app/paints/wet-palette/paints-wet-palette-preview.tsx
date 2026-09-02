'use client'

import Link from 'next/link'
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import AppHamburgerMenu from '../../components/app-hamburger-menu'
import FeatureGuideTour from '../../components/feature-guide-tour'
import { findVisibleFeatureGuideIndex } from '../../components/feature-guide-navigation'
import V3PerfIndicator from '../../components/v3-perf-indicator'
import PaintDaub from './paint-daub'
import styles from '../paints-v3-silver.module.css'
import paletteStyles from './paints-wet-palette.module.css'
import type { FeatureGuideEntry } from '../../components/feature-guide-types'
import type { PaintsV3Payload } from '../paints-v3-data'

type PaintRecord = {
  id: string
  name: string
  brand: string
  line: string
  finish: string
  size: string
  color: string
  swatchImageUrl?: string | null
  owned: boolean
  wish: boolean
  notes: string
}

type PaintExportFormat = 'csv' | 'txt' | 'json' | 'pdf'
type PaintOwnershipAction = 'owned' | 'wishlist'
type PaintOwnershipState = Pick<PaintRecord, 'owned' | 'wish'>

const fallbackPaints: PaintRecord[] = [
  {
    id: 'abaddon-black',
    name: 'Abaddon Black',
    brand: 'WHC',
    line: 'Base',
    finish: 'Matte',
    size: '18ml',
    color: '#111417',
    owned: true,
    wish: false,
    notes: 'Reliable deep black for lining, armor joints, and final cleanup.',
  },
  {
    id: 'aethermatic-blue',
    name: 'Aethermatic Blue',
    brand: 'WHC',
    line: 'Technical',
    finish: 'Satin',
    size: '18ml',
    color: '#5aa7c9',
    owned: true,
    wish: false,
    notes: 'Useful transparent blue for glow effects and cold shadows.',
  },
  {
    id: 'agrellan-earth',
    name: 'Agrellan Earth',
    brand: 'WHC',
    line: 'Technical',
    finish: 'Crackle',
    size: '24ml',
    color: '#7a5d37',
    owned: true,
    wish: false,
    notes: 'Cracked earth texture for desert bases and weathered terrain.',
  },
  {
    id: 'angel-green',
    name: 'Angel Green',
    brand: 'VAL',
    line: 'Game Color',
    finish: 'Matte',
    size: '17ml',
    color: '#4eb282',
    owned: true,
    wish: false,
    notes: 'Clean green midtone for cloth, heraldry, and creature skin.',
  },
  {
    id: 'aztec-gold',
    name: 'Aztec Gold',
    brand: 'TAP',
    line: 'Warpaints',
    finish: 'Metallic',
    size: '18ml',
    color: '#d29631',
    owned: true,
    wish: false,
    notes: 'Warm metallic gold for trim, jewelry, and aged ornament.',
  },
  {
    id: 'bag-of-bones',
    name: 'Bag of Bones',
    brand: 'VAL',
    line: 'Game Color',
    finish: 'Matte',
    size: '17ml',
    color: '#d8bd83',
    owned: true,
    wish: false,
    notes: 'Bone highlight for skulls, parchment, cloth, and warm ivory.',
  },
  {
    id: 'black',
    name: 'Black',
    brand: 'VAL',
    line: 'Model Color',
    finish: 'Matte',
    size: '17ml',
    color: '#171815',
    owned: true,
    wish: false,
    notes: 'Neutral black with a soft finish for brush and airbrush work.',
  },
  {
    id: 'blood-for-the-blood-god',
    name: 'Blood for the Blood God',
    brand: 'WHC',
    line: 'Technical',
    finish: 'Gloss',
    size: '18ml',
    color: '#b51d20',
    owned: true,
    wish: false,
    notes: 'Gloss blood effect for wounds, blades, bases, and horror details.',
  },
  {
    id: 'caribbean-turquoise',
    name: 'Caribbean Turquoise',
    brand: 'VAL',
    line: 'Game Color',
    finish: 'Matte',
    size: '17ml',
    color: '#17b9c2',
    owned: true,
    wish: false,
    notes: 'High-saturation turquoise for cloth, gems, and bright accents.',
  },
  {
    id: 'cavalry-brown',
    name: 'Cavalry Brown',
    brand: 'VAL',
    line: 'Model Color',
    finish: 'Matte',
    size: '17ml',
    color: '#9b4b2f',
    owned: false,
    wish: true,
    notes: 'Earthy red-brown for leather, rust, and muted red shadows.',
  },
  {
    id: 'deep-blue',
    name: 'Deep Blue',
    brand: 'AK',
    line: '3rd Gen',
    finish: 'Matte',
    size: '17ml',
    color: '#1e4f92',
    owned: true,
    wish: false,
    notes: 'Strong navy blue for armor panels and cool shadow mixes.',
  },
  {
    id: 'druchii-violet',
    name: 'Druchii Violet',
    brand: 'WHC',
    line: 'Shade',
    finish: 'Satin',
    size: '18ml',
    color: '#4d315f',
    owned: false,
    wish: true,
    notes: 'Purple shade for shadows over skin, gold, red, and bone.',
  },
  {
    id: 'ivory',
    name: 'Ivory',
    brand: 'VAL',
    line: 'Model Color',
    finish: 'Matte',
    size: '17ml',
    color: '#efe3c5',
    owned: true,
    wish: false,
    notes: 'Soft off-white for highlights without a chalky pure white jump.',
  },
  {
    id: 'jungle-green',
    name: 'Jungle Green',
    brand: 'TAP',
    line: 'Warpaints',
    finish: 'Matte',
    size: '18ml',
    color: '#1f8f63',
    owned: true,
    wish: false,
    notes: 'Saturated green for foliage, scales, and lively midtones.',
  },
  {
    id: 'moon-dust',
    name: 'Moon Dust',
    brand: 'AK',
    line: '3rd Gen',
    finish: 'Matte',
    size: '17ml',
    color: '#b7b3a0',
    owned: true,
    wish: false,
    notes: 'Grey-beige neutral for stone, weathering, and desaturated cloth.',
  },
  {
    id: 'orange-fire',
    name: 'Orange Fire',
    brand: 'VAL',
    line: 'Game Color',
    finish: 'Matte',
    size: '17ml',
    color: '#f47622',
    owned: true,
    wish: false,
    notes: 'Bright orange for flame, hazard markings, and hot highlights.',
  },
  {
    id: 'royal-purple',
    name: 'Royal Purple',
    brand: 'TAP',
    line: 'Warpaints',
    finish: 'Matte',
    size: '18ml',
    color: '#5943a7',
    owned: true,
    wish: false,
    notes: 'Clean purple for cloaks, banners, and rich accent colors.',
  },
  {
    id: 'wolf-grey',
    name: 'Wolf Grey',
    brand: 'VAL',
    line: 'Game Color',
    finish: 'Matte',
    size: '17ml',
    color: '#9aafbd',
    owned: true,
    wish: false,
    notes: 'Cool grey-blue for space armor, winter cloth, and edge highlights.',
  },
]

const pageSize = 9
const defaultMatchColor = '#17c9d2'
const paintExportOptions: {
  format: PaintExportFormat
  label: string
  description: string
}[] = [
  {
    format: 'csv',
    label: 'CSV',
    description: 'Spreadsheet-ready collection rows.',
  },
  {
    format: 'txt',
    label: 'TXT',
    description: 'Plain text list for sharing or notes.',
  },
  {
    format: 'json',
    label: 'JSON',
    description: 'Structured data for tools and backups.',
  },
  {
    format: 'pdf',
    label: 'PDF',
    description: 'Printable report in a new window.',
  },
]

function getPaintColorGroup(hex: string) {
  const value = hex.replace('#', '')
  const red = parseInt(value.slice(0, 2), 16)
  const green = parseInt(value.slice(2, 4), 16)
  const blue = parseInt(value.slice(4, 6), 16)
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)

  if (max < 45) return 'black'
  if (min > 205) return 'white'
  if (red > 150 && green > 115 && blue < 90) return 'yellow'
  if (red > 135 && green < 90 && blue < 90) return 'red'
  if (blue > red && blue > green) return 'blue'
  if (green > red && green > blue) return 'green'
  if (red > 100 && blue > 100) return 'violet'
  return 'brown'
}

function getColorDistance(firstHex: string, secondHex: string) {
  const first = firstHex.replace('#', '')
  const second = secondHex.replace('#', '')
  const firstRed = parseInt(first.slice(0, 2), 16)
  const firstGreen = parseInt(first.slice(2, 4), 16)
  const firstBlue = parseInt(first.slice(4, 6), 16)
  const secondRed = parseInt(second.slice(0, 2), 16)
  const secondGreen = parseInt(second.slice(2, 4), 16)
  const secondBlue = parseInt(second.slice(4, 6), 16)

  return Math.hypot(
    firstRed - secondRed,
    firstGreen - secondGreen,
    firstBlue - secondBlue
  )
}

function escapeCsvValue(value: string | boolean) {
  const stringValue = String(value)
  if (!/[",\n\r]/.test(stringValue)) {
    return stringValue
  }

  return `"${stringValue.replaceAll('"', '""')}"`
}

function getPaintExportFilename(format: PaintExportFormat) {
  return `obsidian-gallery-paints.${format === 'pdf' ? 'html' : format}`
}

function buildPaintExportPayload(format: Exclude<PaintExportFormat, 'pdf'>, paintList: PaintRecord[]) {
  if (format === 'json') {
    return JSON.stringify(paintList, null, 2)
  }

  if (format === 'txt') {
    return paintList
      .map(
        (paint) =>
          `${paint.name} - ${paint.brand} ${paint.line}, ${paint.finish}, ${paint.size}, ${
            paint.owned ? 'owned' : 'not owned'
          }${paint.wish ? ', wishlist' : ''}\n${paint.notes}`
      )
      .join('\n\n')
  }

  const columns = [
    'name',
    'brand',
    'line',
    'finish',
    'size',
    'color',
    'owned',
    'wishlist',
    'notes',
  ]
  const rows = paintList.map((paint) =>
    [
      paint.name,
      paint.brand,
      paint.line,
      paint.finish,
      paint.size,
      paint.color,
      paint.owned,
      paint.wish,
      paint.notes,
    ]
      .map(escapeCsvValue)
      .join(',')
  )

  return [columns.join(','), ...rows].join('\n')
}

function downloadPaintExport(
  format: Exclude<PaintExportFormat, 'pdf'>,
  paintList: PaintRecord[]
) {
  const mimeTypes = {
    csv: 'text/csv;charset=utf-8',
    txt: 'text/plain;charset=utf-8',
    json: 'application/json;charset=utf-8',
  } as const
  const payload = buildPaintExportPayload(format, paintList)
  const blob = new Blob([payload], { type: mimeTypes[format] })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = getPaintExportFilename(format)
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function openPaintPdfExport(paintList: PaintRecord[]) {
  const exportWindow = window.open('', '_blank', 'noopener,noreferrer')
  if (!exportWindow) {
    return
  }

  const rows = paintList
    .map(
      (paint) => `
        <tr>
          <td><span class="swatch" style="background:${paint.color}"></span>${paint.name}</td>
          <td>${paint.brand}</td>
          <td>${paint.line}</td>
          <td>${paint.finish}</td>
          <td>${paint.size}</td>
          <td>${paint.owned ? 'Owned' : paint.wish ? 'Wishlist' : 'Library'}</td>
        </tr>
      `
    )
    .join('')

  exportWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>Obsidian Gallery Paint Export</title>
        <style>
          body { background: #f8fafc; color: #0f172a; font-family: Arial, sans-serif; margin: 32px; }
          h1 { margin: 0 0 8px; font-size: 28px; }
          p { color: #475569; margin: 0 0 24px; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border-bottom: 1px solid #cbd5e1; padding: 10px; text-align: left; font-size: 12px; }
          th { color: #334155; text-transform: uppercase; letter-spacing: 0.08em; }
          .swatch { border: 1px solid #cbd5e1; border-radius: 999px; display: inline-block; height: 14px; margin-right: 8px; vertical-align: -2px; width: 14px; }
        </style>
      </head>
      <body>
        <h1>Obsidian Gallery Paint Export</h1>
        <p>${paintList.length} paints exported from the V3 Wet Palette preview.</p>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Brand</th>
              <th>Line</th>
              <th>Finish</th>
              <th>Size</th>
              <th>Ownership</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </body>
    </html>
  `)
  exportWindow.document.close()
  exportWindow.print()
}

function isCustomPaintId(paintId: string) {
  return paintId.startsWith('custom-')
}

function applyPaintStateOverrides(
  paints: PaintRecord[],
  overrides: Record<string, PaintOwnershipState>
) {
  return paints.map((paint) => ({
    ...paint,
    ...overrides[paint.id],
  }))
}

type PaintsWetPalettePreviewProps = {
  featureGuides?: FeatureGuideEntry[]
  initialPayload?: PaintsV3Payload
}

export default function PaintsWetPalettePreview({
  featureGuides = [],
  initialPayload,
}: PaintsWetPalettePreviewProps) {
  const [activeTab, setActiveTab] = useState<'owned' | 'library'>('owned')
  const [query, setQuery] = useState('')
  const [activeGuideIndex, setActiveGuideIndex] = useState<number | null>(null)
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [isMixOpen, setIsMixOpen] = useState(false)
  const [isExportOpen, setIsExportOpen] = useState(false)
  const searchToolbarRef = useRef<HTMLElement>(null)
  const [panelPosition, setPanelPosition] = useState<{ top: number; left: number; width: number } | null>(null)

  useEffect(() => {
    if (!isFilterOpen) {
      setPanelPosition(null)
      return
    }

    function updatePosition() {
      const rect = searchToolbarRef.current?.getBoundingClientRect()
      if (!rect) return
      setPanelPosition({ top: rect.bottom + 8, left: rect.left, width: rect.width })
    }

    updatePosition()

    function closeOnScrollOrResize() {
      setIsFilterOpen(false)
    }

    window.addEventListener('resize', closeOnScrollOrResize)
    window.addEventListener('scroll', closeOnScrollOrResize, true)
    return () => {
      window.removeEventListener('resize', closeOnScrollOrResize)
      window.removeEventListener('scroll', closeOnScrollOrResize, true)
    }
  }, [isFilterOpen])
  const [brandFilter, setBrandFilter] = useState('all')
  const [lineFilter, setLineFilter] = useState('all')
  const [ownershipFilter, setOwnershipFilter] = useState('all')
  const [colorGroupFilter, setColorGroupFilter] = useState('all')
  const [matchColor, setMatchColor] = useState('')
  const [pageIndex, setPageIndex] = useState(0)
  const [paintStateOverrides, setPaintStateOverrides] = useState<
    Record<string, PaintOwnershipState>
  >({})
  const [pendingPaintActions, setPendingPaintActions] = useState<
    Record<string, PaintOwnershipAction>
  >({})
  const libraryBasePaints = useMemo(
    () => initialPayload?.libraryPaints ?? fallbackPaints,
    [initialPayload]
  )
  const basePaints = useMemo(() => {
    const payloadPaints = initialPayload
      ? [...initialPayload.ownedPaints, ...initialPayload.libraryPaints]
      : fallbackPaints
    const seenPaintIds = new Set<string>()

    return payloadPaints.filter((paint) => {
      if (seenPaintIds.has(paint.id)) return false
      seenPaintIds.add(paint.id)
      return true
    })
  }, [initialPayload])
  const allPaints = useMemo(
    () => applyPaintStateOverrides(basePaints, paintStateOverrides),
    [basePaints, paintStateOverrides]
  )
  const libraryPaints = useMemo(
    () => applyPaintStateOverrides(libraryBasePaints, paintStateOverrides),
    [libraryBasePaints, paintStateOverrides]
  )
  const brandOptions =
    initialPayload?.filters.brands.length
      ? initialPayload.filters.brands
      : ['WHC', 'VAL', 'TAP', 'AK']
  const lineOptions =
    initialPayload?.filters.lines.length
      ? initialPayload.filters.lines
      : ['Base', 'Technical', 'Game Color', 'Warpaints', 'Model Color', '3rd Gen', 'Shade']
  const defaultSelectedPaintId = allPaints[7]?.id ?? allPaints[0]?.id ?? ''
  const [selectedPaintId, setSelectedPaintId] = useState(defaultSelectedPaintId)
  const [mixName, setMixName] = useState('')
  const [mixBase, setMixBase] = useState(allPaints[0]?.name ?? '')

  useEffect(() => {
    performance.mark('v3-paints-wet-palette-hydrated')
  }, [])

  const filteredPaints = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    const basePaints =
      activeTab === 'owned'
        ? allPaints.filter((paint) => paint.owned || paint.wish)
        : libraryPaints

    return basePaints.filter((paint) => {
      const matchesQuery =
        !normalizedQuery ||
        paint.name.toLowerCase().includes(normalizedQuery) ||
        paint.brand.toLowerCase().includes(normalizedQuery) ||
        paint.line.toLowerCase().includes(normalizedQuery)
      const matchesBrand = brandFilter === 'all' || paint.brand === brandFilter
      const matchesLine = lineFilter === 'all' || paint.line === lineFilter
      const matchesOwnership =
        ownershipFilter === 'all' ||
        (ownershipFilter === 'owned' && paint.owned) ||
        (ownershipFilter === 'wishlist' && paint.wish)
      const matchesColorGroup =
        colorGroupFilter === 'all' ||
        getPaintColorGroup(paint.color) === colorGroupFilter
      const matchesColor =
        !matchColor || getColorDistance(paint.color, matchColor) < 150

      return (
        matchesQuery &&
        matchesBrand &&
        matchesLine &&
        matchesOwnership &&
        matchesColorGroup &&
        matchesColor
      )
    })
  }, [
    activeTab,
    allPaints,
    brandFilter,
    colorGroupFilter,
    libraryPaints,
    lineFilter,
    matchColor,
    ownershipFilter,
    query,
  ])

  const pageCount = Math.max(1, Math.ceil(filteredPaints.length / pageSize))
  const normalizedPageIndex = Math.min(pageIndex, pageCount - 1)
  const visiblePaints = filteredPaints.slice(
    normalizedPageIndex * pageSize,
    normalizedPageIndex * pageSize + pageSize
  )
  const selectedPaint =
    allPaints.find((paint) => paint.id === selectedPaintId) ??
    filteredPaints[0] ??
    allPaints[0]
  const activeGuide =
    activeGuideIndex === null ? null : featureGuides[activeGuideIndex] ?? null

  function showPreviousPage() {
    setPageIndex((current) => (current === 0 ? pageCount - 1 : current - 1))
  }

  function showNextPage() {
    setPageIndex((current) => (current + 1 >= pageCount ? 0 : current + 1))
  }

  function handleTabChange(nextTab: 'owned' | 'library') {
    setActiveTab(nextTab)
    setPageIndex(0)
  }

  function handleMixSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMixName('')
    setMixBase(allPaints[0]?.name ?? '')
    setIsMixOpen(false)
  }

  function handleExport(format: PaintExportFormat) {
    if (format === 'pdf') {
      openPaintPdfExport(filteredPaints)
    } else {
      downloadPaintExport(format, filteredPaints)
    }
    setIsExportOpen(false)
  }

  async function togglePaintOwnershipState(
    paint: PaintRecord,
    action: PaintOwnershipAction
  ) {
    if (isCustomPaintId(paint.id) || pendingPaintActions[paint.id]) {
      return
    }

    const previousState: PaintOwnershipState = {
      owned: paint.owned,
      wish: paint.wish,
    }
    const optimisticState: PaintOwnershipState =
      action === 'owned'
        ? {
            ...previousState,
            owned: !paint.owned,
          }
        : {
            ...previousState,
            wish: !paint.wish,
          }

    setPaintStateOverrides((current) => ({
      ...current,
      [paint.id]: optimisticState,
    }))
    setPendingPaintActions((current) => ({
      ...current,
      [paint.id]: action,
    }))

    try {
      const response = await fetch('/api/vault/ownership', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          currentValue: action === 'owned' ? paint.owned : paint.wish,
          paintId: paint.id,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to update paint ownership.')
      }

      const result = (await response.json()) as {
        ownership?: {
          is_owned?: boolean | null
          is_wishlist?: boolean | null
        }
      }
      const ownership = result.ownership

      setPaintStateOverrides((current) => ({
        ...current,
        [paint.id]: {
          owned: Boolean(ownership?.is_owned),
          wish: Boolean(ownership?.is_wishlist),
        },
      }))
    } catch {
      setPaintStateOverrides((current) => ({
        ...current,
        [paint.id]: previousState,
      }))
    } finally {
      setPendingPaintActions((current) => {
        const next = { ...current }
        delete next[paint.id]
        return next
      })
    }
  }

  return (
    <main
      className={styles.paintsSilver}
      data-v3-paints-indicator="root"
      data-v3-paints-source={initialPayload ? 'live' : 'fallback'}
      data-v3-paints-variant="wet-palette"
    >
      <V3PerfIndicator surface="paints-wet-palette" detail={activeTab} />
      <div
        className="mx-auto flex w-full max-w-md flex-col gap-3 px-3 pb-48 pt-6"
        data-v3-paints-indicator="content"
      >
        <TopNav
          isHelpOpen={activeGuide !== null}
          onCreate={() => {
            setActiveGuideIndex(null)
            setIsFilterOpen(false)
            setIsExportOpen(false)
            setIsMixOpen(true)
          }}
          onHelpToggle={() => {
            setIsFilterOpen(false)
            setIsExportOpen(false)
            setIsMixOpen(false)
            if (!featureGuides.length) return
            setActiveGuideIndex(
              findVisibleFeatureGuideIndex(featureGuides, null, 1) ?? 0
            )
          }}
        />

        <div
          className="grid grid-cols-2 rounded-[8px] border border-white/[0.04] bg-white/[0.055] p-0.5"
          role="tablist"
          aria-label="Paint views"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'owned'}
            data-feature-guide-target="paints.tabs.my_paints"
            onClick={() => handleTabChange('owned')}
            className={[
              'h-9 rounded-[6px] text-xs font-black transition',
              activeTab === 'owned'
                ? 'bg-[#101822] text-cyan-300 shadow-[inset_0_0_24px_rgba(34,211,238,0.06)]'
                : 'text-white/38 hover:text-white/70',
            ].join(' ')}
          >
            My Paints
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'library'}
            data-feature-guide-target="paints.tabs.library"
            onClick={() => handleTabChange('library')}
            className={[
              'h-9 rounded-[6px] text-xs font-black transition',
              activeTab === 'library'
                ? 'bg-[#101822] text-cyan-300 shadow-[inset_0_0_24px_rgba(34,211,238,0.06)]'
                : 'text-white/38 hover:text-white/70',
            ].join(' ')}
          >
            Paint Library
          </button>
        </div>

        <section
          className="relative"
          ref={searchToolbarRef}
          data-v3-paints-indicator="search-filter-toolbar"
        >
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <label
              className="relative block"
              data-feature-guide-target="paints.search"
            >
              <span className="sr-only">Search paints</span>
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/28"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value)
                  setPageIndex(0)
                }}
                placeholder="Search by name or brand..."
                className="h-12 w-full rounded-[8px] border border-white/10 bg-[#111821] pl-10 pr-3 text-sm font-semibold text-white outline-none transition placeholder:text-white/28 focus:border-cyan-300/70"
              />
            </label>

            <button
              type="button"
              aria-expanded={isFilterOpen}
              aria-controls="paint-filters"
              onClick={() => {
                setActiveGuideIndex(null)
                setIsExportOpen(false)
                setIsFilterOpen((open) => !open)
              }}
              className="flex h-12 items-center gap-2 rounded-[8px] border border-white/10 bg-[#111821] px-4 text-xs font-black text-white/48 transition hover:text-cyan-300"
              data-feature-guide-target="paints.filters"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 5h18" />
                <path d="M6 12h12" />
                <path d="M10 19h4" />
              </svg>
              Filter
            </button>
          </div>

          {isFilterOpen && panelPosition && typeof document !== 'undefined'
            ? createPortal(
            <div
              id="paint-filters"
              data-v3-paints-indicator="filter-panel"
              data-feature-guide-target="paints.filters"
              className="z-20 grid gap-4 rounded-[8px] border border-white/10 bg-[#071015] p-3 shadow-2xl shadow-black/45"
              style={{ position: 'fixed', top: panelPosition.top, left: panelPosition.left, width: panelPosition.width }}
            >
              <div className="grid grid-cols-3 gap-3">
                <label className="relative">
                  <span className="sr-only">Brand</span>
                  <select
                    value={brandFilter}
                    onChange={(event) => {
                      setBrandFilter(event.target.value)
                      setPageIndex(0)
                    }}
                    className="h-11 w-full appearance-none rounded-[8px] border border-[#22304a] bg-[#02051a] px-4 pr-8 text-sm font-black text-white outline-none transition focus:border-cyan-300/60"
                  >
                    <option value="all">Brand</option>
                    {brandOptions.map((brand) => (
                      <option key={brand} value={brand}>
                        {brand}
                      </option>
                    ))}
                  </select>
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/70">
                    v
                  </span>
                </label>

                <label className="relative">
                  <span className="sr-only">Line</span>
                  <select
                    value={lineFilter}
                    onChange={(event) => {
                      setLineFilter(event.target.value)
                      setPageIndex(0)
                    }}
                    className="h-11 w-full appearance-none rounded-[8px] border border-[#22304a] bg-[#02051a] px-4 pr-8 text-sm font-black text-white outline-none transition focus:border-cyan-300/60"
                  >
                    <option value="all">Line</option>
                    {lineOptions.map((line) => (
                      <option key={line} value={line}>
                        {line}
                      </option>
                    ))}
                  </select>
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/70">
                    v
                  </span>
                </label>

                <label className="relative">
                  <span className="sr-only">Ownership</span>
                  <select
                    value={ownershipFilter}
                    onChange={(event) => {
                      setOwnershipFilter(event.target.value)
                      setPageIndex(0)
                    }}
                    className="h-11 w-full appearance-none rounded-[8px] border border-[#22304a] bg-[#02051a] px-4 pr-8 text-sm font-black text-white outline-none transition focus:border-cyan-300/60"
                  >
                    <option value="all">All</option>
                    <option value="owned">Owned</option>
                    <option value="wishlist">Wishlist</option>
                  </select>
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/70">
                    v
                  </span>
                </label>
              </div>

              <div className="grid grid-cols-[1fr_auto_auto] gap-2">
                <label className="relative">
                  <span className="sr-only">Color group</span>
                  <select
                    value={colorGroupFilter}
                    onChange={(event) => {
                      setColorGroupFilter(event.target.value)
                      setPageIndex(0)
                    }}
                    className="h-11 w-full appearance-none rounded-[8px] border border-[#22304a] bg-[#02051a] px-4 pr-8 text-sm font-black text-white outline-none transition focus:border-cyan-300/60"
                  >
                    <option value="all">Color group</option>
                    <option value="black">Black</option>
                    <option value="blue">Blue</option>
                    <option value="brown">Brown</option>
                    <option value="green">Green</option>
                    <option value="red">Red</option>
                    <option value="violet">Violet</option>
                    <option value="white">White</option>
                    <option value="yellow">Yellow</option>
                  </select>
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/70">
                    v
                  </span>
                </label>

                <label
                  className={[
                    'relative flex h-11 cursor-pointer items-center gap-2 rounded-[8px] border px-3 text-sm font-black transition',
                    matchColor
                      ? 'border-cyan-300/60 bg-cyan-300/10 text-cyan-100'
                    : 'border-[#22304a] bg-[#02051a] text-white',
                  ].join(' ')}
                  data-feature-guide-target="paints.match_color"
                >
                  <span
                    aria-hidden="true"
                    className="h-4 w-4 rounded-full border border-white/20"
                    style={{
                      background:
                        'conic-gradient(#f43f5e, #f59e0b, #22c55e, #06b6d4, #8b5cf6, #f43f5e)',
                    }}
                  />
                  Match a Color
                  <input
                    type="color"
                    value={matchColor || defaultMatchColor}
                    onChange={(event) => {
                      setMatchColor(event.target.value)
                      setPageIndex(0)
                    }}
                    className="absolute inset-0 cursor-pointer opacity-0"
                    aria-label="Match a color"
                  />
                </label>

                <button
                  type="button"
                  onClick={() => {
                    setBrandFilter('all')
                    setLineFilter('all')
                    setOwnershipFilter('all')
                    setColorGroupFilter('all')
                    setMatchColor('')
                    setPageIndex(0)
                  }}
                  className="h-11 rounded-[8px] border border-[#22304a] bg-[#02051a] px-4 text-sm font-black text-white transition hover:border-cyan-300/55 hover:text-cyan-200"
                >
                  Clear
                </button>
              </div>
            </div>,
              document.body
            )
            : null}
        </section>

        <section
          className="grid grid-cols-[1fr_auto_auto_auto] gap-2"
          data-v3-paints-indicator="actions-toolbar"
        >
          <button className="flex h-9 items-center justify-between rounded-[8px] border border-white/10 bg-[#111821] px-3 text-[11px] font-black text-white/45">
            Name A-Z
            <span className="text-white/28">v</span>
          </button>

          <button
            type="button"
            aria-haspopup="dialog"
            aria-expanded={isExportOpen}
            onClick={() => {
              setActiveGuideIndex(null)
              setIsFilterOpen(false)
              setIsExportOpen(true)
            }}
            className="flex h-9 items-center gap-2 rounded-[8px] border border-white/10 bg-[#111821] px-3 text-[11px] font-black text-white/48 transition hover:border-cyan-300/45 hover:text-cyan-300"
            data-feature-guide-target="paints.export"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 3v12" />
              <path d="m7 10 5 5 5-5" />
              <path d="M5 21h14" />
            </svg>
            Export
          </button>

          <Link
            href="/paints"
            className="flex h-9 items-center gap-1 rounded-[8px] border border-white/10 bg-[#111821] px-3 text-[11px] font-black text-white/48 transition hover:border-cyan-300/45 hover:text-cyan-300"
          >
            Cards
          </Link>

          <div
            className="flex h-9 rounded-[8px] border border-white/10 bg-[#111821] p-1"
            data-v3-paints-indicator="view-toggle"
          >
            <span className="grid w-8 place-items-center text-white/28">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" />
              </svg>
            </span>
            <span
              className="grid w-8 place-items-center rounded-[6px] bg-cyan-300/10 text-cyan-300"
              data-active="true"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <ellipse cx="12" cy="8.2" rx="6.4" ry="4.4" />
                <path d="M12 12.6v6.7" />
              </svg>
            </span>
          </div>
        </section>

        <section
          className={paletteStyles.paletteSection}
          data-v3-paints-indicator="wet-palette-section"
        >
          {visiblePaints.length > 0 ? (
            <div
              className={paletteStyles.paletteSurface}
              aria-label="Wet palette"
              data-feature-guide-target="paints.swatch_grid"
              data-v3-paints-indicator={
                activeTab === 'owned' ? 'my-paints-grid' : 'library-grid'
              }
            >
              <div className={paletteStyles.daubGrid}>
                {visiblePaints.map((paint) => (
                  <PaintDaubCell
                    key={paint.id}
                    paint={paint}
                    isSelected={paint.id === selectedPaint?.id}
                    onSelect={() => setSelectedPaintId(paint.id)}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div
              className={paletteStyles.paletteEmpty}
              data-v3-paints-indicator={
                activeTab === 'owned' ? 'my-paints-empty' : 'library-empty'
              }
            >
              <p className="text-sm font-black text-white">No paints found</p>
              <p className="mt-2 text-xs font-semibold leading-5 text-white/42">
                Try clearing the search or filters.
              </p>
            </div>
          )}

          <div
            className="absolute bottom-0 right-0 top-0 flex w-6 flex-col items-center justify-between rounded-full border border-white/10 bg-[#111821]/92 py-2"
            data-v3-paints-indicator="pagination-rail"
          >
            <button
              type="button"
              aria-label="Previous paints"
              onClick={showPreviousPage}
              className="grid h-8 w-5 place-items-center text-white/42 transition hover:text-cyan-300"
            >
              ^
            </button>
            <span className="text-[10px] font-black text-white/30">
              {normalizedPageIndex + 1}/{pageCount}
            </span>
            <button
              type="button"
              aria-label="Next paints"
              onClick={showNextPage}
              className="grid h-8 w-5 place-items-center text-white/42 transition hover:text-cyan-300"
            >
              v
            </button>
          </div>
        </section>
      </div>

      {selectedPaint ? (
        <PaintInfoPanel
          paint={selectedPaint}
          pendingAction={pendingPaintActions[selectedPaint.id]}
          onToggleOwned={() => togglePaintOwnershipState(selectedPaint, 'owned')}
          onToggleWishlist={() =>
            togglePaintOwnershipState(selectedPaint, 'wishlist')
          }
        />
      ) : null}

      {isExportOpen ? (
        <div className="fixed inset-0 z-[60] grid place-items-end bg-black/65 px-3 py-4 backdrop-blur-sm">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="paint-export-title"
            className="w-full max-w-md rounded-[8px] border border-white/10 bg-[#10161d] p-4 shadow-2xl shadow-black/50"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">
                  Export
                </p>
                <h2
                  id="paint-export-title"
                  className="mt-1 text-2xl font-black leading-tight"
                >
                  Export paints
                </h2>
                <p className="mt-2 text-xs font-semibold leading-5 text-white/45">
                  Export {filteredPaints.length} currently visible paint
                  records.
                </p>
              </div>
              <button
                type="button"
                aria-label="Close paint export"
                onClick={() => setIsExportOpen(false)}
                className="grid h-10 w-10 place-items-center rounded-full bg-white/[0.06] text-lg font-black text-white/48 transition hover:text-white"
              >
                x
              </button>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              {paintExportOptions.map((option) => (
                <button
                  key={option.format}
                  type="button"
                  onClick={() => handleExport(option.format)}
                  className="min-h-[92px] rounded-[8px] border border-white/10 bg-black/20 p-4 text-left transition hover:border-cyan-300/55 hover:bg-cyan-300/10"
                >
                  <span className="text-lg font-black text-white">
                    {option.label}
                  </span>
                  <span className="mt-2 block text-xs font-semibold leading-5 text-white/42">
                    {option.description}
                  </span>
                </button>
              ))}
            </div>
          </section>
        </div>
      ) : null}

      {isMixOpen ? (
        <div className="fixed inset-0 z-[60] grid place-items-end bg-black/65 px-3 py-4 backdrop-blur-sm">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="custom-mix-title"
            className="w-full max-w-md rounded-[8px] border border-white/10 bg-[#10161d] p-4 shadow-2xl shadow-black/50"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">
                  Custom Mix
                </p>
                <h2
                  id="custom-mix-title"
                  className="mt-1 text-2xl font-black leading-tight"
                >
                  Create mix
                </h2>
              </div>
              <button
                type="button"
                aria-label="Close custom mix"
                onClick={() => setIsMixOpen(false)}
                className="grid h-10 w-10 place-items-center rounded-full bg-white/[0.06] text-lg font-black text-white/48 transition hover:text-white"
              >
                x
              </button>
            </div>

            <form onSubmit={handleMixSubmit} className="mt-5 grid gap-4">
              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-[0.18em] text-white/42">
                  Mix name
                </span>
                <input
                  value={mixName}
                  onChange={(event) => setMixName(event.target.value)}
                  placeholder="e.g. Dried Blood Shadow"
                  className="h-12 rounded-[8px] border border-white/10 bg-black/24 px-4 text-sm font-semibold text-white outline-none transition placeholder:text-white/25 focus:border-cyan-300/70"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-[0.18em] text-white/42">
                  Base paint
                </span>
                <select
                  value={mixBase}
                  onChange={(event) => setMixBase(event.target.value)}
                  className="h-12 rounded-[8px] border border-white/10 bg-black/24 px-4 text-sm font-semibold text-white outline-none transition focus:border-cyan-300/70"
                >
                  {allPaints.slice(0, 9).map((paint) => (
                    <option key={paint.id}>{paint.name}</option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-[0.18em] text-white/42">
                  Formula
                </span>
                <textarea
                  rows={3}
                  placeholder="2 drops base, 1 drop black, glaze medium"
                  className="resize-none rounded-[8px] border border-white/10 bg-black/24 px-4 py-3 text-sm font-semibold text-white outline-none transition placeholder:text-white/25 focus:border-cyan-300/70"
                />
              </label>

              <button
                type="submit"
                className="h-12 rounded-[8px] bg-cyan-300 text-sm font-black text-black transition hover:bg-cyan-200"
              >
                Save preview mix
              </button>
            </form>
          </section>
        </div>
      ) : null}

      {activeGuide !== null && activeGuideIndex !== null ? (
        <FeatureGuideTour
          activeIndex={activeGuideIndex}
          guide={activeGuide}
          guides={featureGuides}
          onClose={() => setActiveGuideIndex(null)}
          onNext={() =>
            setActiveGuideIndex((current) =>
              findVisibleFeatureGuideIndex(featureGuides, current, 1) ??
              current ??
              0
            )
          }
          onPrevious={() =>
            setActiveGuideIndex((current) =>
              findVisibleFeatureGuideIndex(featureGuides, current, -1) ??
              current ??
              0
            )
          }
          totalGuides={featureGuides.length}
        />
      ) : null}
    </main>
  )
}

function TopNav({
  isHelpOpen,
  onCreate,
  onHelpToggle,
}: {
  isHelpOpen: boolean
  onCreate: () => void
  onHelpToggle: () => void
}) {
  return (
    <header data-v3-paints-indicator="app-header">
      <AppHamburgerMenu
        data-v3-paints-indicator="menu-control"
        aria-label="Open paint vault menu"
      />

      <h1
        data-v3-paints-indicator="app-title"
        data-feature-guide-target="paints.page"
      >
        Wet Palette
      </h1>

      <div data-v3-paints-indicator="app-header-actions">
        <button
          type="button"
          aria-expanded={isHelpOpen}
          aria-controls="paints-help"
          aria-label="About paint vault"
          onClick={onHelpToggle}
          data-feature-guide-target="paints.help"
          data-feature-guide-launcher-button="true"
        >
          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" aria-hidden="true">
            <path d="M9.6 9a2.6 2.6 0 0 1 4.95 1.15c0 1.75-1.55 2.25-2.25 3.3-.22.33-.3.68-.3 1.05" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
            <path d="M12 18h.01" stroke="currentColor" strokeLinecap="round" strokeWidth="2.6" />
          </svg>
        </button>
        <button
          type="button"
          aria-label="Create custom mix"
          onClick={onCreate}
          data-feature-guide-target="paints.create_custom_mix"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
          </svg>
        </button>
      </div>
    </header>
  )
}

function PaintDaubCell({
  isSelected,
  onSelect,
  paint,
}: {
  isSelected: boolean
  onSelect: () => void
  paint: PaintRecord
}) {
  const label = `${paint.name}, ${paint.brand}`

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={isSelected}
      aria-label={label}
      title={label}
      data-v3-paints-indicator="paint-swatch"
      className={paletteStyles.daubCell}
    >
      <span className={paletteStyles.daubShapeWrap}>
        <PaintDaub seed={paint.id} color={paint.color} className={paletteStyles.daubSvg} />

        {paint.owned || paint.wish ? (
          <Image
            src={
              paint.owned
                ? '/paints/wet-palette/owned-pill.svg'
                : '/paints/wet-palette/wishlist-pill.svg'
            }
            alt={paint.owned ? 'Owned' : 'Wishlist'}
            width={88}
            height={44}
            loading="eager"
            className={paletteStyles.statusPill}
            data-v3-paints-indicator="paint-state-badge"
          />
        ) : null}
      </span>

      <span className={paletteStyles.daubLabel}>
        <span className={paletteStyles.daubName}>{paint.name}</span>
        <span className={paletteStyles.daubBrand}>{paint.brand}</span>
      </span>
    </button>
  )
}

function PaintInfoPanel({
  onToggleOwned,
  onToggleWishlist,
  paint,
  pendingAction,
}: {
  onToggleOwned: () => void
  onToggleWishlist: () => void
  paint: PaintRecord
  pendingAction?: PaintOwnershipAction
}) {
  const isCustomPaint = isCustomPaintId(paint.id)
  const isOwnedPending = pendingAction === 'owned'
  const isWishlistPending = pendingAction === 'wishlist'

  return (
    <aside
      className="fixed inset-x-2 bottom-16 z-40 mx-auto max-w-md overflow-hidden rounded-[8px] border border-cyan-300/18 bg-[#10161d]/96 shadow-2xl shadow-black/50 backdrop-blur"
      data-v3-paints-indicator="paint-info-panel"
      data-feature-guide-target="paints.paint_info_panel"
    >
      <div className="grid grid-cols-[64px_1fr]">
        <div
          className="relative overflow-hidden"
          style={{ backgroundColor: paint.color }}
        >
          {paint.swatchImageUrl ? (
            <Image
              src={paint.swatchImageUrl}
              alt=""
              fill
              sizes="64px"
              className="object-cover"
            />
          ) : null}
        </div>
        <div className="min-w-0 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-sm font-black uppercase text-white">
                {paint.name}
              </h2>
              <p className="mt-1 text-[10px] font-bold text-white/36">
                {paint.line}
              </p>
            </div>
            <div
              className="grid shrink-0 grid-cols-2 gap-2"
              data-v3-paints-indicator="ownership-actions"
            >
              <button
                type="button"
                onClick={onToggleOwned}
                disabled={isCustomPaint}
                aria-pressed={paint.owned}
                aria-busy={isOwnedPending || undefined}
                className={[
                  'rounded-full border px-3 py-1 text-[10px] font-black transition disabled:cursor-not-allowed disabled:opacity-55',
                  paint.owned
                    ? 'border-cyan-300/45 bg-cyan-300/10 text-cyan-300'
                    : 'border-white/10 bg-white/[0.04] text-white/44 hover:border-cyan-300/40 hover:text-cyan-200',
                ].join(' ')}
              >
                {paint.owned ? 'Owned' : 'Not owned'}
              </button>
              <button
                type="button"
                onClick={onToggleWishlist}
                disabled={isCustomPaint}
                aria-pressed={paint.wish}
                aria-busy={isWishlistPending || undefined}
                className={[
                  'rounded-full border px-3 py-1 text-[10px] font-black transition disabled:cursor-not-allowed disabled:opacity-55',
                  paint.wish
                    ? 'border-fuchsia-300/45 bg-fuchsia-300/10 text-fuchsia-200'
                    : 'border-white/10 bg-white/[0.04] text-white/44 hover:border-fuchsia-300/40 hover:text-fuchsia-100',
                ].join(' ')}
              >
                {paint.wish ? 'Wishlisted' : 'Wishlist'}
              </button>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-4 gap-2 text-[9px] font-black text-white/34">
            <InfoPair label="Brand" value={paint.brand} />
            <InfoPair label="Line" value={paint.line} />
            <InfoPair label="Finish" value={paint.finish} />
            <InfoPair label="Size" value={paint.size} />
          </div>

          <p className="mt-2 line-clamp-2 text-[10px] font-semibold leading-4 text-white/46">
            {paint.notes}
          </p>

          <button
            className="mt-2 h-8 w-full rounded-[8px] border border-white/10 bg-black/20 text-[10px] font-black text-white/52 transition hover:border-cyan-300/45 hover:text-cyan-300"
            data-v3-paints-indicator="paint-details-button"
          >
            View Details -&gt;
          </button>
        </div>
      </div>
    </aside>
  )
}

function InfoPair({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="uppercase tracking-[0.12em]">{label}</p>
      <p className="mt-1 truncate text-white/62">{value}</p>
    </div>
  )
}
