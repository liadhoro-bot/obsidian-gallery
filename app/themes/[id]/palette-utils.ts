import { Vibrant } from 'node-vibrant/node'

type PaintCatalogColor = {
  id: string
  hex_approx: string | null
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

export function findNearestPaint(
  extractedHex: string,
  catalogColors: PaintCatalogColor[]
) {
  const validCatalogColors = catalogColors.filter(
    (paint) => paint.hex_approx && paint.hex_approx.startsWith('#')
  )

  let bestMatch = validCatalogColors[0]
  let bestDistance = Infinity

  for (const paint of validCatalogColors) {
    if (!paint.hex_approx) continue

    const distance = colorDistance(extractedHex, paint.hex_approx)

    if (distance < bestDistance) {
      bestDistance = distance
      bestMatch = paint
    }
  }

  return bestMatch
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