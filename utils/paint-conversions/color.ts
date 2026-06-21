const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/

export type LabColor = {
  l: number
  a: number
  b: number
}

export type RgbColor = {
  r: number
  g: number
  b: number
}

export function isUsableHex(hex: string | null | undefined): hex is string {
  return Boolean(hex && HEX_COLOR_PATTERN.test(hex))
}

export function hexToRgb(hex: string): RgbColor {
  const clean = hex.replace('#', '')

  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  }
}

function pivotRgb(channel: number) {
  const value = channel / 255

  return value > 0.04045
    ? Math.pow((value + 0.055) / 1.055, 2.4)
    : value / 12.92
}

function pivotXyz(value: number) {
  return value > 0.008856 ? Math.cbrt(value) : 7.787 * value + 16 / 116
}

export function rgbToLab({ r, g, b }: RgbColor): LabColor {
  const linearR = pivotRgb(r)
  const linearG = pivotRgb(g)
  const linearB = pivotRgb(b)

  const x = (linearR * 0.4124 + linearG * 0.3576 + linearB * 0.1805) / 0.95047
  const y = linearR * 0.2126 + linearG * 0.7152 + linearB * 0.0722
  const z = (linearR * 0.0193 + linearG * 0.1192 + linearB * 0.9505) / 1.08883

  const fx = pivotXyz(x)
  const fy = pivotXyz(y)
  const fz = pivotXyz(z)

  return {
    l: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  }
}

export function hexToLab(hex: string): LabColor {
  return rgbToLab(hexToRgb(hex))
}

export function deltaE(labA: LabColor, labB: LabColor) {
  return Math.sqrt(
    Math.pow(labA.l - labB.l, 2) +
      Math.pow(labA.a - labB.a, 2) +
      Math.pow(labA.b - labB.b, 2)
  )
}

export function rgbDistance(hexA: string, hexB: string) {
  const a = hexToRgb(hexA)
  const b = hexToRgb(hexB)

  return Math.sqrt(
    Math.pow(a.r - b.r, 2) +
      Math.pow(a.g - b.g, 2) +
      Math.pow(a.b - b.b, 2)
  )
}

export function deltaEToSimilarityScore(distance: number) {
  if (!Number.isFinite(distance)) return 0

  return Math.max(0, Math.min(1, 1 - distance / 35))
}
