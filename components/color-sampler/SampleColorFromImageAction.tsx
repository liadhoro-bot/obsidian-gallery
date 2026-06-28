'use client'

import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import { useState, useTransition } from 'react'
import { buildVaultColorMatchHref } from './color-match-navigation'
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
        className="tap-press inline-flex items-center justify-center gap-2 rounded-full border border-cyan-300/35 bg-black/70 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-cyan-100 backdrop-blur transition hover:bg-cyan-300/15"
        aria-label={`${label} from image`}
        data-source-id={sourceId}
      >
        <span aria-hidden="true">◎</span>
        {label}
      </button>

      {open && canPortal ? createPortal(
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
      ) : null}
    </>
  )
}
