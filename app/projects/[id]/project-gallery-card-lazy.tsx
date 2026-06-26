'use client'

import dynamic from 'next/dynamic'
import type { ProjectGalleryCardProps } from './project-gallery-card'

const LazyProjectGalleryCard = dynamic(() => import('./project-gallery-card'), {
  loading: () => (
    <section className="rounded-2xl border border-neutral-800 bg-gradient-to-br from-neutral-900 to-neutral-950 p-5 shadow-sm">
      <div className="space-y-2">
        <div className="h-4 w-28 rounded bg-white/10" />
        <div className="h-7 w-20 rounded bg-white/10" />
        <div className="h-4 w-56 rounded bg-white/5" />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="aspect-[3/2] rounded-2xl border border-white/10 bg-white/[0.04]"
          />
        ))}
      </div>
    </section>
  ),
})

export default function ProjectGalleryCardLazy(props: ProjectGalleryCardProps) {
  return <LazyProjectGalleryCard {...props} />
}
