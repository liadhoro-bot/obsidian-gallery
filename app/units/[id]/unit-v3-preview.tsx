'use client'

import Image from 'next/image'
import type { FormEvent, ReactNode } from 'react'
import { useMemo, useState } from 'react'
import V3PerfIndicator from '../../components/v3-perf-indicator'
import styles from './unit-v3-silver.module.css'

type UnitV3PreviewProps = {
  id: string
  initialTab?: UnitTab
  liveUnit?: PreviewUnit | null
}

type UnitTab = 'details' | 'paint' | 'progress'

type PreviewUnit = {
  id: string
  name: string
  label: string
  image: string
  galleryImages?: PreviewGalleryImage[]
  paintSessions?: UnitPaintSession[]
  scheduledSessions?: ScheduledPaintSession[]
  lastPainted?: string | null
  project: string
  deadline: string
  status: string
  progress: number
  stage: string
  logged: string
  complexity: number
  modelCount: number
  palette: string[]
}

export type UnitV3LiveUnit = PreviewUnit

type PreviewGalleryImage = {
  id: string
  image: string
  alt: string
  isFeatured: boolean
}

const previewUnits: PreviewUnit[] = [
  {
    id: 'guido',
    name: 'Guido (אנשובי)',
    label: 'Featured',
    image: '/onboarding/first-project-bg.jpeg',
    project: 'Samurai Pizza Cats',
    deadline: 'May 23, 2026',
    status: 'Active',
    progress: 40,
    stage: 'Stage 2/6',
    logged: '2h 58m',
    complexity: 3,
    modelCount: 1,
    palette: ['#a92322', '#d6b84d', '#171821', '#e1c58d', '#72c888'],
  },
  {
    id: 'storm-chapel',
    name: 'Storm Chapel',
    label: 'Active',
    image: '/onboarding/pains/tough-choices.jpeg',
    project: 'Gloomhaven 2nd ed.',
    deadline: 'June 4, 2026',
    status: 'Active',
    progress: 15,
    stage: 'Stage 1/5',
    logged: '38m',
    complexity: 2,
    modelCount: 4,
    palette: ['#1e2834', '#9aafbd', '#d8bd83', '#22d3ee', '#a92322'],
  },
  {
    id: 'ashen-patrol',
    name: 'Ashen Patrol',
    label: 'Active',
    image: '/onboarding/pains/paint-management.jpeg',
    project: 'Desert Table',
    deadline: 'June 11, 2026',
    status: 'Active',
    progress: 28,
    stage: 'Stage 2/5',
    logged: '1h 12m',
    complexity: 2,
    modelCount: 3,
    palette: ['#171815', '#7a5d37', '#efe3c5', '#4eb282', '#5aa7c9'],
  },
  {
    id: 'copper-warden',
    name: 'Copper Warden',
    label: 'Active',
    image: '/onboarding/pains/scheme-loss.jpeg',
    project: 'Golden Automaton',
    deadline: 'June 20, 2026',
    status: 'Active',
    progress: 52,
    stage: 'Stage 3/6',
    logged: '3h 24m',
    complexity: 4,
    modelCount: 1,
    palette: ['#d29631', '#7a5d37', '#111417', '#17b9c2', '#efe3c5'],
  },
  {
    id: 'night-market',
    name: 'Night Market',
    label: 'Active',
    image: '/onboarding/pains/pile-of-shame.jpeg',
    project: 'Samurai Pizza Cats',
    deadline: 'July 2, 2026',
    status: 'Active',
    progress: 63,
    stage: 'Stage 4/6',
    logged: '4h 06m',
    complexity: 3,
    modelCount: 2,
    palette: ['#111417', '#5943a7', '#5aa7c9', '#d8bd83', '#b51d20'],
  },
]

const guides = [
  {
    title: 'Tomb Guard Wrappings',
    meta: '5 steps - 4 paints',
    image: '/onboarding/pains/tough-choices.jpeg',
  },
  {
    title: 'Xpress Bleached Bone',
    meta: '3 steps - 2 paints',
    image: '/onboarding/pains/pile-of-shame.jpeg',
  },
]

const gallerySlots = ['hero', 'angle', 'paint', 'detail']

type UnitPaintSession = {
  id: string
  dateKey: string
  startedAt: string
  title: string
  duration: string
  notes: string
}

type ScheduledPaintSession = {
  id?: string
  dateKey: string
  time: string
  duration: string
  focus: string
  notes: string
  notify: boolean
}

const fallbackPaintSessions: UnitPaintSession[] = [
  {
    id: 'fallback-2026-07-01',
    dateKey: '2026-07-01',
    startedAt: '2026-07-01T18:00:00.000Z',
    title: 'Assembled',
    duration: '0h 58m',
    notes: 'Cleaned mold lines, pinned the arm, and tested the base fit.',
  },
  {
    id: 'fallback-2026-07-07',
    dateKey: '2026-07-07',
    startedAt: '2026-07-07T18:00:00.000Z',
    title: 'Prime and first basecoat',
    duration: '0h 42m',
    notes: 'Black primer, teal armor base, and the first pass on cloth.',
  },
  {
    id: 'fallback-2026-07-14',
    dateKey: '2026-07-14',
    startedAt: '2026-07-14T18:00:00.000Z',
    title: 'Shadows blocked in',
    duration: '0h 39m',
    notes: 'Deepened recesses and mapped the cold shadow areas.',
  },
  {
    id: 'fallback-2026-07-21',
    dateKey: '2026-07-21',
    startedAt: '2026-07-21T18:00:00.000Z',
    title: 'Edge highlight pass',
    duration: '0h 39m',
    notes: 'Crisp armor edges, lens cleanup, and base rim touch-up.',
  },
]

const progressStages = [
  {
    id: 'assembled',
    label: 'Assembled',
    title: 'Assembled',
    status: 'complete',
    icon: 'check',
    description: 'Parts cleaned, fitted, assembled, and ready for primer.',
  },
  {
    id: 'primed',
    label: 'Primed',
    title: 'Primed',
    status: 'current',
    icon: 'primer',
    description: 'Primer coat applied and cured',
  },
  {
    id: 'initial-paint',
    label: 'Initial Pa...',
    title: 'Initial Paint',
    status: 'todo',
    icon: 'palette',
    description: 'Block in the main colors before moving into detail work.',
  },
  {
    id: 'fine-detail',
    label: 'Fine Detai...',
    title: 'Fine Detail',
    status: 'todo',
    icon: 'sparkles',
    description: 'Highlights, shadows, lenses, markings, and character moments.',
  },
  {
    id: 'base-rim',
    label: 'Base & Rim',
    title: 'Base & Rim',
    status: 'todo',
    icon: 'mountain',
    description: 'Finish the base texture, edge cleanup, and final rim color.',
  },
  {
    id: 'done',
    label: 'Done',
    title: 'Done',
    status: 'todo',
    icon: 'done',
    description: 'Final photos, project notes, and gallery-ready wrap-up.',
  },
] as const

type ProgressStage = (typeof progressStages)[number]
type ProgressStageIcon = ProgressStage['icon']

const weekDayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

export default function UnitV3Preview({
  id,
  initialTab = 'details',
  liveUnit = null,
}: UnitV3PreviewProps) {
  const [activeTab, setActiveTab] = useState<UnitTab>(initialTab)
  const unit = useMemo(
    () =>
      liveUnit ??
      previewUnits.find((previewUnit) => previewUnit.id === id) ??
      previewUnits[0],
    [id, liveUnit]
  )

  function goBack() {
    if (window.history.length > 1) {
      window.history.back()
      return
    }

    window.location.assign('/dashboard?preview=1')
  }

  return (
    <main
      className={styles.unitSilver}
      data-v3-unit-indicator="root"
      data-v3-unit-source={liveUnit ? 'live' : 'fallback'}
    >
      <V3PerfIndicator surface="unit" detail={activeTab} />
      <div className="mx-auto min-h-dvh w-full max-w-md pb-10" data-v3-unit-indicator="content">
        <section
          className="relative min-h-[252px] overflow-hidden"
          data-v3-unit-indicator="hero"
          data-v3-unit-hero-image={unit.image}
          data-v3-unit-gallery-count={unit.galleryImages?.length ?? 0}
        >
          <Image
            src={unit.image}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, 448px"
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-black/18 to-[#05090b]" />

          <div
            className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-4 pt-5"
            data-v3-unit-indicator="hero-controls"
          >
            <button
              type="button"
              onClick={goBack}
              aria-label="Back"
              className="grid h-10 w-10 place-items-center rounded-full bg-black/28 text-white shadow-[0_10px_28px_rgba(0,0,0,0.28)] backdrop-blur-md transition hover:bg-white/10"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m15 18-6-6 6-6" />
              </svg>
            </button>

            <div className="flex items-center gap-2" data-v3-unit-indicator="hero-actions">
              <button
                type="button"
                aria-label="Edit unit"
                className="grid h-10 w-10 place-items-center rounded-full bg-[#111827]/88 text-white backdrop-blur-md transition hover:text-cyan-300"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                </svg>
              </button>

              <span
                className="rounded-full bg-cyan-300 px-3 py-2 text-[10px] font-black text-black"
                data-v3-unit-indicator="unit-label"
              >
                {unit.label}
              </span>
            </div>
          </div>

          <div className="absolute inset-x-0 bottom-4 z-10 px-4" data-v3-unit-indicator="hero-title">
            <p className="text-[9px] font-black uppercase tracking-[0.28em] text-cyan-300">
              Unit
            </p>
            <h1 className="mt-1 text-[26px] font-black leading-none tracking-normal">
              {unit.name}
            </h1>
          </div>
        </section>

        <div className="px-3">
          <div
            className="grid grid-cols-3 rounded-[8px] border border-white/[0.04] bg-white/[0.055] p-1"
            data-v3-unit-indicator="unit-tabs"
            role="tablist"
            aria-label="Unit sections"
          >
            {(['details', 'paint', 'progress'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={activeTab === tab}
                onClick={() => setActiveTab(tab)}
                className={[
                  'h-10 rounded-[6px] text-xs font-black capitalize transition',
                  activeTab === tab
                    ? 'bg-[#101822] text-cyan-300 shadow-[inset_0_0_24px_rgba(34,211,238,0.06)]'
                    : 'text-white/38 hover:text-white/70',
                ].join(' ')}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="mt-4 grid gap-3" data-v3-unit-indicator="tab-content">
            {activeTab === 'details' ? <DetailsTab unit={unit} /> : null}
            {activeTab === 'paint' ? <PaintTab unit={unit} /> : null}
            {activeTab === 'progress' ? <ProgressTab unit={unit} /> : null}
          </div>
        </div>
      </div>
    </main>
  )
}

function DetailsTab({ unit }: { unit: PreviewUnit }) {
  const galleryImages = getGalleryImages(unit)

  return (
    <>
      <section className="rounded-[8px] border border-white/[0.06] bg-[#111821]">
        <div className="flex items-center justify-between px-4 py-4">
          <h2 className="text-[10px] font-black uppercase tracking-[0.24em] text-white/26">
            Unit Details
          </h2>
          <button
            type="button"
            className="rounded-full px-2 py-1 text-[10px] font-black text-cyan-300 transition hover:bg-cyan-300/10"
          >
            Edit
          </button>
        </div>

        <div className="grid grid-cols-3 border-y border-white/[0.06]">
          <InfoCell label="Complexity">
            <span className="flex gap-1">
              {Array.from({ length: 5 }).map((_, index) => (
                <span
                  key={index}
                  className={[
                    'h-2 w-2 rounded-full',
                    index < unit.complexity ? 'bg-cyan-300' : 'bg-white/12',
                  ].join(' ')}
                />
              ))}
            </span>
          </InfoCell>
          <InfoCell label="Model count">
            <span className="text-lg font-black text-white">{unit.modelCount}</span>
          </InfoCell>
          <InfoCell label="Deadline">
            <span className="text-xs font-black text-yellow-300">{unit.deadline}</span>
          </InfoCell>
        </div>

        <div className="grid grid-cols-[1fr_auto] gap-4 px-4 py-4">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/26">
              Parent Project
            </p>
            <span
              className="mt-2 inline-flex rounded-full bg-cyan-300/12 px-3 py-1.5 text-[10px] font-black text-cyan-300"
              data-v3-unit-indicator="project-chip"
            >
              {unit.project}
            </span>
          </div>
          <div className="text-right">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/26">
              Status
            </p>
            <button
              className="mt-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[10px] font-black text-white/76"
              data-v3-unit-indicator="status-control"
            >
              {unit.status} v
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-[8px] border border-white/[0.06] bg-[#111821] p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[10px] font-black uppercase tracking-[0.24em] text-white/26">
            Palette
          </h2>
          <button
            type="button"
            className="text-[9px] font-black text-white/34 transition hover:text-cyan-300"
          >
            Extract from photo
          </button>
        </div>
        <div className="mt-4 flex items-center gap-3">
          {unit.palette.map((color) => (
            <span
              key={color}
              className="h-9 w-9 rounded-full border border-white/10"
              style={{ backgroundColor: color }}
            />
          ))}
          <button
            type="button"
            aria-label="Add palette color"
            className="grid h-9 w-9 place-items-center rounded-full border border-dashed border-white/18 text-white/28"
          >
            +
          </button>
        </div>
        <button
          type="button"
          className="mt-4 text-[11px] font-black text-cyan-300 transition hover:text-cyan-200"
        >
          Set from theme -&gt;
        </button>
      </section>

      <section className="rounded-[8px] border border-white/[0.06] bg-[#111821]">
        <div className="flex items-center justify-between px-4 py-4">
          <h2 className="text-[10px] font-black uppercase tracking-[0.24em] text-white/26">
            Guides
          </h2>
          <button
            type="button"
            className="rounded-full px-2 py-1 text-[10px] font-black text-cyan-300 transition hover:bg-cyan-300/10"
          >
            Add -&gt;
          </button>
        </div>
        <div className="divide-y divide-white/[0.06]">
          {guides.map((guide) => (
            <button
              key={guide.title}
              type="button"
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white/[0.04]"
            >
              <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-white/10">
                <Image src={guide.image} alt="" fill sizes="36px" className="object-cover" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-black text-white">
                  {guide.title}
                </span>
                <span className="mt-1 block text-[10px] font-black text-white/30">
                  {guide.meta}
                </span>
              </span>
              <span className="text-white/24">&gt;</span>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-[18px] border border-white/[0.06] bg-[#111821] p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[10px] font-black uppercase tracking-[0.24em] text-white/26">
            Gallery
          </h2>
          <button
            type="button"
            className="rounded-full px-2 py-1 text-[10px] font-black text-white/38 transition hover:bg-white/[0.06] hover:text-cyan-300"
          >
            See all -&gt;
          </button>
        </div>

        <div className="mt-8 grid grid-cols-[repeat(5,minmax(0,1fr))] gap-2">
          {galleryImages.map((image, index) => (
            <button
              key={image.id}
              type="button"
              aria-label={`${unit.name} gallery image ${index + 1}`}
              className="relative aspect-[1.32] min-w-0 overflow-hidden rounded-[12px] bg-black transition hover:ring-1 hover:ring-cyan-300/60"
            >
              <Image
                src={image.image}
                alt={image.alt}
                fill
                sizes="72px"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/28" />
              {image.isFeatured ? (
                <span className="absolute bottom-1 left-1 rounded-[6px] bg-cyan-300 px-1.5 py-1 text-[9px] font-black text-black">
                  Hero
                </span>
              ) : null}
            </button>
          ))}

          <button
            type="button"
            aria-label="Add gallery image"
            className="aspect-[1.32] rounded-[12px] border border-dashed border-white/14 bg-white/[0.02] text-xl font-black text-white/16 transition hover:border-cyan-300/45 hover:text-cyan-300"
          >
            +
          </button>
        </div>
      </section>
    </>
  )
}

function getGalleryImages(unit: PreviewUnit) {
  if (unit.galleryImages?.length) {
    return unit.galleryImages.slice(0, 4)
  }

  return gallerySlots.map((slot, index) => ({
    id: `${unit.id}-${slot}`,
    image: unit.image,
    alt: '',
    isFeatured: index === 0,
  }))
}

function getLocalDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function dateFromDateKey(dateKey: string) {
  const [year = '2026', month = '1', day = '1'] = dateKey.split('-')
  return new Date(Number(year), Number(month) - 1, Number(day))
}

function addDays(date: Date, days: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1)
}

function getMonthCursorFromDateKey(dateKey: string) {
  const date = dateFromDateKey(dateKey)
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function getMonthDays(monthCursor: Date) {
  const year = monthCursor.getFullYear()
  const month = monthCursor.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  return {
    offset: new Date(year, month, 1).getDay(),
    days: Array.from({ length: daysInMonth }, (_, index) => {
      const date = new Date(year, month, index + 1)
      return {
        day: index + 1,
        dateKey: getLocalDateKey(date),
      }
    }),
  }
}

function formatMonthLabel(monthCursor: Date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
  }).format(monthCursor)
}

function formatDateLabel(dateKey: string) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(dateFromDateKey(dateKey))
}

function formatScheduleTitle(dateKey: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(dateFromDateKey(dateKey))
}

function groupSessionsByDate<T extends { dateKey: string }>(sessions: T[]) {
  const grouped = new Map<string, T[]>()

  for (const session of sessions) {
    const current = grouped.get(session.dateKey)
    if (current) {
      current.push(session)
    } else {
      grouped.set(session.dateKey, [session])
    }
  }

  return grouped
}

function getInitialPaintDateKey(
  loggedSessions: UnitPaintSession[],
  scheduledSessions: ScheduledPaintSession[]
) {
  return (
    loggedSessions[0]?.dateKey ??
    scheduledSessions[0]?.dateKey ??
    getLocalDateKey(new Date())
  )
}

function PaintTab({ unit }: { unit: PreviewUnit }) {
  const loggedSessions = unit.paintSessions ?? fallbackPaintSessions
  const initialScheduledSessions = unit.scheduledSessions ?? []
  const initialDateKey = getInitialPaintDateKey(
    loggedSessions,
    initialScheduledSessions
  )
  const [monthCursor, setMonthCursor] = useState(() =>
    getMonthCursorFromDateKey(initialDateKey)
  )
  const [selectedDateKey, setSelectedDateKey] = useState(initialDateKey)
  const [scheduledSessions, setScheduledSessions] = useState<
    ScheduledPaintSession[]
  >(initialScheduledSessions)
  const [isScheduleOpen, setIsScheduleOpen] = useState(false)
  const [scheduleTime, setScheduleTime] = useState('19:30')
  const [scheduleDuration, setScheduleDuration] = useState('60')
  const [scheduleFocus, setScheduleFocus] = useState(
    'Prime and first controlled basecoat'
  )
  const [scheduleNotes, setScheduleNotes] = useState(
    'Set paints out before starting.'
  )
  const [scheduleNotify, setScheduleNotify] = useState(false)
  const monthDays = useMemo(() => getMonthDays(monthCursor), [monthCursor])
  const loggedByDate = useMemo(
    () => groupSessionsByDate(loggedSessions),
    [loggedSessions]
  )
  const scheduledByDate = useMemo(
    () => groupSessionsByDate(scheduledSessions),
    [scheduledSessions]
  )
  const selectedLoggedSessions = loggedByDate.get(selectedDateKey) ?? []
  const selectedScheduledSessions = scheduledByDate.get(selectedDateKey) ?? []
  const selectedScheduledSession = selectedScheduledSessions[0]
  const todayKey = getLocalDateKey(new Date())
  const isFutureSelection =
    selectedDateKey > todayKey && selectedLoggedSessions.length === 0
  const nextSchedulableDay =
    selectedDateKey > todayKey
      ? selectedDateKey
      : getLocalDateKey(addDays(new Date(), 1))
  const lastPaintedDateKey = unit.lastPainted ?? loggedSessions[0]?.dateKey
  const lastPaintedLabel = lastPaintedDateKey
    ? `Last ${formatDateLabel(lastPaintedDateKey)}`
    : 'No sessions yet'

  function handleMonthStep(direction: -1 | 1) {
    setMonthCursor((current) => addMonths(current, direction))
  }

  function handleDaySelect(dateKey: string) {
    setSelectedDateKey(dateKey)
  }

  function openScheduleForm(dateKey = nextSchedulableDay) {
    const scheduledSession = scheduledSessions.find(
      (session) => session.dateKey === dateKey
    )
    setSelectedDateKey(dateKey)
    setMonthCursor(getMonthCursorFromDateKey(dateKey))
    if (scheduledSession) {
      setScheduleTime(scheduledSession.time)
      setScheduleDuration(scheduledSession.duration)
      setScheduleFocus(scheduledSession.focus)
      setScheduleNotes(scheduledSession.notes)
      setScheduleNotify(scheduledSession.notify)
    } else {
      setScheduleTime('19:30')
      setScheduleDuration('60')
      setScheduleFocus('Prime and first controlled basecoat')
      setScheduleNotes('Set paints out before starting.')
      setScheduleNotify(false)
    }
    setIsScheduleOpen(true)
  }

  function handleScheduleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setScheduledSessions((current) => {
      const nextSession = {
        id: selectedScheduledSession?.id ?? `local-${selectedDateKey}`,
        dateKey: selectedDateKey,
        time: scheduleTime,
        duration: scheduleDuration,
        focus: scheduleFocus.trim() || 'Focused painting session',
        notes: scheduleNotes.trim(),
        notify: scheduleNotify,
      }
      const withoutSelectedDay = current.filter(
        (session) => session.dateKey !== selectedDateKey
      )

      return [...withoutSelectedDay, nextSession]
    })
    setIsScheduleOpen(false)
  }

  return (
    <>
      <section className="rounded-[14px] border border-white/[0.06] bg-[#111821] p-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.26em] text-white/28">
              Time Logged
            </p>
            <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <p className="text-[29px] font-black leading-none text-white">
                {unit.logged}
              </p>
              <p className="text-[10px] font-black text-white/28">
                {lastPaintedLabel}
              </p>
            </div>
          </div>

          <button
            type="button"
            className="mb-1 rounded-full px-2 py-1 text-[10px] font-black text-white/34 transition hover:bg-white/[0.06] hover:text-cyan-300"
          >
            History -&gt;
          </button>
        </div>

        <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
          <button
            type="button"
            className="tap-press flex h-11 items-center justify-center gap-2 rounded-[10px] bg-cyan-400 text-sm font-black text-black shadow-[0_0_28px_rgba(34,211,238,0.22)] transition hover:bg-cyan-300"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="currentColor"
            >
              <path d="M8 5v14l11-7Z" />
            </svg>
            Start Painting
          </button>

          <button
            type="button"
            onClick={() => openScheduleForm()}
            className="tap-press h-11 rounded-[10px] border border-cyan-300/40 bg-cyan-300/10 px-4 text-sm font-black text-cyan-200 transition hover:bg-cyan-300 hover:text-black"
          >
            Schedule
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-[14px] border border-white/[0.06] bg-[#111821]">
        <div className="flex items-center justify-between border-b border-white/[0.05] px-3 py-3">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => handleMonthStep(-1)}
            className="grid h-8 w-8 place-items-center rounded-full bg-white/[0.06] text-white/38 transition hover:text-white"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>

          <h2
            className="text-sm font-black text-white"
            data-v3-unit-calendar-month={formatMonthLabel(monthCursor)}
          >
            {formatMonthLabel(monthCursor)}
          </h2>

          <button
            type="button"
            aria-label="Next month"
            onClick={() => handleMonthStep(1)}
            className="grid h-8 w-8 place-items-center rounded-full bg-white/[0.06] text-white/38 transition hover:text-white"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-7 px-3 pt-4 text-center text-[10px] font-black text-white/28">
          {weekDayLabels.map((dayLabel, index) => (
            <span key={`${dayLabel}-${index}`}>{dayLabel}</span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-y-1 px-3 py-4">
          {Array.from({ length: monthDays.offset }).map((_, index) => (
            <span key={`blank-${index}`} className="h-12" />
          ))}

          {monthDays.days.map((day) => {
            const loggedCount = loggedByDate.get(day.dateKey)?.length ?? 0
            const scheduledCount = scheduledByDate.get(day.dateKey)?.length ?? 0
            const hasLogged = loggedCount > 0
            const hasScheduled = scheduledCount > 0
            const isSelected = selectedDateKey === day.dateKey
            const isFuture = day.dateKey > todayKey

            return (
              <button
                key={day.dateKey}
                type="button"
                onClick={() => handleDaySelect(day.dateKey)}
                aria-label={
                  hasLogged
                    ? `${formatDateLabel(day.dateKey)}, ${loggedCount} painting session logged`
                    : hasScheduled
                      ? `Painting session scheduled on ${formatScheduleTitle(day.dateKey)}`
                    : isFuture
                      ? `Schedule painting session on ${formatScheduleTitle(day.dateKey)}`
                      : formatScheduleTitle(day.dateKey)
                }
                className={[
                  'mx-auto flex h-12 w-12 flex-col items-center justify-center rounded-[12px] text-xs font-black transition',
                  hasLogged
                    ? 'bg-cyan-300/16 text-cyan-300'
                    : hasScheduled
                      ? 'bg-yellow-300/12 text-yellow-200'
                    : 'text-white/42 hover:bg-white/[0.05] hover:text-white/72',
                  isSelected
                    ? 'border border-cyan-300/50 bg-cyan-300/20 text-cyan-200 shadow-[0_0_24px_rgba(34,211,238,0.12)]'
                    : 'border border-transparent',
                  isFuture && !hasLogged ? 'hover:border-cyan-300/35' : '',
                ].join(' ')}
              >
                <span>{day.day}</span>
                {hasLogged ? (
                  <span className="mt-1 h-1 w-1 rounded-full bg-cyan-300" />
                ) : null}
                {!hasLogged && hasScheduled ? (
                  <span className="mt-1 h-1 w-1 rounded-full bg-yellow-300" />
                ) : null}
              </button>
            )
          })}
        </div>

        {selectedLoggedSessions.length ? (
          <div className="border-t border-white/[0.06] px-4 py-4">
            <div className="flex items-start justify-between gap-4">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-white/34">
                {formatDateLabel(selectedDateKey)}
              </p>
              <button
                type="button"
                className="rounded-full px-2 py-1 text-[10px] font-black text-cyan-300 transition hover:bg-cyan-300/10"
              >
                + Add
              </button>
            </div>
            <div className="mt-4 grid gap-4">
              {selectedLoggedSessions.map((session) => (
                <div
                  key={session.id}
                  className="flex items-start justify-between gap-4"
                >
                  <div>
                    <h3 className="text-lg font-black text-white">
                      {session.title}
                    </h3>
                    <p className="mt-2 text-xs font-black text-white/36">
                      {session.duration}
                    </p>
                    {session.notes ? (
                      <p className="mt-3 text-xs font-semibold leading-5 text-white/45">
                        {session.notes}
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    aria-label="Edit session"
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/[0.06] text-white/36 transition hover:text-cyan-300"
                  >
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {selectedScheduledSession ? (
          <div className="border-t border-white/[0.06] px-4 py-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-yellow-300">
                  Scheduled Session
                </p>
                <h3 className="mt-3 text-lg font-black text-white">
                  {formatScheduleTitle(selectedScheduledSession.dateKey)} at{' '}
                  {selectedScheduledSession.time}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => openScheduleForm(selectedScheduledSession.dateKey)}
                className="rounded-full px-2 py-1 text-[10px] font-black text-cyan-300 transition hover:bg-cyan-300/10"
              >
                Edit
              </button>
            </div>
            <p className="mt-2 text-xs font-black text-white/36">
              {selectedScheduledSession.duration}m planned
              {selectedScheduledSession.notify ? ' - notify enabled' : ''}
            </p>
            <p className="mt-3 text-sm font-black leading-5 text-white/72">
              {selectedScheduledSession.focus}
            </p>
            {selectedScheduledSession.notes ? (
              <p className="mt-2 text-xs font-semibold leading-5 text-white/42">
                {selectedScheduledSession.notes}
              </p>
            ) : null}
          </div>
        ) : null}

        {isFutureSelection && !selectedScheduledSession ? (
          <div className="border-t border-white/[0.06] px-4 py-4">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300">
              Future Session
            </p>
            <h3 className="mt-3 text-lg font-black text-white">
              Schedule {formatScheduleTitle(selectedDateKey)}
            </h3>
            <p className="mt-2 text-xs font-semibold leading-5 text-white/45">
              Hold time for a focused painting session and decide what to work
              on before the brush hits the desk.
            </p>
            <button
              type="button"
              onClick={() => openScheduleForm(selectedDateKey)}
              className="mt-4 h-11 w-full rounded-[10px] border border-cyan-300/40 bg-cyan-300/10 text-sm font-black text-cyan-200 transition hover:bg-cyan-300 hover:text-black"
            >
              Schedule Painting Session
            </button>
          </div>
        ) : null}
      </section>

      <button
        type="button"
        className="tap-press flex h-14 items-center justify-center gap-3 rounded-[14px] border border-dashed border-white/12 bg-black/18 text-sm font-black text-white/45 transition hover:border-cyan-300/45 hover:text-cyan-200"
      >
        <span className="text-xl leading-none">+</span>
        Log a Session Manually
      </button>

      {isScheduleOpen ? (
        <div
          className="fixed inset-0 z-[70] grid place-items-end bg-black/65 px-3 py-4 backdrop-blur-sm"
          data-v3-unit-indicator="schedule-scrim"
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="schedule-session-title"
            className="w-full max-w-md rounded-[14px] border border-white/10 bg-[#10161d] p-4 shadow-2xl shadow-black/50"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">
                  Schedule
                </p>
                <h2
                  id="schedule-session-title"
                  className="mt-1 text-2xl font-black leading-tight"
                >
                  {formatScheduleTitle(selectedDateKey)} session
                </h2>
              </div>
              <button
                type="button"
                aria-label="Close schedule session"
                onClick={() => setIsScheduleOpen(false)}
                className="grid h-10 w-10 place-items-center rounded-full bg-white/[0.06] text-lg font-black text-white/48 transition hover:text-white"
              >
                x
              </button>
            </div>

            <form onSubmit={handleScheduleSubmit} className="mt-5 grid gap-4">
              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-2">
                  <span className="text-xs font-black uppercase tracking-[0.18em] text-white/42">
                    Time
                  </span>
                  <input
                    type="time"
                    value={scheduleTime}
                    onChange={(event) => setScheduleTime(event.target.value)}
                    className="h-12 rounded-[10px] border border-white/10 bg-black/24 px-4 text-sm font-black text-white outline-none transition focus:border-cyan-300/70"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-xs font-black uppercase tracking-[0.18em] text-white/42">
                    Minutes
                  </span>
                  <input
                    inputMode="numeric"
                    value={scheduleDuration}
                    onChange={(event) =>
                      setScheduleDuration(event.target.value)
                    }
                    className="h-12 rounded-[10px] border border-white/10 bg-black/24 px-4 text-sm font-black text-white outline-none transition focus:border-cyan-300/70"
                  />
                </label>
              </div>

              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-[0.18em] text-white/42">
                  Focus
                </span>
                <input
                  value={scheduleFocus}
                  onChange={(event) => setScheduleFocus(event.target.value)}
                  className="h-12 rounded-[10px] border border-white/10 bg-black/24 px-4 text-sm font-semibold text-white outline-none transition focus:border-cyan-300/70"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-[0.18em] text-white/42">
                  Notes
                </span>
                <textarea
                  rows={3}
                  value={scheduleNotes}
                  onChange={(event) => setScheduleNotes(event.target.value)}
                  className="resize-none rounded-[10px] border border-white/10 bg-black/24 px-4 py-3 text-sm font-semibold text-white outline-none transition focus:border-cyan-300/70"
                />
              </label>

              <label className="flex items-center gap-3 rounded-[10px] border border-white/10 bg-black/24 px-4 py-3 text-sm font-black text-white/62">
                <input
                  type="checkbox"
                  checked={scheduleNotify}
                  onChange={(event) => setScheduleNotify(event.target.checked)}
                  className="h-4 w-4 accent-cyan-300"
                />
                Notify me before this session
              </label>

              <button
                type="submit"
                className="h-12 rounded-[10px] bg-cyan-300 text-sm font-black text-black transition hover:bg-cyan-200"
              >
                Save Scheduled Session
              </button>
            </form>
          </section>
        </div>
      ) : null}
    </>
  )
}

function ProgressTab({ unit }: { unit: PreviewUnit }) {
  const [selectedStageId, setSelectedStageId] =
    useState<ProgressStage['id']>('primed')
  const selectedStage =
    progressStages.find((stage) => stage.id === selectedStageId) ??
    progressStages[1]

  return (
    <>
      <section className="border-b border-white/[0.08] pb-5">
        <div className="grid grid-cols-6 gap-2">
          {progressStages.map((stage) => {
            const isSelected = selectedStage.id === stage.id
            const isComplete = stage.status === 'complete'
            const isCurrent = stage.status === 'current'

            return (
              <button
                key={stage.id}
                type="button"
                onClick={() => setSelectedStageId(stage.id)}
                aria-pressed={isSelected}
                className="group grid min-w-0 justify-items-center gap-2 text-center"
              >
                <span
                  className={[
                    'grid h-12 w-12 place-items-center rounded-full border transition',
                    isSelected
                      ? 'border-cyan-300 bg-cyan-300/10 text-cyan-300 shadow-[0_0_24px_rgba(34,211,238,0.18)]'
                      : '',
                    !isSelected && isComplete
                      ? 'border-transparent bg-cyan-300/14 text-cyan-300'
                      : '',
                    !isSelected && isCurrent
                      ? 'border-cyan-300/60 bg-cyan-300/8 text-cyan-300'
                      : '',
                    !isSelected && !isComplete && !isCurrent
                      ? 'border-transparent bg-white/[0.06] text-white/36 group-hover:text-white/64'
                      : '',
                  ].join(' ')}
                >
                  <StageIcon name={stage.icon} />
                </span>
                <span
                  className={[
                    'max-w-full truncate text-[10px] font-black',
                    isSelected || isComplete || isCurrent
                      ? 'text-cyan-300'
                      : 'text-white/24 group-hover:text-white/50',
                  ].join(' ')}
                >
                  {stage.label}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      <section className="rounded-[18px] border border-white/[0.06] bg-[#111821] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.22)]">
        <div className="flex items-start gap-4">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-cyan-300/12 text-cyan-300">
            <StageIcon name={selectedStage.icon} />
          </span>

          <div className="min-w-0 pt-1">
            <h2 className="text-xl font-black leading-none text-white">
              {selectedStage.title}
            </h2>
            <p
              className={[
                'mt-2 text-[10px] font-black uppercase tracking-[0.18em]',
                selectedStage.status === 'current'
                  ? 'text-yellow-300'
                  : selectedStage.status === 'complete'
                    ? 'text-cyan-300'
                    : 'text-white/30',
              ].join(' ')}
            >
              {getStageStatusLabel(selectedStage.status)}
            </p>
          </div>
        </div>

        <p className="mt-6 text-base font-semibold leading-6 text-white/58">
          {selectedStage.description}
        </p>

        <div className="mt-5 grid grid-cols-3 gap-2">
          <StageToolButton icon="photo">Photos</StageToolButton>
          <StageToolButton icon="paint">Paints</StageToolButton>
          <StageToolButton icon="note">Notes</StageToolButton>
        </div>

        <button
          type="button"
          className="tap-press mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-[14px] bg-cyan-400 text-base font-black text-black shadow-[0_0_28px_rgba(34,211,238,0.22)] transition hover:bg-cyan-300"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m5 12 4 4L19 6" />
          </svg>
          Mark Stage Complete
        </button>

        <div className="mt-4 flex items-center justify-between text-[10px] font-black uppercase tracking-[0.18em] text-white/22">
          <span>{unit.stage}</span>
          <span>{unit.progress}% overall</span>
        </div>
      </section>
    </>
  )
}

function getStageStatusLabel(status: ProgressStage['status']) {
  if (status === 'complete') {
    return 'Complete'
  }

  if (status === 'current') {
    return 'In progress'
  }

  return 'Up next'
}

function StageToolButton({
  children,
  icon,
}: {
  children: ReactNode
  icon: 'photo' | 'paint' | 'note'
}) {
  return (
    <button
      type="button"
      data-v3-unit-indicator="stage-tool-button"
      className="flex h-11 min-w-0 items-center justify-center gap-2 rounded-full bg-white/[0.06] px-2 text-sm font-black text-white/44 transition hover:bg-white/[0.1] hover:text-cyan-200"
    >
      <StageToolIcon name={icon} />
      <span className="truncate">{children}</span>
    </button>
  )
}

function StageIcon({ name }: { name: ProgressStageIcon }) {
  if (name === 'check') {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m5 12 4 4L19 6" />
      </svg>
    )
  }

  if (name === 'primer') {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M8 5h8v14H8z" />
        <path d="M10 8h4" />
        <path d="M10 16h4" />
      </svg>
    )
  }

  if (name === 'palette') {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 21a9 9 0 1 1 8.4-5.7c-.6 1.4-2 1.7-3.2 1.5-.9-.1-1.7.5-1.7 1.4 0 1.6-1.3 2.8-3.5 2.8Z" />
        <path d="M7.5 10h.01" />
        <path d="M10 6.7h.01" />
        <path d="M14.4 6.9h.01" />
        <path d="M16.8 10.5h.01" />
      </svg>
    )
  }

  if (name === 'sparkles') {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 3 14 9l6 2-6 2-2 6-2-6-6-2 6-2Z" />
        <path d="M19 3v4" />
        <path d="M21 5h-4" />
        <path d="M5 17v3" />
        <path d="M6.5 18.5h-3" />
      </svg>
    )
  }

  if (name === 'mountain') {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m3 18 6-8 4 5 3-4 5 7Z" />
        <path d="M9 10 7.5 18" />
      </svg>
    )
  }

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 5h14v14H5z" />
      <path d="m8 12 3 3 5-6" />
    </svg>
  )
}

function StageToolIcon({ name }: { name: 'photo' | 'paint' | 'note' }) {
  if (name === 'photo') {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-4 w-4 shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M14.5 5 13 3H8L6.5 5H4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Z" />
        <circle cx="12" cy="13" r="3" />
      </svg>
    )
  }

  if (name === 'paint') {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-4 w-4 shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 21a9 9 0 1 1 8.4-5.7c-.6 1.4-2 1.7-3.2 1.5-.9-.1-1.7.5-1.7 1.4 0 1.6-1.3 2.8-3.5 2.8Z" />
        <path d="M8 10h.01" />
        <path d="M12 7h.01" />
        <path d="M16 10h.01" />
      </svg>
    )
  }

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 20h16" />
      <path d="m14 4 6 6-9 9H5v-6Z" />
      <path d="m14 4-9 9" />
    </svg>
  )
}

function InfoCell({
  children,
  label,
}: {
  children: ReactNode
  label: string
}) {
  return (
    <div className="min-h-20 border-r border-white/[0.06] px-4 py-3 last:border-r-0">
      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/26">
        {label}
      </p>
      <div className="mt-3">{children}</div>
    </div>
  )
}
