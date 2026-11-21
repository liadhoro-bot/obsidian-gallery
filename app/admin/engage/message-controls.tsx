'use client'

import { useState, useTransition } from 'react'
import { sendEngagePushPreview, setEngagementMessageStatus } from './actions'
import type { MessageStatus, MessageSurface } from '../../../lib/engage/types'

export default function MessageControls({
  messageKey,
  surface,
  status,
  previewPath,
}: {
  messageKey: string
  surface: MessageSurface
  status: MessageStatus
  previewPath: string
}) {
  const [pending, startTransition] = useTransition()
  const [note, setNote] = useState<string | null>(null)

  function changeStatus(next: MessageStatus) {
    if (next === status) return
    if (
      next === 'live' &&
      !window.confirm(
        surface === 'push'
          ? 'Go live? Eligible users will receive this push on the next daily run.'
          : 'Go live? Eligible users will start seeing this in the app.'
      )
    ) {
      return
    }
    startTransition(async () => {
      const result = await setEngagementMessageStatus(messageKey, next)
      setNote(result.ok ? `Status set to ${next}.` : result.error)
    })
  }

  function sendPreview() {
    startTransition(async () => {
      const result = await sendEngagePushPreview(messageKey)
      setNote(result.ok ? 'Sent to your devices.' : result.error)
    })
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {surface === 'push' ? (
        <button
          type="button"
          disabled={pending}
          onClick={sendPreview}
          className="rounded-xl bg-cyan-300 px-3 py-2 text-sm font-black text-[#081018] disabled:opacity-50"
        >
          Send to my devices
        </button>
      ) : surface === 'email' ? null : (
        <a
          href={previewPath}
          className="rounded-xl bg-cyan-300 px-3 py-2 text-sm font-black text-[#081018]"
        >
          Preview in app
        </a>
      )}

      <label className="ml-auto flex items-center gap-2 text-xs font-bold text-white/60">
        Status
        <select
          value={status}
          disabled={pending}
          onChange={(event) => changeStatus(event.target.value as MessageStatus)}
          className="rounded-lg border border-white/20 bg-[#0d1822] px-2 py-1.5 text-sm text-white"
        >
          <option value="draft">draft</option>
          <option value="review">review</option>
          <option value="live" disabled={surface === 'email'}>live</option>
          <option value="paused">paused</option>
        </select>
      </label>

      {note ? <p className="w-full text-xs text-cyan-100/80">{note}</p> : null}
    </div>
  )
}
