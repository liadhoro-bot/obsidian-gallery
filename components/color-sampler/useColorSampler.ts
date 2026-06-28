'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  ColorSamplerImageSource,
  ColorSamplerSource,
  ColorSamplerStatus,
} from './types'
import { getResizedImageDimensions, MAX_WORKING_IMAGE_EDGE } from './color-sampling-utils'

type WorkingImage = {
  objectUrl: string
  width: number
  height: number
  alt: string
}

function isRemoteUrl(src: string) {
  return /^https?:\/\//i.test(src)
}

async function decodeImage(src: string) {
  if ('createImageBitmap' in window) {
    const response = await fetch(src)
    const blob = await response.blob()
    return createImageBitmap(blob, {
      imageOrientation: 'from-image',
    } as ImageBitmapOptions)
  }

  const image = new Image()
  image.decoding = 'async'
  image.src = src
  await image.decode()
  return image
}

async function buildWorkingImage(
  src: string,
  alt: string,
  signal: AbortSignal
): Promise<WorkingImage> {
  let localUrl = src
  let shouldRevokeLocalUrl = false

  if (isRemoteUrl(src)) {
    const response = await fetch(src, { signal })

    if (!response.ok) {
      throw new Error('remote-image-fetch-failed')
    }

    const blob = await response.blob()
    localUrl = URL.createObjectURL(blob)
    shouldRevokeLocalUrl = true
  }

  const decoded = await decodeImage(localUrl)

  if (signal.aborted) {
    if (shouldRevokeLocalUrl) URL.revokeObjectURL(localUrl)
    if ('close' in decoded) decoded.close()
    throw new Error('image-load-aborted')
  }

  const sourceWidth = decoded.width
  const sourceHeight = decoded.height

  if (!sourceWidth || !sourceHeight) {
    if (shouldRevokeLocalUrl) URL.revokeObjectURL(localUrl)
    if ('close' in decoded) decoded.close()
    throw new Error('image-decode-failed')
  }

  const dimensions = getResizedImageDimensions(
    sourceWidth,
    sourceHeight,
    MAX_WORKING_IMAGE_EDGE
  )
  const canvas = document.createElement('canvas')
  canvas.width = dimensions.width
  canvas.height = dimensions.height
  const context = canvas.getContext('2d', { willReadFrequently: true })

  if (!context) {
    if (shouldRevokeLocalUrl) URL.revokeObjectURL(localUrl)
    if ('close' in decoded) decoded.close()
    throw new Error('canvas-context-missing')
  }

  context.drawImage(decoded, 0, 0, dimensions.width, dimensions.height)

  if ('close' in decoded) decoded.close()
  if (shouldRevokeLocalUrl) URL.revokeObjectURL(localUrl)

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/png')
  )

  if (!blob) {
    throw new Error('working-image-encode-failed')
  }

  return {
    objectUrl: URL.createObjectURL(blob),
    width: dimensions.width,
    height: dimensions.height,
    alt,
  }
}

export function useColorSampler({
  imageSource,
  imageSourceType,
  open,
}: {
  imageSource?: ColorSamplerImageSource
  imageSourceType?: ColorSamplerSource
  open: boolean
}) {
  const [workingImage, setWorkingImage] = useState<WorkingImage | null>(null)
  const [status, setStatus] = useState<ColorSamplerStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const objectUrlRef = useRef<string | null>(null)

  const clearWorkingImage = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }

    setWorkingImage(null)
  }, [])

  const loadSource = useCallback(
    async (
      source: ColorSamplerImageSource,
      analyticsSource?: ColorSamplerSource
    ) => {
      clearWorkingImage()
      setStatus('loading')
      setError(null)

      const abortController = new AbortController()
      abortRef.current = abortController

      try {
        const nextImage = await buildWorkingImage(
          source.src,
          source.alt || 'Selected image',
          abortController.signal
        )

        if (abortController.signal.aborted) {
          URL.revokeObjectURL(nextImage.objectUrl)
          return
        }

        objectUrlRef.current = nextImage.objectUrl
        setWorkingImage(nextImage)
        setStatus('ready')
        return {
          width: nextImage.width,
          height: nextImage.height,
          source: analyticsSource,
        }
      } catch (loadError) {
        if (abortController.signal.aborted) return
        console.error('Color sampler image load failed', loadError)
        setStatus('error')
        setError(
          isRemoteUrl(source.src)
            ? 'This image could not be sampled. Try downloading or re-uploading it.'
            : 'This image could not be opened. Choose a different image.'
        )
      }
    },
    [clearWorkingImage]
  )

  const loadFile = useCallback(
    async (file: File, source: ColorSamplerSource) => {
      if (!file.type.startsWith('image/')) {
        setStatus('error')
        setError('Choose a valid image file.')
        return
      }

      const sourceUrl = URL.createObjectURL(file)

      try {
        return await loadSource({ src: sourceUrl, alt: file.name }, source)
      } finally {
        URL.revokeObjectURL(sourceUrl)
      }
    },
    [loadSource]
  )

  useEffect(() => {
    if (!open) {
      clearWorkingImage()
      setStatus('idle')
      setError(null)
    }
  }, [clearWorkingImage, open])

  useEffect(() => {
    if (open && imageSource?.src) {
      void loadSource(imageSource, imageSourceType)
    }
  }, [imageSource, imageSourceType, loadSource, open])

  useEffect(() => clearWorkingImage, [clearWorkingImage])

  return {
    workingImage,
    status,
    error,
    setError,
    loadFile,
    loadSource,
    clearWorkingImage,
  }
}
