'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  deleteUnitSession,
  endUnitSession,
  startUnitSession,
  updateUnitSession,
} from '../actions'

type Session = {
  id: string
  started_at: string
  ended_at: string | null
  duration_seconds: number | null
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString()
}

function toDateTimeLocal(value: string) {
  const date = new Date(value)
  const offset = date.getTimezoneOffset()
  const local = new Date(date.getTime() - offset * 60 * 1000)
  return local.toISOString().slice(0, 16)
}

function formatSessionDuration(seconds: number | null) {
  if (!seconds) return '0h 00m'

  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)

  return `${hrs}h ${mins.toString().padStart(2, '0')}m`
}
function formatRunningDuration(startedAt: string) {
  const seconds = Math.max(
    0,
    Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)
  )

  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  return `${hrs}h ${mins.toString().padStart(2, '0')}m ${secs
    .toString()
    .padStart(2, '0')}s`
}
function LoadingDot() {
  return (
    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
  )
}

export default function UnitSessionTracker({
  unitId,
  activeSession,
  sessions,
  totalLoggedSeconds,
}: {
  unitId: string
  activeSession: Session | null
  sessions: Session[]
  totalLoggedSeconds: number
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [sessionIndex, setSessionIndex] = useState(0)
  const [slideDirection, setSlideDirection] = useState<'up' | 'down'>('up')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
const [nowTick, setNowTick] = useState(Date.now())

useEffect(() => {
  if (!activeSession) return

  const interval = setInterval(() => {
    setNowTick(Date.now())
  }, 1000)

  return () => clearInterval(interval)
}, [activeSession])
  const completedSessions = useMemo(
    () => sessions.filter((session) => session.ended_at),
    [sessions]
  )

  const visibleSession = completedSessions[sessionIndex] ?? null
  const totalLabel = formatSessionDuration(totalLoggedSeconds)
  const isEditingVisibleSession =
    visibleSession && editingId === visibleSession.id

  const handlePreviousSession = () => {
    setSlideDirection('down')
    setEditingId(null)
    setConfirmDeleteId(null)
    setSessionIndex((i) => Math.max(0, i - 1))
  }

  const handleNextSession = () => {
    setSlideDirection('up')
    setEditingId(null)
    setConfirmDeleteId(null)
    setSessionIndex((i) => Math.min(completedSessions.length - 1, i + 1))
  }

  const handleStart = () => {
    startTransition(async () => {
      await startUnitSession(unitId)
      router.refresh()
    })
  }

  const handleStop = () => {
    startTransition(async () => {
      await endUnitSession(unitId)
      router.refresh()
    })
  }

  const handleUpdate = (formData: FormData) => {
    startTransition(async () => {
      await updateUnitSession(formData)
      setEditingId(null)
      setConfirmDeleteId(null)
      router.refresh()
    })
  }

  const handleDelete = (sessionId: string) => {
    setDeletingId(sessionId)

    startTransition(async () => {
      const formData = new FormData()
      formData.set('unitId', unitId)
      formData.set('sessionId', sessionId)

      await deleteUnitSession(formData)

      setEditingId(null)
      setConfirmDeleteId(null)
      setDeletingId(null)
      setSessionIndex(0)
      router.refresh()
    })
  }

  return (
    <section className="mt-4 rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.06] p-3 shadow-[0_0_28px_rgba(34,211,238,0.08)]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-black uppercase tracking-[0.18em] text-cyan-400">
            Session Tracker
          </h2>
          <div className="mt-1 text-lg font-black text-white">
  {totalLabel}
</div>

<div className="text-[10px] uppercase tracking-[0.18em] text-white/35">
  Total Time Logged
</div>
        </div>

        {activeSession ? (
          <button
            type="button"
            onClick={handleStop}
            disabled={isPending}
            className="flex min-w-[110px] items-center justify-center gap-2 rounded-xl bg-red-500 px-4 py-3 text-xs font-black uppercase tracking-wide text-white disabled:opacity-50"
          >
            {isPending ? <LoadingDot /> : null}
            Stop
          </button>
        ) : (
          <button
            type="button"
            onClick={handleStart}
            disabled={isPending}
            className="flex min-w-[205px] items-center justify-center gap-2 rounded-xl bg-cyan-400 px-5 py-3 text-xs font-black uppercase tracking-wide text-black shadow-[0_0_24px_rgba(34,211,238,0.25)] disabled:opacity-50"
          >
            {isPending ? <LoadingDot /> : null}
            Start Painting Session
          </button>
        )}
      </div>

      {activeSession ? (
        <div className="rounded-xl border border-cyan-400/30 bg-black/20 p-3">
  <div className="flex items-start justify-between gap-3">
    <div>
      <div className="text-xs font-bold uppercase tracking-wide text-cyan-300">
        Session running
      </div>

      <div className="mt-1 text-sm text-white/60">
        Started {formatDateTime(activeSession.started_at)}
      </div>
    </div>

    <div className="text-right">
      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">
        Timer
      </div>

      <div className="mt-1 text-lg font-black text-white">
        {nowTick ? formatRunningDuration(activeSession.started_at) : '0h 00m 00s'}
      </div>
    </div>
  </div>
</div>
      ) : !visibleSession ? (
        <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white/50">
          No completed sessions yet.
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-xl border border-white/10 bg-black/25 p-3">
          <div className="absolute right-3 top-3 z-10 flex flex-col gap-1">
            <button
              type="button"
              onClick={handlePreviousSession}
              disabled={sessionIndex === 0}
              className="rounded-lg bg-white/10 px-2 py-1 text-xs font-bold text-white disabled:opacity-30"
            >
              ^
            </button>

            <button
              type="button"
              onClick={handleNextSession}
              disabled={sessionIndex >= completedSessions.length - 1}
              className="rounded-lg bg-white/10 px-2 py-1 text-xs font-bold text-white disabled:opacity-30"
            >
              ˅
            </button>

            {!isEditingVisibleSession && (
              <button
                type="button"
                onClick={() => {
                  setEditingId(visibleSession.id)
                  setConfirmDeleteId(null)
                }}
                className="mt-2 rounded-lg bg-cyan-400/15 px-2 py-1.5 text-sm font-bold text-cyan-300"
                aria-label="Edit session"
              >
                ✎
              </button>
            )}
          </div>

          {isEditingVisibleSession ? (
            <form action={handleUpdate} className="space-y-3 pr-10">
              <input type="hidden" name="unitId" value={unitId} />
              <input type="hidden" name="sessionId" value={visibleSession.id} />

              <div>
                <label className="text-xs text-white/40">Started</label>
                <input
                  name="startedAt"
                  type="datetime-local"
                  defaultValue={toDateTimeLocal(visibleSession.started_at)}
                  className="mt-1 w-full rounded-lg bg-black/40 px-3 py-2 text-sm text-white"
                />
              </div>

              <div>
                <label className="text-xs text-white/40">Ended</label>
                <input
                  name="endedAt"
                  type="datetime-local"
                  defaultValue={toDateTimeLocal(visibleSession.ended_at!)}
                  className="mt-1 w-full rounded-lg bg-black/40 px-3 py-2 text-sm text-white"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-cyan-400 px-3 py-2 text-xs font-bold text-black disabled:opacity-50"
                >
                  {isPending ? <LoadingDot /> : null}
                  Save
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setEditingId(null)
                    setConfirmDeleteId(null)
                  }}
                  className="flex-1 rounded-xl bg-white/10 px-3 py-2 text-xs font-bold text-white"
                >
                  Cancel
                </button>
              </div>

              <div className="flex justify-end">
                {confirmDeleteId === visibleSession.id ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleDelete(visibleSession.id)}
                      disabled={isPending || deletingId === visibleSession.id}
                      className="flex items-center gap-2 rounded-lg bg-red-500 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                    >
                      {deletingId === visibleSession.id ? <LoadingDot /> : null}
                      {deletingId === visibleSession.id ? 'Deleting...' : 'Delete'}
                    </button>

                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(null)}
                      className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-bold text-white"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(visibleSession.id)}
                    className="rounded-lg bg-red-500/20 px-3 py-1.5 text-xs font-bold text-red-300"
                  >
                    Delete Session
                  </button>
                )}
              </div>
            </form>
          ) : (
            <div
  key={`${visibleSession.id}-${slideDirection}`}
  className={`pr-10 transition-all duration-300 ${
    slideDirection === 'up'
      ? 'animate-[sessionSlideUp_300ms_ease-out]'
      : 'animate-[sessionSlideDown_300ms_ease-out]'
  }`}
>
              <div className="flex items-center justify-between">
  <div className="text-sm font-bold text-white">
    Most Recent Session
  </div>

  <div className="text-[11px] font-semibold uppercase tracking-wide text-white/35">
    {sessionIndex + 1}/{completedSessions.length}
  </div>
</div>

<div className="mt-1 text-xs text-white/45">
  Started {formatDateTime(visibleSession.started_at)}
</div>

<div className="mt-1 text-xs text-white/45">
  Ended {formatDateTime(visibleSession.ended_at!)}
</div>

              <div className="mt-2 text-sm font-bold text-cyan-400">
                {formatSessionDuration(visibleSession.duration_seconds)}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}