'use client'

import Image from 'next/image'
import { useMemo, useState } from 'react'
import type { Contest, ContestNomineeType } from '../../lib/contests/types'
import type { ContestPickerSource } from '../../lib/contests/queries'
import PendingSubmitButton from './pending-submit-button'

const typeLabels: Record<ContestNomineeType, string> = {
  project: 'Projects',
  unit: 'Units',
  guide: 'Guides',
}

export default function NominationSourcePicker({
  contest,
  sources,
  selectedSourceType,
  selectedSourceId,
  action,
  isDemoContest,
}: {
  contest: Contest
  sources: ContestPickerSource[]
  selectedSourceType?: string
  selectedSourceId?: string
  action: (formData: FormData) => void
  isDemoContest?: boolean
}) {
  const allowedTypes = contest.allowed_nominee_types?.map((row) => row.nominee_type) ?? []
  const initialType =
    selectedSourceType && allowedTypes.includes(selectedSourceType as ContestNomineeType)
      ? (selectedSourceType as ContestNomineeType)
      : allowedTypes[0] ?? 'project'
  const [activeType, setActiveType] = useState<ContestNomineeType>(initialType)
  const [search, setSearch] = useState('')

  const filteredSources = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return sources.filter((source) => {
      if (source.sourceType !== activeType) return false
      if (!needle) return true
      return (
        source.title.toLowerCase().includes(needle) ||
        (source.description ?? '').toLowerCase().includes(needle)
      )
    })
  }, [activeType, search, sources])

  return (
    <div className="space-y-4">
      {isDemoContest ? (
        <p className="rounded-2xl border border-cyan-300/25 bg-cyan-300/[0.08] p-4 text-sm text-cyan-50">
          This is a local demo contest. Pickers and links are active, but saving a
          nomination requires the contest migration in Supabase.
        </p>
      ) : null}

      <div className="grid grid-cols-3 rounded-2xl border border-white/10 bg-slate-950/70 p-1">
        {allowedTypes.map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setActiveType(type)}
            data-active={activeType === type}
            className="rounded-xl px-3 py-3 text-xs font-black uppercase tracking-[0.12em] text-white/45 transition data-[active=true]:bg-cyan-400 data-[active=true]:text-black"
          >
            {typeLabels[type]}
          </button>
        ))}
      </div>

      <label className="block">
        <span className="sr-only">Search nominatable objects</span>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={`Search ${typeLabels[activeType].toLowerCase()}`}
          className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-white/35"
        />
      </label>

      {filteredSources.length === 0 ? (
        <p className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-white/55">
          No {typeLabels[activeType].toLowerCase()} match this contest yet.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredSources.map((source) => {
            const isSelected =
              selectedSourceId === source.id && selectedSourceType === source.sourceType

            return (
              <form
                key={`${source.sourceType}:${source.id}`}
                action={action}
              >
                <input type="hidden" name="contestId" value={contest.id} />
                <input type="hidden" name="sourceType" value={source.sourceType} />
                <input type="hidden" name="sourceId" value={source.id} />
                <PendingSubmitButton
                  disabled={isDemoContest}
                  pendingLabel="Nominating..."
                  className={`tap-card group block min-h-[17rem] w-full overflow-hidden rounded-2xl border bg-white/[0.05] text-left transition hover:border-cyan-300/50 disabled:cursor-not-allowed disabled:opacity-85 ${
                    isSelected ? 'border-cyan-300' : 'border-white/10'
                  }`}
                >
                  <div className="relative aspect-[4/3] bg-neutral-950">
                    {source.imageUrl ? (
                      <Image
                        src={source.imageUrl}
                        alt=""
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 220px"
                        className="object-cover transition duration-[180ms] group-hover:scale-[1.025]"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_30%_20%,rgba(34,211,238,0.18),transparent_34%),linear-gradient(135deg,#111827,#020617)] text-xs font-bold uppercase text-white/35">
                        No image
                      </div>
                    )}
                  </div>

                <div className="space-y-2 p-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-cyan-300">
                      {source.sourceType === 'guide' ? 'Guide' : source.sourceType}
                    </p>
                    <h3 className="line-clamp-2 min-h-10 text-sm font-black leading-5 text-white">
                      {source.title}
                    </h3>
                  </div>

                  <span className="inline-flex w-full justify-center rounded-xl bg-cyan-400 px-3 py-2 text-xs font-black text-black group-disabled:bg-white/15 group-disabled:text-white/35">
                    {isDemoContest ? 'Demo Only' : `Nominate this ${source.sourceType}`}
                  </span>
                </div>
                </PendingSubmitButton>
              </form>
            )
          })}
        </div>
      )}
    </div>
  )
}
