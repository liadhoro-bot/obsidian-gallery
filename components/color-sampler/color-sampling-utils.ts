import type { CanvasImageMetrics } from './types'

export const DEFAULT_SAMPLE_RADIUS = 3
export const MAX_WORKING_IMAGE_EDGE = 1800

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

export function rgbToHex({
  r,
  g,
  b,
}: {
  r: number
  g: number
  b: number
}) {
  return `#${[r, g, b]
    .map((channel) =>
      clamp(Math.round(channel), 0, 255).toString(16).padStart(2, '0')
    )
    .join('')
    .toUpperCase()}`
}

export function getContainImageMetrics({
  canvasWidth,
  canvasHeight,
  imageWidth,
  imageHeight,
}: {
  canvasWidth: number
  canvasHeight: number
  imageWidth: number
  imageHeight: number
}): CanvasImageMetrics {
  const scale = Math.min(canvasWidth / imageWidth, canvasHeight / imageHeight)
  const renderedWidth = imageWidth * scale
  const renderedHeight = imageHeight * scale

  return {
    canvasWidth,
    canvasHeight,
    imageWidth,
    imageHeight,
    renderedLeft: (canvasWidth - renderedWidth) / 2,
    renderedTop: (canvasHeight - renderedHeight) / 2,
    renderedWidth,
    renderedHeight,
  }
}

export function renderedPointToImagePoint(
  point: { x: number; y: number },
  metrics: CanvasImageMetrics
) {
  const localX = point.x - metrics.renderedLeft
  const localY = point.y - metrics.renderedTop

  if (
    localX < 0 ||
    localY < 0 ||
    localX > metrics.renderedWidth ||
    localY > metrics.renderedHeight
  ) {
    return null
  }

  return {
    x: clamp(
      Math.round((localX / metrics.renderedWidth) * metrics.imageWidth),
      0,
      metrics.imageWidth - 1
    ),
    y: clamp(
      Math.round((localY / metrics.renderedHeight) * metrics.imageHeight),
      0,
      metrics.imageHeight - 1
    ),
  }
}

export function imagePointToRenderedPoint(
  point: { x: number; y: number },
  metrics: CanvasImageMetrics
) {
  return {
    x: metrics.renderedLeft + (point.x / metrics.imageWidth) * metrics.renderedWidth,
    y: metrics.renderedTop + (point.y / metrics.imageHeight) * metrics.renderedHeight,
  }
}

export function sampleRegion(
  imageData: ImageData,
  centerX: number,
  centerY: number,
  radius = DEFAULT_SAMPLE_RADIUS
) {
  const colors: Array<{ r: number; g: number; b: number; brightness: number }> = []
  const minX = Math.max(0, Math.floor(centerX - radius))
  const maxX = Math.min(imageData.width - 1, Math.ceil(centerX + radius))
  const minY = Math.max(0, Math.floor(centerY - radius))
  const maxY = Math.min(imageData.height - 1, Math.ceil(centerY + radius))

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const offset = (y * imageData.width + x) * 4
      const alpha = imageData.data[offset + 3]

      if (alpha < 16) continue

      const r = imageData.data[offset]
      const g = imageData.data[offset + 1]
      const b = imageData.data[offset + 2]
      colors.push({
        r,
        g,
        b,
        brightness: r + g + b,
      })
    }
  }

  if (colors.length === 0) return null

  colors.sort((a, b) => a.brightness - b.brightness)

  const trimCount = colors.length >= 9 ? Math.floor(colors.length * 0.12) : 0
  const trimmed = colors.slice(trimCount, colors.length - trimCount || colors.length)
  const sortedR = trimmed.map((color) => color.r).sort((a, b) => a - b)
  const sortedG = trimmed.map((color) => color.g).sort((a, b) => a - b)
  const sortedB = trimmed.map((color) => color.b).sort((a, b) => a - b)
  const middle = Math.floor(trimmed.length / 2)

  return {
    r: sortedR[middle],
    g: sortedG[middle],
    b: sortedB[middle],
  }
}

export function getResizedImageDimensions(
  width: number,
  height: number,
  maxLongEdge = MAX_WORKING_IMAGE_EDGE
) {
  const longEdge = Math.max(width, height)

  if (longEdge <= maxLongEdge) {
    return { width, height }
  }

  const scale = maxLongEdge / longEdge
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}
