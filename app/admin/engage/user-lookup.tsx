'use client'

import { useState } from 'react'
import type { MessageSurface } from '../../../lib/engage/types'

export type LookupEntry = {
  id: string
  name: string
  username: string
  email: string
  stateLabel: string
  stateMeaning: string
  stateClass: string
  dotClass: string
  stateSince: string
  facts: { label: string; value: string }[]
  inApp: { label: string; surface: MessageSurface } | null
  push: string
  pushSurface: boolean
  emailPlan: string
}

const SURFACE_STYLE: Record<MessageSurface, string> = {
  push: 'border-sky-300/40 bg-sky-300/15 text-sky-50',
  popup: 'border-amber-300/40 bg-amber-300/15 text-amber-50',
  topper: 'border-emerald-300/40 bg-emerald-300/15 text-emerald-50',
  email: 'border-violet-300/40 bg-violet-300/15 text-violet-50',
}

const MAX_RESULTS = 5

// Type a username, name or email to see one painter's lifecycle state, why
// they are in it, and what each channel would send them.
export default function UserLookup({ entries }: { entries: LookupEntry[] }) {
  const [query, setQuery] = useState('')
  const needle = query.trim().toLowerCase().replace(/^@/, '')

  const matches = needle
    ? entries.filter((entry) =>
        [entry.username, entry.email, entry.name].some((value) => value.toLowerCase().includes(needle))
      )
    : []
  // An exact username or email match goes first.
  matches.sort(
    (a, b) =>
      Number(b.username.toLowerCase() === needle || b.email.toLowerCase() === needle) -
      Number(a.username.toLowerCase() === needle || a.email.toLowerCase() === needle)
  )

  return (
    <div className="space-y-3">
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Username, name or email"
        autoComplete="off"
        className="w-full rounded-xl border border-white/15 bg-[#0d1822] px-3 py-2.5 text-sm text-white placeholder:text-white/30"
      />

      {needle && !matches.length ? <p className="text-sm text-white/50">Nobody matches “{query.trim()}”.</p> : null}
      {matches.length > MAX_RESULTS ? (
        <p className="text-xs text-white/45">
          {matches.length} match. Showing the first {MAX_RESULTS}; type more to narrow it down.
        </p>
      ) : null}

      {matches.slice(0, MAX_RESULTS).map((entry) => (
        <article key={entry.id} className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-lg font-black">{entry.name}</span>
            <span className="text-xs text-white/45">
              {entry.username ? `@${entry.username}` : ''}
              {entry.username && entry.email ? ' · ' : ''}
              {entry.email}
            </span>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <span className={`inline-flex items-center gap-2 font-black ${entry.stateClass}`}>
              <span className={`h-2.5 w-2.5 rounded-full ${entry.dotClass}`} />
              {entry.stateLabel}
            </span>
            <span className="ml-2 text-sm text-white/60">
              {entry.stateMeaning} · {entry.stateSince}
            </span>
          </div>

          <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
            {entry.facts.map((fact) => (
              <div key={fact.label}>
                <dt className="text-xs font-bold uppercase text-white/40">{fact.label}</dt>
                <dd className="text-white/85">{fact.value}</dd>
              </div>
            ))}
          </dl>

          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-xl border border-amber-300/20 p-2.5">
              <div className="text-xs font-bold text-amber-200/80">Opens the app → sees</div>
              <div className="mt-1">
                {entry.inApp ? (
                  <span
                    className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${SURFACE_STYLE[entry.inApp.surface]}`}
                  >
                    {entry.inApp.label}
                  </span>
                ) : (
                  <span className="text-xs text-white/40">nothing</span>
                )}
              </div>
            </div>
            <div className="rounded-xl border border-sky-300/20 p-2.5">
              <div className="text-xs font-bold text-sky-200/80">Daily push</div>
              <div className="mt-1">
                {entry.pushSurface ? (
                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${SURFACE_STYLE.push}`}>
                    {entry.push}
                  </span>
                ) : (
                  <span className="text-xs text-white/60">{entry.push}</span>
                )}
              </div>
            </div>
            <div className="rounded-xl border border-violet-300/20 p-2.5">
              <div className="text-xs font-bold text-violet-200/80">Email</div>
              <div className="mt-1 text-xs text-white/60">{entry.emailPlan || '–'}</div>
            </div>
          </div>
        </article>
      ))}
    </div>
  )
}
