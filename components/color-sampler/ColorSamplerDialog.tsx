'use client'

import { useEffect, useState } from 'react'
import { capturePostHog } from '../../utils/analytics/client'
import ColorSamplerCanvas from './ColorSamplerCanvas'
import ColorSamplerToolbar from './ColorSamplerToolbar'
import ImageSourcePicker from './ImageSourcePicker'
import type {
  ColorSamplerImageSource,
  ColorSamplerSource,
  SampledImageColor,
} from './types'
import { useColorSampler } from './useColorSampler'

type ColorSamplerDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  imageSource?: ColorSamplerImageSource
  source: ColorSamplerSource
  allowImageUpload?: boolean
  allowCameraCapture?: boolean
  onConfirm: (sample: SampledImageColor) => void
}

export default function ColorSamplerDialog({
  open,
  onOpenChange,
  imageSource,
  source,
  allowImageUpload = true,
  allowCameraCapture = true,
  onConfirm,
}: ColorSamplerDialogProps) {
  const [sample, setSample] = useState<SampledImageColor | null>(null)
  const [sampleImageKey, setSampleImageKey] = useState<string | null>(null)
  const {
    workingImage,
    status,
    error,
    setError,
    loadFile,
    clearWorkingImage,
  } = useColorSampler({
    imageSource,
    imageSourceType: source,
    open,
  })

  useEffect(() => {
    if (!open) return
    void capturePostHog('color_sampler_opened', {
      source,
      input_method: imageSource ? 'existing_image' : undefined,
    })
  }, [imageSource, open, source])

  if (!open) return null

  const hasInitialImage = Boolean(imageSource?.src)
  const currentImageKey = workingImage?.objectUrl ?? null
  const visibleSample = sampleImageKey === currentImageKey ? sample : null

  function closeDialog() {
    setSample(null)
    setSampleImageKey(null)
    onOpenChange(false)
  }

  return (
    <div
      className="mobile-sheet-overlay fixed inset-0 z-[60] flex justify-center bg-black/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="color-sampler-title"
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      onMouseUp={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      onPointerMove={(event) => event.stopPropagation()}
      onPointerUp={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (event.key === 'Escape') closeDialog()
      }}
    >
      <div
        className="mobile-sheet flex max-w-4xl flex-col rounded-3xl border border-cyan-300/20 bg-[#081018] p-5 shadow-[0_0_44px_rgba(34,211,238,0.18)]"
        onClick={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
        onMouseUp={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        onPointerMove={(event) => event.stopPropagation()}
        onPointerUp={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300">
              Color sampler
            </p>
            <h2 id="color-sampler-title" className="mt-2 text-2xl font-black text-white">
              Sample from Image
            </h2>
          </div>

          <button
            type="button"
            onClick={closeDialog}
            className="tap-press mobile-close-button flex items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-lg font-bold text-white/70 hover:bg-white/[0.08] hover:text-white"
            aria-label="Close image color sampler"
          >
            x
          </button>
        </div>

        <div className="mobile-scroll mt-5 min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          {!workingImage ? (
            <ImageSourcePicker
              allowImageUpload={allowImageUpload}
              allowCameraCapture={allowCameraCapture}
              disabled={status === 'loading'}
              onFileSelected={(file, method) => {
                const inputSource =
                  method === 'camera' ? 'vault_camera' : 'vault_upload'
                void capturePostHog('color_sampler_image_selected', {
                  source: inputSource,
                  input_method: method,
                })
                setSample(null)
                setSampleImageKey(null)
                void loadFile(file, inputSource)
              }}
            />
          ) : null}

          {status === 'loading' ? (
            <p
              className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-4 text-sm font-semibold text-cyan-100"
              aria-live="polite"
            >
              Preparing image for sampling...
            </p>
          ) : null}

          {error ? (
            <p
              className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm font-semibold text-red-100"
              aria-live="polite"
            >
              {error}
            </p>
          ) : null}

          {workingImage ? (
            <ColorSamplerCanvas
              image={workingImage}
              onSampleChange={(nextSample) => {
                setError(null)
                setSample(nextSample)
                setSampleImageKey(workingImage.objectUrl)
              }}
              onError={(message) => {
                setError(message)
                void capturePostHog('color_sampler_failed', {
                  source,
                })
              }}
            />
          ) : status !== 'loading' && hasInitialImage ? (
            <p className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-white/60">
              Loading the selected image.
            </p>
          ) : null}
        </div>

        <div className="mt-4">
          <ColorSamplerToolbar
            sample={visibleSample}
            canReplace={allowImageUpload || allowCameraCapture}
            onReplace={() => {
              clearWorkingImage()
              setSample(null)
              setSampleImageKey(null)
              setError(null)
            }}
            onConfirm={() => {
              if (!visibleSample) return
              void capturePostHog('color_sampler_match_requested', {
                source,
                sampled_hex: visibleSample.hex,
                sample_radius: visibleSample.sampleRadius,
                image_width: workingImage?.width,
                image_height: workingImage?.height,
              })
              onConfirm(visibleSample)
            }}
          />
        </div>
      </div>
    </div>
  )
}
