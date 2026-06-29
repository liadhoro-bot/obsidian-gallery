'use client'

import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import { useState, useTransition } from 'react'
import { buildVaultColorMatchHref } from './color-match-navigation'
import EyedropperIcon from './EyedropperIcon'
import type { ColorSamplerSource, SampledImageColor } from './types'

const ColorSamplerDialog = dynamic(() => import('./ColorSamplerDialog'), {
  ssr: false,
})

type SampleColorFromImageActionProps = {
  imageSrc: string
  imageAlt?: string
  sourceType: Exclude<ColorSamplerSource, 'vault_upload' | 'vault_camera'>
  sourceId?: string
  onColorConfirmed?: (sample: SampledImageColor) => void
  label?: string
}

export default function SampleColorFromImageAction({
  imageSrc,
  imageAlt,
  sourceType,
  sourceId,
  onColorConfirmed,
  label = 'Sample Color',
}: SampleColorFromImageActionProps) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const canPortal = typeof document !== 'undefined'

  return (
    <>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          setOpen(true)
        }}
        onMouseDown={(event) => event.stopPropagation()}
        onMouseUp={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        onPointerUp={(event) => event.stopPropagation()}
        className="tap-press inline-flex h-9 w-9 items-center justify-center rounded-full border border-cyan-300/40 bg-black/70 text-cyan-100 shadow-lg backdrop-blur transition hover:bg-cyan-300/15 focus:outline-none focus:ring-2 focus:ring-cyan-300/70"
        aria-label={`${label} from image`}
        title={label}
        data-source-id={sourceId}
      >
        <EyedropperIcon />
      </button>

      {open && canPortal
        ? createPortal(
            <ColorSamplerDialog
              open={open}
              onOpenChange={setOpen}
              imageSource={{ src: imageSrc, alt: imageAlt }}
              source={sourceType}
              allowCameraCapture={false}
              allowImageUpload={false}
              onConfirm={(sample) => {
                onColorConfirmed?.(sample)
                setOpen(false)
                startTransition(() => {
                  router.push(buildVaultColorMatchHref(sample))
                })
              }}
            />,
            document.body
          )
        : null}
    </>
  )
}
