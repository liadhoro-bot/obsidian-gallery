'use client'

import { FormEvent, useEffect, useMemo, useState, useTransition } from 'react'
import { capturePostHog } from '../../../../utils/analytics/client'
import {
  deleteUnitSession,
  endUnitSession,
  logManualUnitSession,
  startUnitSession,
  updateUnitSession,
} from '../actions'

type Session = {
  id: string
  started_at: string
  ended_at: string | null
  duration_seconds: number | null
  entry_source?: string | null
  notes?: string | null
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
      <path
        d="M7 4V7M17 4V7M5 9H19M6 6H18C19.1 6 20 6.9 20 8V18C20 19.1 19.1 20 18 20H6C4.9 20 4 19.1 4 18V8C4 6.9 4.9 6 6 6Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
      <path
        d="M12 7V12L15 14M21 12C21 17 17 21 12 21C7 21 3 17 3 12C3 7 7 3 12 3C17 3 21 7 21 12Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ManualLogIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
      <path
        d="M5 19H19M6 15L15.5 5.5C16.3 4.7 17.7 4.7 18.5 5.5C19.3 6.3 19.3 7.7 18.5 8.5L9 18H6V15Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function LoadingDot() {
  return (
    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
  )
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value))
}

function formatSessionDuration(seconds: number | null | undefined) {
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

function getTodayInputValue() {
  return new Date().toISOString().slice(0, 10)
}

function toDateTimeLocal(value: string) {
  const date = new Date(value)
  const offset = date.getTimezoneOffset()
  const local = new Date(date.getTime() - offset * 60 * 1000)

  return local.toISOString().slice(0, 16)
}

function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
      <path
        d="M5 19H19M6 15L15.5 5.5C16.3 4.7 17.7 4.7 18.5 5.5C19.3 6.3 19.3 7.7 18.5 8.5L9 18H6V15Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function SessionRow({
  session,
  title,
  isEditing,
  isPending,
  isDeleting,
  confirmDelete,
  onCancelEdit,
  onDelete,
  onEdit,
  onRequestDelete,
  onSubmitEdit,
}: {
  session: Session
  title?: string
  isEditing: boolean
  isPending: boolean
  isDeleting: boolean
  confirmDelete: boolean
  onCancelEdit: () => void
  onDelete: () => void
  onEdit: () => void
  onRequestDelete: () => void
  onSubmitEdit: (formData: FormData) => void
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#07111b]/90 p-4 shadow-[0_0_24px_rgba(0,0,0,0.2)]">
      {title ? (
        <div className="mb-3 text-[11px] font-black uppercase tracking-[0.18em] text-white/35">
          {title}
        </div>
      ) : null}

      {isEditing ? (
        <form action={onSubmitEdit} className="space-y-3">
          <input type="hidden" name="sessionId" value={session.id} />

          <div>
            <label className="text-xs text-white/40">Started</label>
            <input
              name="startedAt"
              type="datetime-local"
              defaultValue={toDateTimeLocal(session.started_at)}
              className="mt-1 w-full rounded-lg bg-black/40 px-3 py-2 text-sm text-white"
            />
          </div>

          <div>
            <label className="text-xs text-white/40">Ended</label>
            <input
              name="endedAt"
              type="datetime-local"
              defaultValue={toDateTimeLocal(session.ended_at!)}
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
              onClick={onCancelEdit}
              className="flex-1 rounded-xl bg-white/10 px-3 py-2 text-xs font-bold text-white"
            >
              Cancel
            </button>
          </div>

          <div className="flex justify-end">
            {confirmDelete ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onDelete}
                  disabled={isPending || isDeleting}
                  className="flex items-center gap-2 rounded-lg bg-red-500 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                >
                  {isDeleting ? <LoadingDot /> : null}
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </button>

                <button
                  type="button"
                  onClick={onCancelEdit}
                  className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-bold text-white"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onRequestDelete}
                className="rounded-lg bg-red-500/20 px-3 py-1.5 text-xs font-bold text-red-300"
              >
                Delete Session
              </button>
            )}
          </div>
        </form>
      ) : (
        <div>
          <div className="flex items-center gap-3 text-sm">
            <span className="flex items-center gap-1.5 font-semibold text-white/75">
              <span className="text-cyan-300">
                <CalendarIcon />
              </span>
              <span>{formatDate(session.started_at)}</span>
            </span>

            <span className="flex items-center gap-1.5 font-black text-white">
              <span className="text-cyan-300">
                <ClockIcon />
              </span>
              <span>{formatSessionDuration(session.duration_seconds)}</span>
            </span>

            <button
              type="button"
              onClick={onEdit}
              className="ml-auto flex h-8 w-8 items-center justify-center rounded-full border border-cyan-400/25 bg-cyan-400/10 text-cyan-200 transition hover:border-cyan-300/60 hover:bg-cyan-400/20 hover:text-white"
              aria-label="Edit session"
            >
              <EditIcon />
            </button>
          </div>

          {session.notes ? (
            <p className="mt-3 text-sm leading-5 text-white/45">
              {session.notes}
            </p>
          ) : null}
        </div>
      )}
    </div>
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
  const [isPending, startTransition] = useTransition()
  const [nowTick, setNowTick] = useState(() => Date.now())
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [isManualOpen, setIsManualOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [manualError, setManualError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [localActiveSession, setLocalActiveSession] = useState(activeSession)
  const [localSessions, setLocalSessions] = useState(sessions)
  const [localTotalLoggedSeconds, setLocalTotalLoggedSeconds] =
    useState(totalLoggedSeconds)

  useEffect(() => {
    setLocalActiveSession(activeSession)
  }, [activeSession])

  useEffect(() => {
    setLocalSessions(sessions)
  }, [sessions])

  useEffect(() => {
    setLocalTotalLoggedSeconds(totalLoggedSeconds)
  }, [totalLoggedSeconds])

  useEffect(() => {
    if (!localActiveSession) return

    const interval = setInterval(() => {
      setNowTick(Date.now())
    }, 1000)

    return () => clearInterval(interval)
  }, [localActiveSession])

  const completedSessions = useMemo(
    () =>
      localSessions
        .filter((session) => session.ended_at)
        .sort(
          (a, b) =>
            new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
        ),
    [localSessions]
  )
  const mostRecentSession = completedSessions[0] ?? null
  const historySessions = completedSessions.slice(0, 10)

  const handleStart = () => {
    const startedAt = new Date().toISOString()
    const optimisticSession: Session = {
      id: `optimistic-${startedAt}`,
      started_at: startedAt,
      ended_at: null,
      duration_seconds: null,
      entry_source: 'timer',
      notes: null,
    }
    const previousActiveSession = localActiveSession

    setLocalActiveSession(optimisticSession)
    setActionError(null)

    startTransition(async () => {
      try {
        const session = await startUnitSession(unitId)
        setLocalActiveSession({
          ...optimisticSession,
          ...session,
          ended_at: null,
          duration_seconds: null,
        })
      } catch (error) {
        setLocalActiveSession(previousActiveSession)
        setActionError(
          error instanceof Error ? error.message : 'Could not start session.'
        )
        throw error
      }
    })
  }

  const handleStop = () => {
    const previousActiveSession = localActiveSession
    const previousTotal = localTotalLoggedSeconds
    const optimisticDuration = previousActiveSession
      ? Math.max(
          0,
          Math.floor(
            (Date.now() - new Date(previousActiveSession.started_at).getTime()) /
              1000
          )
        )
      : 0

    setLocalActiveSession(null)
    setLocalTotalLoggedSeconds((current) => current + optimisticDuration)
    setActionError(null)

    startTransition(async () => {
      try {
        const result = await endUnitSession(unitId)
        if (result?.durationSeconds !== undefined) {
          setLocalTotalLoggedSeconds(previousTotal + result.durationSeconds)
        }
        if (result?.session) {
          setLocalSessions((current) => [result.session!, ...current])
        }
      } catch (error) {
        setLocalActiveSession(previousActiveSession)
        setLocalTotalLoggedSeconds(previousTotal)
        setActionError(
          error instanceof Error ? error.message : 'Could not stop session.'
        )
        throw error
      }
    })
  }

  const handleToggleHistory = () => {
    setIsHistoryOpen((current) => {
      const nextValue = !current

      if (nextValue) {
        capturePostHog('unit_session_history_opened', {
          unit_id: unitId,
          session_count: completedSessions.length,
        })
      }

      return nextValue
    })
  }

  const handleManualSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const form = event.currentTarget
    const formData = new FormData(form)
    const startedDate = String(formData.get('startedDate') || '')
    const startedTime = String(formData.get('startedTime') || '')
    const endedDate = String(formData.get('endedDate') || '')
    const endedTime = String(formData.get('endedTime') || '')
    const startedAt = new Date(`${startedDate}T${startedTime}`)
    const endedAt = new Date(`${endedDate}T${endedTime}`)

    if (
      Number.isNaN(startedAt.getTime()) ||
      Number.isNaN(endedAt.getTime()) ||
      endedAt <= startedAt
    ) {
      setManualError('End time must be after start time.')
      return
    }

    const actionData = new FormData()
    actionData.set('unitId', unitId)
    actionData.set('startedAt', startedAt.toISOString())
    actionData.set('endedAt', endedAt.toISOString())
    actionData.set('notes', String(formData.get('notes') || ''))

    setManualError(null)
    setActionError(null)

    const optimisticSession: Session = {
      id: `optimistic-manual-${Date.now()}`,
      started_at: startedAt.toISOString(),
      ended_at: endedAt.toISOString(),
      duration_seconds: Math.floor(
        (endedAt.getTime() - startedAt.getTime()) / 1000
      ),
      entry_source: 'manual',
      notes: String(formData.get('notes') || '').trim() || null,
    }
    const previousSessions = localSessions
    const previousTotal = localTotalLoggedSeconds

    setLocalSessions((current) => [optimisticSession, ...current])
    setLocalTotalLoggedSeconds(
      (current) => current + (optimisticSession.duration_seconds ?? 0)
    )
    form.reset()
    setIsManualOpen(false)

    startTransition(async () => {
      try {
        const session = await logManualUnitSession(actionData)
        if (session) {
          setLocalSessions((current) =>
            current.map((item) =>
              item.id === optimisticSession.id ? session : item
            )
          )
        }
      } catch (error) {
        setLocalSessions(previousSessions)
        setLocalTotalLoggedSeconds(previousTotal)
        setIsManualOpen(true)
        setManualError(
          error instanceof Error ? error.message : 'Could not log session.'
        )
      }
    })
  }

  const handleUpdate = (formData: FormData) => {
    const sessionId = String(formData.get('sessionId') || '')
    const startedAt = String(formData.get('startedAt') || '')
    const endedAt = String(formData.get('endedAt') || '')
    const started = new Date(startedAt)
    const ended = new Date(endedAt)

    if (Number.isNaN(started.getTime()) || Number.isNaN(ended.getTime())) {
      setActionError('Enter valid session dates.')
      return
    }

    if (ended <= started) {
      setActionError('End time must be after start time.')
      return
    }

    const previousSessions = localSessions
    const previousTotal = localTotalLoggedSeconds
    const nextDuration = Math.floor((ended.getTime() - started.getTime()) / 1000)

    setActionError(null)
    setLocalSessions((current) =>
      current.map((session) =>
        session.id === sessionId
          ? {
              ...session,
              started_at: started.toISOString(),
              ended_at: ended.toISOString(),
              duration_seconds: nextDuration,
            }
          : session
      )
    )
    setLocalTotalLoggedSeconds(
      localSessions.reduce((total, session) => {
        if (session.id === sessionId) return total + nextDuration
        return total + (session.duration_seconds ?? 0)
      }, 0)
    )

    startTransition(async () => {
      const actionData = new FormData()

      actionData.set('unitId', unitId)
      actionData.set('sessionId', sessionId)
      actionData.set('startedAt', startedAt)
      actionData.set('endedAt', endedAt)

      try {
        const session = await updateUnitSession(actionData)
        if (session) {
          setLocalSessions((current) =>
            current.map((item) => (item.id === session.id ? session : item))
          )
        }
        setEditingId(null)
        setConfirmDeleteId(null)
      } catch (error) {
        setLocalSessions(previousSessions)
        setLocalTotalLoggedSeconds(previousTotal)
        setActionError(
          error instanceof Error ? error.message : 'Could not update session.'
        )
      }
    })
  }

  const handleDelete = (sessionId: string) => {
    const previousSessions = localSessions
    const previousTotal = localTotalLoggedSeconds
    const removedSession = localSessions.find((session) => session.id === sessionId)

    setDeletingId(sessionId)
    setActionError(null)
    setLocalSessions((current) =>
      current.filter((session) => session.id !== sessionId)
    )
    setLocalTotalLoggedSeconds(
      (current) => current - (removedSession?.duration_seconds ?? 0)
    )

    startTransition(async () => {
      const formData = new FormData()
      formData.set('unitId', unitId)
      formData.set('sessionId', sessionId)

      try {
        await deleteUnitSession(formData)
        setEditingId(null)
        setConfirmDeleteId(null)
        setDeletingId(null)
      } catch (error) {
        setLocalSessions(previousSessions)
        setLocalTotalLoggedSeconds(previousTotal)
        setDeletingId(null)
        setActionError(
          error instanceof Error ? error.message : 'Could not delete session.'
        )
      }
    })
  }

  return (
    <section className="mt-4 rounded-2xl border border-white/10 bg-white/[0.045] p-4 shadow-[0_0_28px_rgba(34,211,238,0.08)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-white">Session Tracker</h2>
          <p className="mt-0.5 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300/80">
            Track your progress
          </p>
        </div>

        <button
          type="button"
          onClick={handleToggleHistory}
          className="text-xs font-black uppercase tracking-[0.16em] text-cyan-300 transition hover:text-cyan-200"
        >
          History
        </button>
      </div>

      <div className="mt-5 flex items-end gap-3">
        <div className="text-4xl font-black leading-none text-white">
          {formatSessionDuration(localTotalLoggedSeconds)}
        </div>
        <div className="pb-1 text-[10px] font-black uppercase tracking-[0.18em] text-white/35">
          Total Logged
        </div>
      </div>

      {localActiveSession ? (
        <div className="mt-4 rounded-2xl border border-cyan-400/25 bg-cyan-400/[0.07] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-cyan-300">
                Session Running
              </div>
              <div className="mt-1 text-sm text-white/55">
                Started {formatDate(localActiveSession.started_at)}
              </div>
            </div>
            <div className="text-right text-lg font-black text-white">
              {nowTick ? formatRunningDuration(localActiveSession.started_at) : '0h 00m 00s'}
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-4 flex gap-3">
        {localActiveSession ? (
          <button
            type="button"
            onClick={handleStop}
            disabled={isPending}
            className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-red-500 px-4 py-3 text-sm font-black text-white transition disabled:opacity-50"
          >
            {isPending ? <LoadingDot /> : null}
            Stop Painting Session
          </button>
        ) : (
          <button
            type="button"
            onClick={handleStart}
            disabled={isPending}
            className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-cyan-400 px-4 py-3 text-sm font-black text-black shadow-[0_0_24px_rgba(34,211,238,0.25)] transition disabled:opacity-50"
          >
            {isPending ? <LoadingDot /> : null}
            Start Painting Session
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            setManualError(null)
            setIsManualOpen(true)
          }}
          className="flex min-h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-black/20 text-cyan-300 transition hover:border-cyan-300/50 hover:bg-cyan-400/10"
          aria-label="Log session manually"
        >
          <ManualLogIcon />
        </button>
      </div>

      <div className="mt-4">
        {actionError ? (
          <p className="mb-3 rounded-xl border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-200">
            {actionError}
          </p>
        ) : null}

        {isHistoryOpen ? (
          <div className="grid gap-3">
            {historySessions.length > 0 ? (
              historySessions.map((session) => (
                <SessionRow
                  key={session.id}
                  session={session}
                  isEditing={editingId === session.id}
                  isPending={isPending}
                  isDeleting={deletingId === session.id}
                  confirmDelete={confirmDeleteId === session.id}
                  onCancelEdit={() => {
                    setEditingId(null)
                    setConfirmDeleteId(null)
                  }}
                  onDelete={() => handleDelete(session.id)}
                  onEdit={() => {
                    setEditingId(session.id)
                    setConfirmDeleteId(null)
                  }}
                  onRequestDelete={() => setConfirmDeleteId(session.id)}
                  onSubmitEdit={handleUpdate}
                />
              ))
            ) : (
              <div className="rounded-2xl border border-white/10 bg-[#07111b]/90 p-4 text-sm text-white/45">
                No completed sessions yet.
              </div>
            )}
          </div>
        ) : mostRecentSession ? (
          <SessionRow
            session={mostRecentSession}
            title="Most Recent Session"
            isEditing={editingId === mostRecentSession.id}
            isPending={isPending}
            isDeleting={deletingId === mostRecentSession.id}
            confirmDelete={confirmDeleteId === mostRecentSession.id}
            onCancelEdit={() => {
              setEditingId(null)
              setConfirmDeleteId(null)
            }}
            onDelete={() => handleDelete(mostRecentSession.id)}
            onEdit={() => {
              setEditingId(mostRecentSession.id)
              setConfirmDeleteId(null)
            }}
            onRequestDelete={() => setConfirmDeleteId(mostRecentSession.id)}
            onSubmitEdit={handleUpdate}
          />
        ) : (
          <div className="rounded-2xl border border-white/10 bg-[#07111b]/90 p-4 text-sm text-white/45">
            No completed sessions yet.
          </div>
        )}
      </div>

      {isManualOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#081018] p-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-black text-white">
                  Manual Session
                </h3>
                <p className="mt-1 text-xs uppercase tracking-[0.16em] text-cyan-300/70">
                  Log painting time
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsManualOpen(false)}
                className="rounded-full border border-white/10 px-3 py-1 text-sm font-bold text-white/60"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleManualSubmit} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-white/50">
                    Started date
                  </label>
                  <input
                    name="startedDate"
                    type="date"
                    defaultValue={getTodayInputValue()}
                    required
                    className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                  />
                </div>

                <div>
                  <label className="text-xs text-white/50">
                    Started time
                  </label>
                  <input
                    name="startedTime"
                    type="time"
                    required
                    className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                  />
                </div>

                <div>
                  <label className="text-xs text-white/50">Ended date</label>
                  <input
                    name="endedDate"
                    type="date"
                    defaultValue={getTodayInputValue()}
                    required
                    className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                  />
                </div>

                <div>
                  <label className="text-xs text-white/50">Ended time</label>
                  <input
                    name="endedTime"
                    type="time"
                    required
                    className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-white/50">Notes</label>
                <textarea
                  name="notes"
                  rows={3}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                />
              </div>

              {manualError ? (
                <p className="rounded-xl border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-200">
                  {manualError}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={isPending}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 px-4 py-3 text-sm font-black text-black disabled:opacity-50"
              >
                {isPending ? <LoadingDot /> : null}
                Save Manual Session
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  )
}
