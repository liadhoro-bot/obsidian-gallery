'use client'

import Link from 'next/link'
import { useState } from 'react'

export default function ContestShareLinkBox({
  path,
  shareUrl,
}: {
  path: string
  shareUrl: string
}) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')

  async function copyShareUrl() {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopyState('copied')
      window.setTimeout(() => setCopyState('idle'), 1800)
    } catch {
      setCopyState('failed')
      window.setTimeout(() => setCopyState('idle'), 2200)
    }
  }

  return (
    <section className="rounded-2xl border border-cyan-300/25 bg-cyan-300/[0.08] p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-200">
            Share Link
          </p>
          <h2 className="mt-1 text-xl font-black text-white">Actual Contest Page</h2>
          <p className="mt-1 text-sm leading-6 text-cyan-50/75">
            Use this link to open or share the public-facing contest page.
          </p>
        </div>
        <Link
          href={path}
          className="inline-flex shrink-0 items-center justify-center rounded-xl border border-cyan-300/30 bg-black/20 px-4 py-3 text-sm font-black text-cyan-50"
        >
          Open Contest
        </Link>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]">
        <input
          readOnly
          value={shareUrl}
          className="min-w-0 rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-white outline-none"
          onFocus={(event) => event.currentTarget.select()}
        />
        <button
          type="button"
          onClick={copyShareUrl}
          className="rounded-xl bg-cyan-400 px-4 py-3 text-sm font-black text-black disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/45"
        >
          {copyState === 'copied'
            ? 'Copied'
            : copyState === 'failed'
              ? 'Copy Failed'
              : 'Copy Link'}
        </button>
      </div>
    </section>
  )
}
