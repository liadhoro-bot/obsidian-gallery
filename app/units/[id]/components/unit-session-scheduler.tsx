'use client'

import { FormEvent, useMemo, useState, useTransition } from 'react'
import {
  deleteUnitScheduledSession,
  scheduleUnitSession,
  updateUnitScheduledSession,
} from '../actions'

export type SchedulerLoggedSession = {
  id: string
  started_at: string
  ended_at: string | null
  duration_seconds: number | null
  notes?: string | null
}

export type UnitScheduledSession = {
  id: string
  unit_id: string
  user_id?: string | null
  scheduled_start_at: string
  focus: string
  notify: boolean
  status: string
  created_at?: string | null
  updated_at?: string | null
}

type Props = {
  unitId: string
  loggedSessions: SchedulerLoggedSession[]
  scheduledSessions: UnitScheduledSession[]
  onMutationCommitted?: () => void
  onScheduledSessionsChange?: (sessions: UnitScheduledSession[]) => void
}

const weekLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

function getDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function toDateInputValue(date: Date) {
  return getDateKey(date)
}

function toTimeInputValue(date: Date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(
    date.getMinutes()
  ).padStart(2, '0')}`
}

function formatMonthLabel(date: Date) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'long',
    year: 'numeric',
  }).format(date)
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function formatDuration(seconds: number | null | undefined) {
  if (!seconds) return '0m'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)

  if (hours === 0) {
    return `${minutes}m`
  }

  return `${hours}h ${minutes.toString().padStart(2, '0')}m`
}

function buildMonthDays(monthCursor: Date) {
  const year = monthCursor.getFullYear()
  const month = monthCursor.getMonth()
  const firstDay = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  return {
    offset: firstDay.getDay(),
    days: Array.from({ length: daysInMonth }, (_, index) => {
      const date = new Date(year, month, index + 1)
      return {
        day: index + 1,
        date,
        dateKey: getDateKey(date),
      }
    }),
  }
}

export default function UnitSessionScheduler({
  unitId,
  loggedSessions,
  scheduledSessions,
  onMutationCommitted,
  onScheduledSessionsChange,
}: Props) {
  const initialDate =
    scheduledSessions[0]?.scheduled_start_at ??
    loggedSessions[0]?.started_at ??
    new Date().toISOString()
  const [localScheduledSessions, setLocalScheduledSessions] =
    useState(scheduledSessions)
  const [monthCursor, setMonthCursor] = useState(() => {
    const date = new Date(initialDate)
    return new Date(date.getFullYear(), date.getMonth(), 1)
  })
  const [selectedDate, setSelectedDate] = useState(() =>
    toDateInputValue(new Date(initialDate))
  )
  const [startTime, setStartTime] = useState(() =>
    toTimeInputValue(new Date(initialDate))
  )
  const [focus, setFocus] = useState('Focused painting session')
  const [notify, setNotify] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const monthDays = useMemo(() => buildMonthDays(monthCursor), [monthCursor])
  const loggedByDate = useMemo(() => {
    const grouped = new Map<string, SchedulerLoggedSession[]>()
    for (const session of loggedSessions) {
      const key = getDateKey(new Date(session.started_at))
      grouped.set(key, [...(grouped.get(key) ?? []), session])
    }
    return grouped
  }, [loggedSessions])
  const scheduledByDate = useMemo(() => {
    const grouped = new Map<string, UnitScheduledSession[]>()
    for (const session of localScheduledSessions.filter(
      (item) => item.status === 'scheduled'
    )) {
      const key = getDateKey(new Date(session.scheduled_start_at))
      grouped.set(key, [...(grouped.get(key) ?? []), session])
    }
    return grouped
  }, [localScheduledSessions])
  const selectedLoggedSessions = loggedByDate.get(selectedDate) ?? []
  const selectedScheduledSessions = scheduledByDate.get(selectedDate) ?? []

  function updateScheduledState(nextSessions: UnitScheduledSession[]) {
    setLocalScheduledSessions(nextSessions)
    onScheduledSessionsChange?.(nextSessions)
  }

  function handleMonthStep(direction: -1 | 1) {
    setMonthCursor(
      (current) =>
        new Date(current.getFullYear(), current.getMonth() + direction, 1)
    )
  }

  function handleDaySelect(dateKey: string) {
    setSelectedDate(dateKey)
    setEditingId(null)
  }

  function handleEdit(session: UnitScheduledSession) {
    const date = new Date(session.scheduled_start_at)
    setEditingId(session.id)
    setSelectedDate(toDateInputValue(date))
    setStartTime(toTimeInputValue(date))
    setFocus(session.focus)
    setNotify(session.notify)
  }

  function resetForm() {
    setEditingId(null)
    setStartTime('19:30')
    setFocus('Focused painting session')
    setNotify(false)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const scheduledStartAt = new Date(`${selectedDate}T${startTime}`)

    if (Number.isNaN(scheduledStartAt.getTime())) {
      setError('Choose a valid date and start time.')
      return
    }

    const formData = new FormData()
    formData.set('unitId', unitId)
    formData.set('scheduledStartAt', scheduledStartAt.toISOString())
    formData.set('focus', focus)
    formData.set('notify', notify ? 'true' : 'false')
    if (editingId) {
      formData.set('scheduledSessionId', editingId)
    }

    setError(null)
    startTransition(async () => {
      try {
        const session = editingId
          ? await updateUnitScheduledSession(formData)
          : await scheduleUnitSession(formData)

        updateScheduledState(
          editingId
            ? localScheduledSessions.map((item) =>
                item.id === session.id ? session : item
              )
            : [session, ...localScheduledSessions]
        )
        resetForm()
        onMutationCommitted?.()
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : 'Could not save scheduled session.'
        )
      }
    })
  }

  function handleDelete(sessionId: string) {
    const formData = new FormData()
    formData.set('unitId', unitId)
    formData.set('scheduledSessionId', sessionId)

    setError(null)
    startTransition(async () => {
      try {
        await deleteUnitScheduledSession(formData)
        updateScheduledState(
          localScheduledSessions.filter((session) => session.id !== sessionId)
        )
        if (editingId === sessionId) {
          resetForm()
        }
        onMutationCommitted?.()
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : 'Could not delete scheduled session.'
        )
      }
    })
  }

  return (
    <section className="mt-4 rounded-2xl border border-white/10 bg-white/[0.045] p-4 shadow-[0_0_28px_rgba(34,211,238,0.08)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-white">Painting Calendar</h2>
          <p className="mt-0.5 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300/80">
            Logged and scheduled sessions
          </p>
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-[#07111b]/90">
        <div className="flex items-center justify-between border-b border-white/10 px-3 py-3">
          <button
            type="button"
            onClick={() => handleMonthStep(-1)}
            className="grid h-8 w-8 place-items-center rounded-full bg-white/[0.06] text-white/45 transition hover:text-cyan-300"
            aria-label="Previous month"
          >
            &lt;
          </button>
          <h3 className="text-sm font-black text-white">
            {formatMonthLabel(monthCursor)}
          </h3>
          <button
            type="button"
            onClick={() => handleMonthStep(1)}
            className="grid h-8 w-8 place-items-center rounded-full bg-white/[0.06] text-white/45 transition hover:text-cyan-300"
            aria-label="Next month"
          >
            &gt;
          </button>
        </div>

        <div className="grid grid-cols-7 px-3 pt-4 text-center text-[10px] font-black text-white/28">
          {weekLabels.map((label, index) => (
            <span key={`${label}-${index}`}>{label}</span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-y-1 px-3 py-4">
          {Array.from({ length: monthDays.offset }).map((_, index) => (
            <span key={index} className="h-12" />
          ))}
          {monthDays.days.map((day) => {
            const hasLogged = (loggedByDate.get(day.dateKey)?.length ?? 0) > 0
            const hasScheduled =
              (scheduledByDate.get(day.dateKey)?.length ?? 0) > 0
            const isSelected = selectedDate === day.dateKey

            return (
              <button
                key={day.dateKey}
                type="button"
                onClick={() => handleDaySelect(day.dateKey)}
                className={[
                  'mx-auto flex h-12 w-12 flex-col items-center justify-center rounded-xl border text-xs font-black transition',
                  isSelected
                    ? 'border-cyan-300/60 bg-cyan-300/16 text-cyan-200'
                    : 'border-transparent text-white/42 hover:bg-white/[0.05] hover:text-white/70',
                ].join(' ')}
              >
                <span>{day.day}</span>
                <span className="mt-1 flex h-1 gap-1">
                  {hasLogged ? (
                    <span className="h-1 w-1 rounded-full bg-cyan-300" />
                  ) : null}
                  {hasScheduled ? (
                    <span className="h-1 w-1 rounded-full bg-yellow-300" />
                  ) : null}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        {selectedScheduledSessions.map((session) => (
          <div
            key={session.id}
            className="rounded-2xl border border-yellow-300/20 bg-yellow-300/[0.06] p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-yellow-300">
                  Scheduled
                </p>
                <h3 className="mt-2 truncate text-base font-black text-white">
                  {session.focus}
                </h3>
                <p className="mt-1 text-xs font-semibold text-white/45">
                  Starts {formatTime(session.scheduled_start_at)}
                  {session.notify ? ' - notify enabled' : ''}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => handleEdit(session)}
                  className="rounded-full px-2 py-1 text-[10px] font-black text-cyan-300 transition hover:bg-cyan-300/10"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(session.id)}
                  className="rounded-full px-2 py-1 text-[10px] font-black text-red-300 transition hover:bg-red-500/10"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}

        {selectedLoggedSessions.map((session) => (
          <div
            key={session.id}
            className="rounded-2xl border border-cyan-300/18 bg-cyan-300/[0.06] p-4"
          >
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">
              Logged
            </p>
            <h3 className="mt-2 text-base font-black text-white">
              {formatDuration(session.duration_seconds)}
            </h3>
            <p className="mt-1 text-xs font-semibold text-white/45">
              Started {formatTime(session.started_at)}
              {session.ended_at ? ` - ended ${formatTime(session.ended_at)}` : ''}
            </p>
            {session.notes ? (
              <p className="mt-2 text-xs font-semibold leading-5 text-white/45">
                {session.notes}
              </p>
            ) : null}
          </div>
        ))}

        {selectedLoggedSessions.length === 0 &&
        selectedScheduledSessions.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-[#07111b]/90 p-4 text-sm text-white/45">
            No sessions on this date yet.
          </div>
        ) : null}
      </div>

      <form onSubmit={handleSubmit} className="mt-4 grid gap-3 rounded-2xl border border-white/10 bg-black/20 p-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-1">
            <span className="text-xs font-black uppercase tracking-[0.16em] text-white/35">
              Date
            </span>
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              className="h-11 rounded-xl border border-white/10 bg-black/30 px-3 text-sm font-bold text-white outline-none focus:border-cyan-300/60"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-xs font-black uppercase tracking-[0.16em] text-white/35">
              Starts
            </span>
            <input
              type="time"
              value={startTime}
              onChange={(event) => setStartTime(event.target.value)}
              className="h-11 rounded-xl border border-white/10 bg-black/30 px-3 text-sm font-bold text-white outline-none focus:border-cyan-300/60"
            />
          </label>
        </div>

        <label className="grid gap-1">
          <span className="text-xs font-black uppercase tracking-[0.16em] text-white/35">
            Focus
          </span>
          <input
            value={focus}
            onChange={(event) => setFocus(event.target.value)}
            className="h-11 rounded-xl border border-white/10 bg-black/30 px-3 text-sm font-semibold text-white outline-none focus:border-cyan-300/60"
          />
        </label>

        <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-sm font-bold text-white/65">
          <input
            type="checkbox"
            checked={notify}
            onChange={(event) => setNotify(event.target.checked)}
            className="h-4 w-4 accent-cyan-300"
          />
          Notify me before this session
        </label>

        {error ? (
          <p className="rounded-xl border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-200">
            {error}
          </p>
        ) : null}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isPending}
            className="flex h-11 flex-1 items-center justify-center rounded-xl bg-cyan-400 text-sm font-black text-black transition disabled:opacity-55"
          >
            {editingId ? 'Update Schedule' : 'Schedule Session'}
          </button>
          {editingId ? (
            <button
              type="button"
              onClick={resetForm}
              className="h-11 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm font-black text-white/58 transition hover:text-white"
            >
              Cancel
            </button>
          ) : null}
        </div>
      </form>
    </section>
  )
}
