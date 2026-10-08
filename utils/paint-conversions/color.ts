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

const RADIANS = Math.PI / 180

// CIEDE2000 colour difference. Unlike CIE76 (deltaE above) it tracks
// perceived difference evenly across hue and lightness, so a fixed
// threshold means roughly the same "how close does it look" everywhere.
// lightnessWeight is the standard kL factor: 2 discounts lightness, which suits
// transparent paints whose swatches vary in strength from brand to brand.
export function deltaE2000(labA: LabColor, labB: LabColor, lightnessWeight = 1) {
  const c1 = Math.hypot(labA.a, labA.b)
  const c2 = Math.hypot(labB.a, labB.b)
  const meanC = (c1 + c2) / 2
  const g = 0.5 * (1 - Math.sqrt(meanC ** 7 / (meanC ** 7 + 25 ** 7)))
  const a1 = labA.a * (1 + g)
  const a2 = labB.a * (1 + g)
  const cp1 = Math.hypot(a1, labA.b)
  const cp2 = Math.hypot(a2, labB.b)
  const hp1 = cp1 === 0 ? 0 : (Math.atan2(labA.b, a1) / RADIANS + 360) % 360
  const hp2 = cp2 === 0 ? 0 : (Math.atan2(labB.b, a2) / RADIANS + 360) % 360

  const deltaL = labB.l - labA.l
  const deltaC = cp2 - cp1
  let deltaHue = 0
  if (cp1 * cp2 !== 0) {
    deltaHue = hp2 - hp1
    if (deltaHue > 180) deltaHue -= 360
    else if (deltaHue < -180) deltaHue += 360
  }
  const deltaH = 2 * Math.sqrt(cp1 * cp2) * Math.sin((deltaHue / 2) * RADIANS)

  const meanL = (labA.l + labB.l) / 2
  const meanCp = (cp1 + cp2) / 2
  let meanH = hp1 + hp2
  if (cp1 * cp2 !== 0) {
    if (Math.abs(hp1 - hp2) > 180) meanH += hp1 + hp2 < 360 ? 360 : -360
    meanH /= 2
  }

  const t =
    1 -
    0.17 * Math.cos((meanH - 30) * RADIANS) +
    0.24 * Math.cos(2 * meanH * RADIANS) +
    0.32 * Math.cos((3 * meanH + 6) * RADIANS) -
    0.2 * Math.cos((4 * meanH - 63) * RADIANS)
  const sl = 1 + (0.015 * (meanL - 50) ** 2) / Math.sqrt(20 + (meanL - 50) ** 2)
  const sc = 1 + 0.045 * meanCp
  const sh = 1 + 0.015 * meanCp * t
  const rt =
    -2 *
    Math.sqrt(meanCp ** 7 / (meanCp ** 7 + 25 ** 7)) *
    Math.sin(60 * Math.exp(-(((meanH - 275) / 25) ** 2)) * RADIANS)

  return Math.sqrt(
    (deltaL / (lightnessWeight * sl)) ** 2 +
      (deltaC / sc) ** 2 +
      (deltaH / sh) ** 2 +
      rt * (deltaC / sc) * (deltaH / sh)
  )
}
