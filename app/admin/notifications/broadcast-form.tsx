'use client'

import { useState, useTransition } from 'react'
import { sendBroadcast, sendBroadcastPreview, type BroadcastResult } from './actions'

const inputClass =
  'w-full rounded-xl border border-white/15 bg-white/[0.06] px-3 py-3 text-base text-white placeholder:text-white/35 focus:border-cyan-300/60 focus:outline-none'

export default function BroadcastForm({
  audienceDevices,
  audiencePeople,
}: {
  audienceDevices: number
  audiencePeople: number
}) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [url, setUrl] = useState('/dashboard')
  const [confirming, setConfirming] = useState(false)
  const [status, setStatus] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  const input = { title, body, url }
  const canSend = title.trim() !== '' && body.trim() !== '' && !isPending

  function report(result: BroadcastResult, kind: 'preview' | 'broadcast') {
    if (!result.ok) {
      setStatus({ tone: 'error', text: result.error })
      return
    }
    const extras = [
      result.failed ? `${result.failed} failed` : '',
      result.removed ? `${result.removed} old devices removed` : '',
    ].filter(Boolean)
    setStatus({
      tone: 'ok',
      text:
        kind === 'preview'
          ? `Sent to your ${result.sent === 1 ? 'device' : `${result.sent} devices`}. Check how it looks.`
          : `Delivered to ${result.sent} of ${result.devices} devices${extras.length ? ` (${extras.join(', ')})` : ''}.`,
    })
    if (kind === 'broadcast') {
      setTitle('')
      setBody('')
      setUrl('/dashboard')
    }
  }

  function preview() {
    setStatus(null)
    startTransition(async () => report(await sendBroadcastPreview(input), 'preview'))
  }

  function broadcast() {
    setStatus(null)
    setConfirming(false)
    startTransition(async () => report(await sendBroadcast(input), 'broadcast'))
  }

  return (
    <section className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <label className="block">
        <span className="mb-1 flex justify-between text-sm font-bold text-white/80">
          Title <span className="font-normal text-white/40">{title.length}/80</span>
        </span>
        <input
          className={inputClass}
          value={title}
          maxLength={80}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="New contest is open"
        />
      </label>

      <label className="block">
        <span className="mb-1 flex justify-between text-sm font-bold text-white/80">
          Message <span className="font-normal text-white/40">{body.length}/300</span>
        </span>
        <textarea
          className={`${inputClass} min-h-24`}
          value={body}
          maxLength={300}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Paint a hero, post it by Sunday, win a prize."
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-bold text-white/80">Opens page</span>
        <input
          className={inputClass}
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="/community"
        />
        <span className="mt-1 block text-xs text-white/45">
          Where tapping the notification takes people, e.g. /community or /contests.
        </span>
      </label>

      {status ? (
        <p
          role="status"
          className={
            status.tone === 'ok'
              ? 'rounded-xl bg-emerald-400/10 p-3 text-sm text-emerald-100'
              : 'rounded-xl bg-red-400/10 p-3 text-sm text-red-100'
          }
        >
          {status.text}
        </p>
      ) : null}

      {confirming ? (
        <div className="space-y-3 rounded-xl border border-amber-300/40 bg-amber-300/10 p-3">
          <p className="text-sm text-amber-50">
            Send this to <strong>{audiencePeople} {audiencePeople === 1 ? 'person' : 'people'}</strong>{' '}
            ({audienceDevices} {audienceDevices === 1 ? 'device' : 'devices'})? It can&apos;t be
            recalled.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="rounded-xl border border-white/20 px-4 py-3 font-bold"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={broadcast}
              className="rounded-xl bg-amber-300 px-4 py-3 font-black text-black"
            >
              Yes, send
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={!canSend}
            onClick={preview}
            className="rounded-xl border border-white/20 px-4 py-3 font-bold disabled:opacity-40"
          >
            {isPending ? 'Sending…' : 'Send to me first'}
          </button>
          <button
            type="button"
            disabled={!canSend || audienceDevices === 0}
            onClick={() => setConfirming(true)}
            className="rounded-xl bg-cyan-400 px-4 py-3 font-black text-black disabled:opacity-40"
          >
            Send to everyone
          </button>
        </div>
      )}
    </section>
  )
}
