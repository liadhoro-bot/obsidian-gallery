'use client'

import Image from 'next/image'
import PrefetchLink from '../../app/components/prefetch-link'

export type ProjectTileData = {
  id: string
  name: string
  imageUrl?: string | null
  imageAlt?: string | null
  unitCount?: number | null
  activeCount?: number | null
  doneCount?: number | null
}

export default function ProjectTile({ project }: { project: ProjectTileData }) {
  const metadata = [
    typeof project.unitCount === 'number'
      ? `${project.unitCount} ${project.unitCount === 1 ? 'unit' : 'units'}`
      : null,
    typeof project.activeCount === 'number' ? `${project.activeCount} active` : null,
    typeof project.doneCount === 'number' ? `${project.doneCount} done` : null,
  ].filter(Boolean)

  return (
    <PrefetchLink
      href={`/projects/${project.id}`}
      viewportPrefetch
      className="tap-card group block overflow-hidden rounded-2xl border border-white/10 bg-white/[0.05] hover:border-cyan-400/70 hover:bg-white/[0.08]"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-neutral-950">
        {project.imageUrl ? (
          <Image
            src={project.imageUrl}
            alt={project.imageAlt || project.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 180px"
            className="object-cover transition duration-[180ms] group-hover:scale-[1.025]"
          />
        ) : (
          <div className="h-full w-full bg-[radial-gradient(circle_at_25%_20%,rgba(34,211,238,0.22),transparent_34%),radial-gradient(circle_at_78%_75%,rgba(249,115,22,0.16),transparent_32%),linear-gradient(135deg,#111827,#020617)]" />
        )}
      </div>

      <div className="space-y-2 p-3">
        <h3 className="line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-white">
          {project.name}
        </h3>

        {metadata.length > 0 ? (
          <div className="flex min-h-6 flex-wrap items-center gap-1.5">
            {metadata.map((item) => (
              <span
                key={item}
                className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-black uppercase text-white/65"
              >
                {item}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </PrefetchLink>
  )
}
