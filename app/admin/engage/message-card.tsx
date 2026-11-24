'use client'

import { useState, useTransition } from 'react'
import Image from 'next/image'
import { renderMessage } from '../../../lib/engage/candidates'
import { POPUP_IMAGE_LIBRARY, popupImageOf } from '../../../lib/engage/popup-images'
import {
  LIFECYCLE_LABELS,
  LIFECYCLE_STATES,
  type EngagementMessage,
  type LifecycleState,
  type MessageContext,
  type MessageStatus,
} from '../../../lib/engage/types'
import { sendEngagePushPreview, setEngagementMessageStatus, updateEngagementMessage } from './actions'
import SurfaceMock from './surface-mock'

const STATUS_STYLE: Record<MessageStatus, string> = {
  draft: 'bg-white/10 text-white/70',
  review: 'bg-amber-300/20 text-amber-100',
  live: 'bg-emerald-300/20 text-emerald-100',
  paused: 'bg-red-300/20 text-red-100',
}

type Draft = Pick<EngagementMessage, 'title' | 'body' | 'cta_label' | 'cta_path' | 'priority' | 'lifecycle_states'> & {
  image_path: string | null
}

function draftOf(message: EngagementMessage): Draft {
  return {
    title: message.title,
    body: message.body,
    cta_label: message.cta_label,
    cta_path: message.cta_path,
    priority: message.priority,
    lifecycle_states: message.lifecycle_states,
    image_path: popupImageOf(message),
  }
}

const inputClass =
  'w-full rounded-lg border border-white/15 bg-[#0d1822] px-2.5 py-2 text-sm text-white placeholder:text-white/30'

export default function MessageCard({
  message,
  label,
  sample,
  facts,
}: {
  message: EngagementMessage
  label: string
  sample: MessageContext
  facts: { label: string; value: string }[]
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Draft>(() => draftOf(message))
  const [pending, startTransition] = useTransition()
  const [note, setNote] = useState<string | null>(null)

  const shown = editing ? { ...message, ...draft } : message
  const rendered = renderMessage(shown, 'sample', sample, true)
  const isInApp = message.surface === 'popup' || message.surface === 'topper'

  function changeStatus(next: MessageStatus) {
    if (next === message.status) return
    if (
      next === 'live' &&
      !window.confirm(
        message.surface === 'push'
          ? 'Go live? Eligible users will receive this push on the next daily run.'
          : 'Go live? Eligible users will start seeing this in the app.'
      )
    ) {
      return
    }
    startTransition(async () => {
      const result = await setEngagementMessageStatus(message.key, next)
      setNote(result.ok ? `Status set to ${next}.` : result.error)
    })
  }

  function save() {
    if (message.status === 'live' && !window.confirm('This message is live. Save the new copy for everyone?')) return
    startTransition(async () => {
      const { image_path, ...rest } = draft
      const changedImage = message.surface === 'popup' && image_path !== popupImageOf(message)
      const result = await updateEngagementMessage(message.key, changedImage ? { ...rest, image_path } : rest)
      if (result.ok) {
        setEditing(false)
        setNote('Saved.')
      } else {
        setNote(result.error)
      }
    })
  }

  function toggleState(state: LifecycleState) {
    setDraft((current) => ({
      ...current,
      lifecycle_states: current.lifecycle_states.includes(state)
        ? current.lifecycle_states.filter((value) => value !== state)
        : [...current.lifecycle_states, state],
    }))
  }

  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-black">{label}</span>
        <span className="text-xs text-white/40">{message.key}</span>
        <span className={`ml-auto rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_STYLE[message.status]}`}>
          {message.status}
        </span>
      </div>

      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <div className="space-y-3">
          <SurfaceMock rendered={rendered} />
          {editing ? (
            <div className="space-y-2 rounded-xl border border-cyan-300/20 bg-cyan-300/[0.04] p-3">
              <label className="block text-xs font-bold text-white/60">
                {message.surface === 'email' ? 'Subject' : 'Title'}
                <input
                  className={`${inputClass} mt-1`}
                  value={draft.title}
                  maxLength={120}
                  onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                />
              </label>
              {message.surface === 'topper' ? null : (
                <label className="block text-xs font-bold text-white/60">
                  Body
                  <textarea
                    className={`${inputClass} mt-1 min-h-[96px]`}
                    value={draft.body}
                    maxLength={600}
                    onChange={(event) => setDraft({ ...draft, body: event.target.value })}
                  />
                </label>
              )}
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-xs font-bold text-white/60">
                  Button
                  <input
                    className={`${inputClass} mt-1`}
                    value={draft.cta_label}
                    maxLength={40}
                    onChange={(event) => setDraft({ ...draft, cta_label: event.target.value })}
                  />
                </label>
                <label className="block text-xs font-bold text-white/60">
                  Priority (1 = first)
                  <input
                    className={`${inputClass} mt-1`}
                    type="number"
                    min={1}
                    max={7}
                    value={draft.priority}
                    onChange={(event) => setDraft({ ...draft, priority: Number(event.target.value) })}
                  />
                </label>
              </div>
              {message.key.startsWith('push_opt_in') ? null : (
                <label className="block text-xs font-bold text-white/60">
                  Opens
                  <input
                    className={`${inputClass} mt-1`}
                    value={draft.cta_path}
                    maxLength={200}
                    onChange={(event) => setDraft({ ...draft, cta_path: event.target.value })}
                  />
                </label>
              )}
              {message.surface === 'popup' ? (
                <div className="text-xs font-bold text-white/60">
                  Image
                  <div className="mt-1 grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setDraft({ ...draft, image_path: null })}
                      aria-pressed={draft.image_path === null}
                      className={`flex aspect-[4/3] items-center justify-center rounded-lg border text-[0.7rem] ${
                        draft.image_path === null ? 'border-cyan-300 bg-cyan-300/20 text-cyan-50' : 'border-white/15 text-white/50'
                      }`}
                    >
                      No image
                    </button>
                    {POPUP_IMAGE_LIBRARY.map((image) => {
                      const on = draft.image_path === image.src
                      return (
                        <button
                          key={image.src}
                          type="button"
                          title={image.label}
                          aria-label={image.label}
                          aria-pressed={on}
                          onClick={() => setDraft({ ...draft, image_path: image.src })}
                          className={`relative aspect-[4/3] overflow-hidden rounded-lg border-2 ${
                            on ? 'border-cyan-300' : 'border-transparent opacity-70 hover:opacity-100'
                          }`}
                        >
                          <Image src={image.src} alt="" fill sizes="120px" className="object-cover" />
                        </button>
                      )
                    })}
                  </div>
                </div>
              ) : null}
              <div className="text-xs font-bold text-white/60">
                Who (lifecycle states)
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {LIFECYCLE_STATES.map((state) => {
                    const on = draft.lifecycle_states.includes(state)
                    return (
                      <button
                        key={state}
                        type="button"
                        onClick={() => toggleState(state)}
                        className={`rounded-full border px-2.5 py-1 text-xs font-bold ${
                          on ? 'border-cyan-300/60 bg-cyan-300/20 text-cyan-50' : 'border-white/15 text-white/45'
                        }`}
                      >
                        {LIFECYCLE_LABELS[state]}
                      </button>
                    )
                  })}
                </div>
              </div>
              <p className="text-[0.7rem] text-white/40">
                Use {'{unit}'} and {'{guide}'} for the user&apos;s own unit and guide names.
                {message.surface === 'topper' ? ' Toppers show only the title and the button.' : ''}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={save}
                  className="rounded-xl bg-cyan-300 px-3 py-2 text-sm font-black text-[#081018] disabled:opacity-50"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDraft(draftOf(message))
                    setEditing(false)
                  }}
                  className="rounded-xl border border-white/20 px-3 py-2 text-sm font-bold text-white/80"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <dl className="space-y-2 text-sm">
          {facts.map((fact) => (
            <div key={fact.label}>
              <dt className="text-xs font-bold uppercase text-white/45">{fact.label}</dt>
              <dd className="text-white/80">{fact.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {editing ? null : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-xl border border-white/20 px-3 py-2 text-sm font-bold text-white"
          >
            Edit
          </button>
        )}
        {message.surface === 'push' ? (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await sendEngagePushPreview(message.key)
                setNote(result.ok ? 'Sent to your devices.' : result.error)
              })
            }
            className="rounded-xl bg-cyan-300 px-3 py-2 text-sm font-black text-[#081018] disabled:opacity-50"
          >
            Send to my devices
          </button>
        ) : null}
        {isInApp ? (
          <a
            href={`/dashboard?engage_preview=${message.key}`}
            className="rounded-xl bg-cyan-300 px-3 py-2 text-sm font-black text-[#081018]"
          >
            Preview in app
          </a>
        ) : null}

        <label className="ml-auto flex items-center gap-2 text-xs font-bold text-white/60">
          Status
          <select
            value={message.status}
            disabled={pending}
            onChange={(event) => changeStatus(event.target.value as MessageStatus)}
            className="rounded-lg border border-white/20 bg-[#0d1822] px-2 py-1.5 text-sm text-white"
          >
            <option value="draft">draft</option>
            <option value="review">review</option>
            <option value="live" disabled={message.surface === 'email'}>
              live
            </option>
            <option value="paused">paused</option>
          </select>
        </label>

        {note ? <p className="w-full text-xs text-cyan-100/80">{note}</p> : null}
      </div>
    </article>
  )
}
