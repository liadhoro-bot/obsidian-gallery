'use client'

import Image from 'next/image'
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch'

export default function ZoomableGalleryImage({
  src,
  alt,
}: {
  src: string
  alt: string
}) {
  return (
    <TransformWrapper
      initialScale={1}
      minScale={1}
      maxScale={5}
      doubleClick={{ mode: 'zoomIn' }}
      pinch={{ disabled: false }}
      wheel={{ disabled: false }}
    >
      <TransformComponent
        wrapperClass="!h-full !w-full"
        contentClass="!h-full !w-full flex items-center justify-center"
      >
        <Image
          src={src}
          alt={alt}
          width={1400}
          height={1400}
          sizes="100vw"
          className="max-h-[92vh] max-w-full select-none rounded-2xl object-contain"
          draggable={false}
        />
      </TransformComponent>
    </TransformWrapper>
  )
}
