'use client'

import Image from 'next/image'
import PrefetchLink from '../../app/components/prefetch-link'

export type UnitTileData = {
  id: string
  name: string
  imageUrl?: string | null
}

export default function UnitTile({ unit }: { unit: UnitTileData }) {
  return (
    <PrefetchLink
      href={`/units/${unit.id}`}
      viewportPrefetch
      className="tap-card group block overflow-hidden rounded-2xl border border-white/10 bg-white/[0.05] hover:border-cyan-400/70 hover:bg-white/[0.08]"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-neutral-950">
        {unit.imageUrl ? (
          <Image
            src={unit.imageUrl}
            alt={unit.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 180px"
            className="object-cover transition duration-[180ms] group-hover:scale-[1.025]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_30%_20%,rgba(34,211,238,0.18),transparent_34%),linear-gradient(135deg,#111827,#020617)] text-[11px] font-semibold uppercase text-white/35">
            No image
          </div>
        )}
      </div>

      <div className="p-3">
        <h3 className="line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-white">
          {unit.name}
        </h3>
      </div>
    </PrefetchLink>
  )
}
