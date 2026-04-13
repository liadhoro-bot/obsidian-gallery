'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  endUnitSession,
  expireUnitSessionAtTwoHours,
  setFeaturedUnitImage,
  startUnitSession,
  toggleUnitActive,
  updateUnitDetails,
} from './actions'
import { createClient } from '../../../utils/supabase/client'
import { toggleStepDone } from './actions'

type Unit = {
  id: string
  name: string
  complexity: number | null
  unit_size: number | null
  is_active: boolean
  project_id: string | null
}

type UnitImage = {
  id: string
  image_url: string
  is_featured: boolean
  created_at: string
  sort_order: number | null
  alt_text: string | null
  storage_bucket: string | null
  storage_path: string | null
}

type ProgressStep = {
  id: string
  step_key: string
  step_label: string
  step_order: number
  status: 'pending' | 'in_progress' | 'done'
  progress: number
}

type Session = {
  id: string
  started_at: string
  ended_at: string | null
  duration_seconds: number | null
  user_id?: string | null
}

type Props = {
  unit: Unit
  images: UnitImage[]
  featuredImage: UnitImage | null
  steps: ProgressStep[]
  totalLoggedSeconds: number
  activeSession: Session | null
  sessions: Session[]
}

function formatDuration(seconds: number) {
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)

  if (hrs === 0) {
    return `${mins}m`
  }

  return `${hrs}.${Math.floor((mins / 60) * 10)}h`
}

function formatLiveDuration(startedAt: string) {
  const diff = Math.max(
    0,
    Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)
  )

  const hrs = Math.floor(diff / 3600)
  const mins = Math.floor((diff % 3600) / 60)
  const secs = diff % 60

  return `${hrs.toString().padStart(2, '0')}:${mins
    .toString()
    .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}
function formatDateTime(value: string) {
  return new Date(value).toLocaleString()
}

function formatSessionDuration(seconds: number | null) {
  if (!seconds) {
    return '—'
  }

  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)

  if (hrs === 0) {
    return `${mins}m`
  }

  return `${hrs}h ${mins}m`
}

export default function UnitDetailClient({
  unit,
  images,
  featuredImage,
  steps,
  totalLoggedSeconds,
  activeSession,
  sessions,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [liveNow, setLiveNow] = useState(Date.now())
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [isEditingDetails, setIsEditingDetails] = useState(false)
const [complexityInput, setComplexityInput] = useState(
  unit.complexity ? String(unit.complexity) : ''
)
const [unitSizeInput, setUnitSizeInput] = useState(
  unit.unit_size ? String(unit.unit_size) : ''
)

    useEffect(() => {
    if (!activeSession) {
      return
    }

    const interval = setInterval(() => {
      setLiveNow(Date.now())
    }, 1000)

    const startedAtMs = new Date(activeSession.started_at).getTime()
    const stopAtMs = startedAtMs + 7200 * 1000
    const delay = Math.max(0, stopAtMs - Date.now())

    const timeout = setTimeout(() => {
      startTransition(async () => {
        await expireUnitSessionAtTwoHours(unit.id)
        router.refresh()
      })
    }, delay)

    return () => {
      clearInterval(interval)
      clearTimeout(timeout)
    }
  }, [activeSession, unit.id, router, startTransition])

  const displayedLoggedSeconds = activeSession
    ? totalLoggedSeconds +
      Math.min(
        7200,
        Math.floor((liveNow - new Date(activeSession.started_at).getTime()) / 1000)
      )
    : totalLoggedSeconds

  const completedCount = steps.filter((step) => step.status === 'done').length
    const recentSessions = sessions
    .filter((session) => session.ended_at !== null)
    .slice(0, 5)

  const handleToggleActive = (nextValue: boolean) => {
    startTransition(async () => {
      await toggleUnitActive(unit.id, nextValue)
      router.refresh()
    })
  }

  const handleStartSession = () => {
    startTransition(async () => {
      await startUnitSession(unit.id)
      router.refresh()
    })
  }

  const handleEndSession = () => {
    startTransition(async () => {
      await endUnitSession(unit.id)
      router.refresh()
    })
  }
const handleUpdateDetails = (formData: FormData) => {
  startTransition(async () => {
    await updateUnitDetails(formData)
    setIsEditingDetails(false)
    router.refresh()
  })
}
  const handleSetFeatured = (imageId: string) => {
    startTransition(async () => {
      await setFeaturedUnitImage(unit.id, imageId)
      router.refresh()
    })
  }

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    const supabase = createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      alert('You must be logged in.')
      return
    }

    const fileExt = file.name.split('.').pop() || 'jpg'
    const filePath = `units/${unit.id}/${crypto.randomUUID()}.${fileExt}`

    const { error: uploadError } = await supabase.storage
      .from('obsidian-images')
      .upload(filePath, file)

    if (uploadError) {
      alert(uploadError.message)
      return
    }

    const { data } = supabase.storage
      .from('obsidian-images')
      .getPublicUrl(filePath)

    const { error: insertError } = await supabase
      .from('image_assets')
      .insert({
        entity_type: 'unit',
        entity_id: unit.id,
        image_url: data.publicUrl,
        user_id: user.id,
        storage_bucket: 'obsidian-images',
        storage_path: filePath,
        is_featured: images.length === 0,
        sort_order: 0,
      })

    if (insertError) {
      alert(insertError.message)
      return
    }

    event.target.value = ''
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-[#050b12] pb-24 text-white">
  <div className="mx-auto max-w-3xl">
      <div className="relative">
        <div className="relative h-[260px] w-full overflow-hidden">
          {featuredImage ? (
            <Image
              src={featuredImage.image_url}
              alt={featuredImage.alt_text || unit.name}
              fill
              className="object-cover opacity-50"
            />
          ) : (
            <div className="h-full w-full bg-[#0b1622]" />
          )}

          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-[#050b12]" />
        </div>

        <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-4 pt-4">
          <Link href="/" className="text-sm text-cyan-400">
            ← Back
          </Link>

          <button
            type="button"
            onClick={() => handleToggleActive(!unit.is_active)}
            className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide ${
              unit.is_active
                ? 'bg-cyan-400 text-black'
                : 'bg-white/10 text-white'
            }`}
            disabled={isPending}
          >
            {unit.is_active ? 'Active' : 'Inactive'}
          </button>
        </div>

        <div className="absolute inset-x-0 bottom-0 z-10 px-4 pb-6">
          <p className="text-xs uppercase tracking-[0.25em] text-cyan-400">
            Unit Details
          </p>
          <h1 className="mt-2 text-4xl font-bold leading-tight">
            {unit.name}
          </h1>
        </div>
      </div>

      <div className="px-4">
        <div className="-mt-2 grid grid-cols-3 gap-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-[11px] uppercase tracking-wide text-white/50">
              Time Logged
            </div>
            <div className="mt-2 text-xl font-bold">
              {formatDuration(displayedLoggedSeconds)}
            </div>
          </div>

<div className="col-span-2 rounded-2xl border border-white/10 bg-white/5 p-4">
  <div className="mb-3 flex items-center justify-between">
    <div className="text-[11px] uppercase tracking-wide text-white/50">
      Unit Details
    </div>

    {!isEditingDetails ? (
      <button
        type="button"
        onClick={() => setIsEditingDetails(true)}
        className="text-xs text-cyan-400"
      >
        Edit
      </button>
    ) : (
      <button
        type="button"
        onClick={() => {
          setIsEditingDetails(false)
          setComplexityInput(unit.complexity ? String(unit.complexity) : '')
          setUnitSizeInput(unit.unit_size ? String(unit.unit_size) : '')
        }}
        className="text-xs text-white/60"
      >
        Cancel
      </button>
    )}
  </div>

  {!isEditingDetails ? (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <div className="text-[11px] text-white/50">Complexity</div>
        <div className="text-lg font-bold">
          {unit.complexity ? `${unit.complexity}/10` : '—'}
        </div>
      </div>

      <div>
        <div className="text-[11px] text-white/50">Unit Size</div>
        <div className="text-lg font-bold">
          {unit.unit_size || '—'}
        </div>
      </div>
    </div>
  ) : (
    <form action={handleUpdateDetails} className="space-y-3">
      <input type="hidden" name="unitId" value={unit.id} />

      <div>
        <label className="text-xs text-white/50">Complexity (1–10)</label>
        <input
          name="complexity"
          type="number"
          min="1"
          max="10"
          value={complexityInput}
          onChange={(e) => setComplexityInput(e.target.value)}
          className="mt-1 w-full rounded-lg bg-black/40 px-3 py-2 text-sm text-white"
        />
      </div>

      <div>
        <label className="text-xs text-white/50">Unit Size</label>
        <input
          name="unit_size"
          type="number"
          min="1"
          value={unitSizeInput}
          onChange={(e) => setUnitSizeInput(e.target.value)}
          className="mt-1 w-full rounded-lg bg-black/40 px-3 py-2 text-sm text-white"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-xl bg-cyan-400 px-4 py-2 text-sm font-bold text-black"
      >
        Save Changes
      </button>
    </form>
  )}
</div>
        </div>

        <div className="mt-4">
          {!activeSession ? (
            <button
              type="button"
              onClick={handleStartSession}
              disabled={isPending}
              className="w-full rounded-2xl bg-cyan-400 px-4 py-4 text-sm font-bold uppercase tracking-[0.2em] text-black shadow-[0_0_30px_rgba(34,211,238,0.25)]"
            >
              ▶ Start Session
            </button>
          ) : (
            <div className="rounded-2xl border border-cyan-400/40 bg-cyan-400/10 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase tracking-wide text-cyan-300">
                    Session Running
                  </div>
                  <div className="mt-1 text-2xl font-bold">
                    {formatLiveDuration(activeSession.started_at)}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleEndSession}
                  disabled={isPending}
                  className="rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white"
                >
                  Stop
                </button>
              </div>
            </div>
          )}
        </div>
                <section className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold">Recent Sessions</h2>
            <span className="text-xs uppercase tracking-wide text-white/40">
              Last 5
            </span>
          </div>

          {recentSessions.length === 0 ? (
            <div className="text-sm text-white/50">
              No completed sessions yet.
            </div>
          ) : (
            <div className="space-y-3">
              {recentSessions.map((session) => (
                <div
                  key={session.id}
                  className="rounded-xl border border-white/10 bg-black/20 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-white/40">
                        Started
                      </div>
                      <div className="text-sm font-medium">
                        {formatDateTime(session.started_at)}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xs uppercase tracking-wide text-white/40">
                        Duration
                      </div>
                      <div className="text-sm font-bold text-cyan-400">
                        {formatSessionDuration(session.duration_seconds)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-2">
                    <div className="text-xs uppercase tracking-wide text-white/40">
                      Ended
                    </div>
                    <div className="text-sm text-white/70">
                      {session.ended_at ? formatDateTime(session.ended_at) : '—'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mt-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-bold">Progress Stages</h2>
            <span className="text-sm text-cyan-400">
              {completedCount}/{steps.length}
            </span>
          </div>

          {(() => {
  const visibleSteps = steps
    .filter((s) => s.step_key !== 'done')
    .sort((a, b) => a.step_order - b.step_order)

  const doneStepIdsInOrder = visibleSteps
    .filter((s) => s.status === 'done')
    .map((s) => s.id)

const finalDoneStep = steps.find((s) => s.step_key === 'done')
const showFinalDone = finalDoneStep?.status === 'done'
  return (
    <div className="space-y-3">
      {visibleSteps.map((step) => {
        const isDone = step.status === 'done'
        const doneIndex = doneStepIdsInOrder.indexOf(step.id)
        const percent = isDone ? (doneIndex + 1) * 20 : 0

        return (
          <form key={step.id} action={toggleStepDone}>
            <input type="hidden" name="stepId" value={step.id} />
            <input type="hidden" name="unitId" value={unit.id} />
            <input
              type="hidden"
              name="nextStatus"
              value={isDone ? 'pending' : 'done'}
            />

            <button
              type="submit"
              className="flex w-full items-center gap-4 rounded-2xl bg-neutral-900 px-4 py-4"
            >
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${
                  isDone
                    ? 'border-cyan-400 bg-cyan-400 text-black'
                    : 'border-neutral-700 bg-neutral-950 text-neutral-500'
                }`}
              >
                {isDone ? '✓' : '○'}
              </div>

              <div className="flex-1 text-left">
                <p className={isDone ? 'font-semibold text-white' : 'text-neutral-400'}>
                  {step.step_label}
                </p>
              </div>

              <div className={isDone ? 'font-semibold text-cyan-400' : 'text-neutral-500'}>
                {percent}%
              </div>
            </button>
          </form>
        )
      })}
            {showFinalDone && (
        <div className="flex w-full items-center gap-4 rounded-2xl bg-cyan-400 px-4 py-4 text-black">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-black/20 bg-black/10">
            ✓
          </div>

          <div className="flex-1 text-left">
            <p className="font-semibold">
              {finalDoneStep?.step_label || 'Done'}
            </p>
          </div>

          <div className="font-semibold">
            100%
          </div>
        </div>
      )}
    </div>
  )
})()}
        </section>

        <section className="mt-10">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Inspiration & Art Gallery</h2>
              <p className="text-sm text-white/50">
                Concept art and reference images
              </p>
            </div>

            <button
              type="button"
              onClick={handleUploadClick}
              className="text-sm font-semibold uppercase tracking-wide text-cyan-400"
            >
              Add Image +
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />

          <div className="mt-4 grid grid-cols-2 gap-4">
            {images.map((image) => (
              <button
                key={image.id}
                type="button"
                onClick={() => handleSetFeatured(image.id)}
                className={`group relative aspect-square overflow-hidden rounded-2xl border ${
                  image.is_featured
                    ? 'border-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.2)]'
                    : 'border-white/10'
                }`}
              >
                <Image
                  src={image.image_url}
                  alt={image.alt_text || unit.name}
                  fill
                  className="object-cover transition group-hover:scale-105"
                />

                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

                {image.is_featured && (
                  <div className="absolute left-2 top-2 rounded-full bg-cyan-400 px-2 py-1 text-[10px] font-bold uppercase text-black">
                    Featured
                  </div>
                )}

                <div className="absolute bottom-2 left-2 text-xs font-semibold text-white">
                  {image.is_featured ? 'Main Thumbnail' : 'Set as featured'}
                </div>
              </button>
            ))}

            <button
              type="button"
              onClick={handleUploadClick}
              className="flex aspect-square items-center justify-center rounded-2xl border border-dashed border-white/20 bg-white/[0.03] text-sm font-medium text-white/60"
            >
              Upload Reference
            </button>
          </div>
        </section>
      </div>

            </div>

      <nav className="fixed bottom-0 left-0 right-0 border-t border-white/10 bg-[#07111b]/95 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-around px-4 py-3 text-xs text-white/70">
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/" className="text-cyan-400">
            Projects
          </Link>
          <Link href="/vault">Vault</Link>
          <Link href="/recipes">Recipes</Link>
        </div>
      </nav>
    </div>
  )
}