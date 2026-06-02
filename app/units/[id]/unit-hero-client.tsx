'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useOptimistic, useTransition } from 'react'
import BackButton from '../../components/back-button'
import { toggleUnitActive } from './actions'

type Unit = {
  id: string
  name: string
  is_active: boolean
  project_id: string | null
}

type UnitImage = {
  image_url: string
  alt_text: string | null
}

export default function UnitHeroClient({
  unit,
  featuredImage,
}: {
  unit: Unit
  featuredImage: UnitImage | null
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [optimisticActive, setOptimisticActive] = useOptimistic(
    unit.is_active,
    (_current, nextValue: boolean) => nextValue
  )

  const handleToggleActive = (nextValue: boolean) => {
    startTransition(async () => {
      setOptimisticActive(nextValue)
      await toggleUnitActive(unit.id, nextValue)
      router.refresh()
    })
  }

  const handleEdit = () => {
    window.dispatchEvent(new CustomEvent('unit-header:edit'))
  }

  return (
    <div className="relative">
      <div className="relative h-[260px] w-full overflow-hidden">
        {featuredImage ? (
          <Image
            src={featuredImage.image_url}
            alt={featuredImage.alt_text || unit.name}
            fill
            priority
            sizes="(max-width: 768px) 100vw, 420px"
            className="object-cover opacity-50"
          />
        ) : (
          <div className="h-full w-full bg-[#0b1622]" />
        )}

        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-[#050b12]" />
      </div>

      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-4 pt-4">
        <BackButton
          fallbackHref={unit.project_id ? `/projects/${unit.project_id}` : '/projects'}
        />

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleEdit}
            className="rounded-full border border-white/10 bg-black/40 px-4 py-2 text-xs font-semibold text-white backdrop-blur transition hover:bg-black/60"
          >
            Edit
          </button>

          <button
            type="button"
            onClick={() => handleToggleActive(!optimisticActive)}
            className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide ${
              optimisticActive
                ? 'bg-cyan-400 text-black'
                : 'bg-white/10 text-white'
            }`}
            disabled={isPending}
          >
            {optimisticActive ? 'Active' : 'Inactive'}
          </button>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-10 px-4 pb-6">
        <p className="text-xs uppercase tracking-[0.25em] text-cyan-400">
          Unit
        </p>
        <h1 className="mt-2 text-4xl font-bold leading-tight">
          {unit.name}
        </h1>
      </div>
    </div>
  )
}
