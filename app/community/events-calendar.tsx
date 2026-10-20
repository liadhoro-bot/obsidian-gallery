'use client'

import { useMemo, useRef, useState } from 'react'
import { UpcomingEventRow } from './event-components'
import type { CommunityEvent } from './events-data'

const weekDayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

// Event dates are Israel calendar days, so "today" is too.
function todayKeyInIsrael() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(
    new Date()
  )
}

type MonthCursor = { year: number; month: number }

function cursorFromDateKey(dateKey: string): MonthCursor {
  const [year, month] = dateKey.split('-').map(Number)
  return { year, month: month - 1 }
}

function stepMonth({ year, month }: MonthCursor, direction: -1 | 1): MonthCursor {
  const next = month + direction
  return { year: year + Math.floor(next / 12), month: ((next % 12) + 12) % 12 }
}

function getMonthDays({ year, month }: MonthCursor) {
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  const pad = (value: number) => String(value).padStart(2, '0')
  return {
    offset: new Date(Date.UTC(year, month, 1)).getUTCDay(),
    days: Array.from({ length: daysInMonth }, (_, index) => ({
      day: index + 1,
      dateKey: `${year}-${pad(month + 1)}-${pad(index + 1)}`,
    })),
  }
}

function formatMonthLabel({ year, month }: MonthCursor) {
  return new Date(Date.UTC(year, month, 1)).toLocaleDateString('en-GB', {
    timeZone: 'UTC',
    month: 'long',
    year: 'numeric',
  })
}

function formatDayLabel(dateKey: string) {
  return new Date(`${dateKey}T00:00:00Z`).toLocaleDateString('en-GB', {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

export default function EventsCalendar({ events }: { events: CommunityEvent[] }) {
  const todayKey = useMemo(() => todayKeyInIsrael(), [])
  const eventsByDate = useMemo(() => {
    const byDate = new Map<string, CommunityEvent[]>()
    for (const event of events) {
      byDate.set(event.eventDate, [...(byDate.get(event.eventDate) ?? []), event])
    }
    return byDate
  }, [events])

  const [monthCursor, setMonthCursor] = useState(() => cursorFromDateKey(todayKey))
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(() =>
    eventsByDate.has(todayKey) ? todayKey : null
  )
  const dayPanel = useRef<HTMLDivElement>(null)
  const monthDays = getMonthDays(monthCursor)
  const monthLabel = formatMonthLabel(monthCursor)
  const selectedEvents = selectedDateKey ? eventsByDate.get(selectedDateKey) ?? [] : []

  function handleDaySelect(dateKey: string) {
    setSelectedDateKey(dateKey)
    // Wait for the day's events to render, then bring them into view.
    requestAnimationFrame(() => {
      dayPanel.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
  }

  return (
    <section
      data-v3-community-indicator="section-card"
      className="overflow-hidden"
      aria-label="Events calendar"
    >
      <div data-v3-community-indicator="calendar-header">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => setMonthCursor((current) => stepMonth(current, -1))}
        >
          <ArrowIcon direction="left" />
        </button>
        <h2 aria-live="polite">{monthLabel}</h2>
        <button
          type="button"
          aria-label="Next month"
          onClick={() => setMonthCursor((current) => stepMonth(current, 1))}
        >
          <ArrowIcon direction="right" />
        </button>
      </div>

      <div>
        <div data-v3-community-indicator="calendar-weekdays" aria-hidden="true">
          {weekDayLabels.map((label, index) => (
            <span key={`${label}-${index}`}>{label}</span>
          ))}
        </div>

        <div data-v3-community-indicator="calendar-grid">
          {Array.from({ length: monthDays.offset }, (_, index) => (
            <span key={`blank-${index}`} aria-hidden="true" />
          ))}
          {monthDays.days.map((day) => {
            const dayEvents = eventsByDate.get(day.dateKey) ?? []
            const hasEvents = dayEvents.length > 0
            return (
              <button
                key={day.dateKey}
                type="button"
                onClick={() => handleDaySelect(day.dateKey)}
                aria-pressed={selectedDateKey === day.dateKey}
                aria-label={`${formatDayLabel(day.dateKey)}${
                  hasEvents
                    ? `, ${dayEvents.length} event${dayEvents.length > 1 ? 's' : ''}`
                    : ''
                }`}
                data-has-events={hasEvents ? 'true' : undefined}
                data-today={day.dateKey === todayKey ? 'true' : undefined}
                data-v3-community-indicator="calendar-day"
              >
                <span>{day.day}</span>
                {hasEvents ? <span data-v3-community-indicator="calendar-dot" /> : null}
              </button>
            )
          })}
        </div>

        <div ref={dayPanel} data-v3-community-indicator="calendar-day-panel">
          {selectedDateKey ? (
            <>
              <p data-v3-community-indicator="calendar-day-title">
                {formatDayLabel(selectedDateKey)}
              </p>
              {selectedEvents.length > 0 ? (
                <div className="divide-y">
                  {selectedEvents.map((event) => (
                    <UpcomingEventRow key={event.id} event={event} source="events_calendar" />
                  ))}
                </div>
              ) : (
                <p data-v3-community-indicator="events-empty">No events on this day.</p>
              )}
            </>
          ) : (
            <p data-v3-community-indicator="events-empty">
              Tap a highlighted date to see its events.
            </p>
          )}
        </div>
      </div>
    </section>
  )
}

function ArrowIcon({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={direction === 'left' ? 'm15 18-6-6 6-6' : 'm9 18 6-6-6-6'} />
    </svg>
  )
}
