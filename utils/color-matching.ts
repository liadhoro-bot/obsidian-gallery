import { Vibrant } from 'node-vibrant/node'

export type PaintCatalogColor = {
  id: string
  hex_approx: string | null
  color_match_enabled?: boolean | null
}

type FindNearestPaintOptions = {
  excludePaintIds?: Set<string>
  requireEnabled?: boolean
}

type ClosestPaintMatch<TPaint extends PaintCatalogColor> = {
  paint: TPaint
  distance: number
}

const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/

export function isUsableColorHex(hex: string | null | undefined): hex is string {
  return Boolean(hex && HEX_COLOR_PATTERN.test(hex))
}

function hexToRgb(hex: string) {
  const clean = hex.replace('#', '')

  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  }
}

function colorDistance(hexA: string, hexB: string) {
  const a = hexToRgb(hexA)
  const b = hexToRgb(hexB)

  return Math.sqrt(
    Math.pow(a.r - b.r, 2) +
      Math.pow(a.g - b.g, 2) +
      Math.pow(a.b - b.b, 2)
  )
}

export function findNearestPaint<TPaint extends PaintCatalogColor>(
  extractedHex: string,
  catalogColors: TPaint[],
  options: FindNearestPaintOptions = {}
) {
  return findClosestPaints(extractedHex, catalogColors, {
    ...options,
    limit: 1,
  })[0]?.paint ?? null
}

export function findClosestPaints<TPaint extends PaintCatalogColor>(
  extractedHex: string,
  catalogColors: TPaint[],
  options: FindNearestPaintOptions & { limit?: number } = {}
) {
  if (!isUsableColorHex(extractedHex)) {
    return []
  }

  const requireEnabled = options.requireEnabled ?? true
  const limit = Math.max(1, options.limit ?? 24)
  const matches: ClosestPaintMatch<TPaint>[] = []

  for (const paint of catalogColors) {
    if (options.excludePaintIds?.has(paint.id)) continue
    if (requireEnabled && paint.color_match_enabled === false) continue
    if (!isUsableColorHex(paint.hex_approx)) continue

    matches.push({
      paint,
      distance: colorDistance(extractedHex, paint.hex_approx),
    })
  }

  return matches.sort((a, b) => a.distance - b.distance).slice(0, limit)
}

export function findNearestUniquePaints<TPaint extends PaintCatalogColor>(
  extractedHexes: string[],
  catalogColors: TPaint[],
  limit = 5
) {
  const usedPaintIds = new Set<string>()
  const matches: TPaint[] = []

  for (const hex of extractedHexes) {
    const nearestPaint = findNearestPaint(hex, catalogColors, {
      excludePaintIds: usedPaintIds,
    })

    if (!nearestPaint?.id) continue

    usedPaintIds.add(nearestPaint.id)
    matches.push(nearestPaint)

    if (matches.length >= limit) break
  }

  return matches
}

export async function extractPaletteFromImage(imageUrl: string) {
  const palette = await Vibrant.from(imageUrl).getPalette()

  const candidates = [
    palette.Muted?.hex,
    palette.DarkMuted?.hex,
    palette.LightMuted?.hex,
    palette.Vibrant?.hex,
    palette.DarkVibrant?.hex,
    palette.LightVibrant?.hex,
  ].filter(Boolean) as string[]

  return Array.from(new Set(candidates)).slice(0, 5)
}
