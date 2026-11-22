'use client'

import { useState, useTransition } from 'react'
import { LIFECYCLE_LABELS } from '../../../lib/engage/types'
import { messageLabel } from '../../../lib/engage/simulate'
import { dryRunToday } from './actions'

type Result = Awaited<ReturnType<typeof dryRunToday>>

export default function DryRun() {
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<Result | null>(null)

  const rows = result?.ok ? result.rows : []
  const sending = rows.filter((row) => row.willSend).length

  return (
    <div className="space-y-3">
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(async () => setResult(await dryRunToday()))}
        className="rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-black text-[#081018] disabled:opacity-50"
      >
        {pending ? 'Running…' : 'Dry run today'}
      </button>

      {result && !result.ok ? <p className="text-sm text-red-200">{result.error}</p> : null}

      {result?.ok ? (
        <div className="space-y-2">
          <p className="text-sm text-white/70">
            {result.refreshed} users recomputed at {new Date(result.at).toLocaleTimeString()}. Today&apos;s run would
            push <b className="text-white">{rows.length}</b> {rows.length === 1 ? 'person' : 'people'}:{' '}
            <b className="text-emerald-200">{sending} for real</b> (message live) and{' '}
            <b className="text-amber-200">{rows.length - sending} waiting</b> for their message to go live. Nothing was
            sent.
          </p>
          {rows.length ? (
            <ul className="divide-y divide-white/10 rounded-xl border border-white/10">
              {rows.map((row, index) => (
                <li key={`${row.name}-${index}`} className="grid gap-1 p-3 sm:grid-cols-[10rem_1fr_auto] sm:items-start">
                  <div>
                    <div className="font-bold">{row.name}</div>
                    <div className="text-xs text-white/50">{LIFECYCLE_LABELS[row.state]}</div>
                  </div>
                  <div className="text-sm">
                    <div className="text-xs font-bold text-sky-200">{messageLabel(row.messageKey)}</div>
                    <div className="font-bold">{row.title}</div>
                    <div className="text-white/70">{row.body}</div>
                  </div>
                  <span
                    className={`justify-self-start rounded-full px-2 py-0.5 text-xs font-bold ${
                      row.willSend ? 'bg-emerald-300/20 text-emerald-100' : 'bg-amber-300/20 text-amber-100'
                    }`}
                  >
                    {row.willSend ? 'would send' : 'waiting: not live'}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-white/50">Nobody gets a push today.</p>
          )}
        </div>
      ) : null}
    </div>
  )
}
