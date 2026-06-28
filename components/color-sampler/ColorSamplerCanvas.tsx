'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import SamplingLoupe from './SamplingLoupe'
import type { SampledImageColor } from './types'
import {
  DEFAULT_SAMPLE_RADIUS,
  getContainImageMetrics,
  imagePointToRenderedPoint,
  renderedPointToImagePoint,
  rgbToHex,
  sampleRegion,
} from './color-sampling-utils'

type Props = {
  image: {
    objectUrl: string
    width: number
    height: number
    alt: string
  }
  sampleRadius?: number
  onSampleChange: (sample: SampledImageColor) => void
  onError: (message: string) => void
}

export default function ColorSamplerCanvas({
  image,
  sampleRadius = DEFAULT_SAMPLE_RADIUS,
  onSampleChange,
  onError,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const imageDataRef = useRef<ImageData | null>(null)
  const pendingPointRef = useRef<{
    clientX: number
    clientY: number
    commit: boolean
  } | null>(null)
  const rafRef = useRef<number | null>(null)
  const [canvasSize, setCanvasSize] = useState({ width: 1, height: 1 })
  const [previewSample, setPreviewSample] = useState<SampledImageColor | null>(
    null
  )
  const [lockedSample, setLockedSample] = useState<SampledImageColor | null>(
    null
  )
  const [previewPointer, setPreviewPointer] = useState<{
    x: number
    y: number
  } | null>(null)
  const [lockedPointer, setLockedPointer] = useState<{
    x: number
    y: number
  } | null>(null)

  const metrics = useMemo(
    () =>
      getContainImageMetrics({
        canvasWidth: canvasSize.width,
        canvasHeight: canvasSize.height,
        imageWidth: image.width,
        imageHeight: image.height,
      }),
    [canvasSize.height, canvasSize.width, image.height, image.width]
  )

  const drawCanvas = useCallback(async () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) {
      onError('This browser could not start image sampling.')
      return
    }

    const img = new Image()
    img.decoding = 'async'
    img.src = image.objectUrl

    try {
      await img.decode()
      context.clearRect(0, 0, canvas.width, canvas.height)
      context.drawImage(
        img,
        metrics.renderedLeft,
        metrics.renderedTop,
        metrics.renderedWidth,
        metrics.renderedHeight
      )
      imageDataRef.current = context.getImageData(0, 0, canvas.width, canvas.height)
    } catch (error) {
      console.error('Color sampler canvas draw failed', error)
      onError('This image could not be sampled. Try downloading or re-uploading it.')
    }
  }, [image.objectUrl, metrics, onError])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const updateSize = () => {
      const rect = canvas.getBoundingClientRect()
      const width = Math.max(1, Math.round(rect.width))
      const height = Math.max(1, Math.round(rect.height))
      canvas.width = width
      canvas.height = height
      setCanvasSize({ width, height })
    }

    updateSize()
    const observer = new ResizeObserver(updateSize)
    observer.observe(canvas)

    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    void drawCanvas()
  }, [drawCanvas])

  function sampleAtClientPoint(
    clientX: number,
    clientY: number,
    commit: boolean
  ) {
    const canvas = canvasRef.current
    const imageData = imageDataRef.current

    if (!canvas || !imageData) return

    const rect = canvas.getBoundingClientRect()
    const canvasPoint = {
      x: clientX - rect.left,
      y: clientY - rect.top,
    }
    const imagePoint = renderedPointToImagePoint(canvasPoint, metrics)

    if (!imagePoint) return

    const renderedPoint = imagePointToRenderedPoint(imagePoint, metrics)
    const rgb = sampleRegion(imageData, renderedPoint.x, renderedPoint.y, sampleRadius)

    if (!rgb) {
      onError('This part of the image has no visible color to sample.')
      return
    }

    const nextSample: SampledImageColor = {
      hex: rgbToHex(rgb),
      rgb,
      imagePosition: imagePoint,
      normalizedPosition: {
        x: imagePoint.x / image.width,
        y: imagePoint.y / image.height,
      },
      sampleRadius,
    }

    if (commit) {
      setLockedPointer(canvasPoint)
      setLockedSample(nextSample)
      setPreviewPointer(canvasPoint)
      setPreviewSample(nextSample)
      onSampleChange(nextSample)
      return
    }

    if (!lockedSample) {
      setPreviewPointer(canvasPoint)
      setPreviewSample(nextSample)
    }
  }

  function scheduleSample(clientX: number, clientY: number, commit = false) {
    pendingPointRef.current = { clientX, clientY, commit }

    if (rafRef.current !== null) return

    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null
      const point = pendingPointRef.current
      if (point) {
        sampleAtClientPoint(point.clientX, point.clientY, point.commit)
      }
    })
  }

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current)
    }
  }, [])

  const visibleSample = lockedSample ?? previewSample
  const visiblePointer = lockedPointer ?? previewPointer

  return (
    <div className="relative min-h-[42dvh] overflow-hidden rounded-3xl border border-white/10 bg-black">
      <canvas
        ref={canvasRef}
        className="h-[58dvh] max-h-[620px] min-h-[340px] w-full touch-none cursor-crosshair"
        role="img"
        aria-label={`Image color sampling area for ${image.alt}. Move over, tap, or drag on the image to sample a color.`}
        onPointerEnter={(event) => {
          scheduleSample(event.clientX, event.clientY)
        }}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId)
          scheduleSample(event.clientX, event.clientY, true)
        }}
        onPointerMove={(event) => {
          scheduleSample(
            event.clientX,
            event.clientY,
            event.currentTarget.hasPointerCapture(event.pointerId)
          )
        }}
        onPointerUp={(event) => {
          scheduleSample(event.clientX, event.clientY, true)
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId)
          }
        }}
        onMouseEnter={(event) => {
          scheduleSample(event.clientX, event.clientY)
        }}
        onMouseMove={(event) => {
          scheduleSample(event.clientX, event.clientY)
        }}
        onMouseDown={(event) => {
          event.preventDefault()
          scheduleSample(event.clientX, event.clientY, true)
        }}
        onMouseUp={(event) => {
          scheduleSample(event.clientX, event.clientY, true)
        }}
      />

      {visibleSample && visiblePointer ? (
        <span
          className="pointer-events-none absolute z-10 h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.65),0_0_18px_rgba(0,0,0,0.45)]"
          style={{
            left: visiblePointer.x,
            top: visiblePointer.y,
            backgroundColor: `${visibleSample.hex}55`,
          }}
          aria-hidden="true"
        >
          <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-white/80" />
          <span className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-white/80" />
        </span>
      ) : null}

      <SamplingLoupe
        sample={visibleSample}
        pointer={visiblePointer}
        containerSize={canvasSize}
      />
    </div>
  )
}
