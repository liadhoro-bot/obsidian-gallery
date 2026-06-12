'use client'

import Image from 'next/image'
import { useMemo, useState } from 'react'
import SubmitButton from '../../components/SubmitButton'

type Props = {
  projectId: string
  addUnitAction: (formData: FormData) => Promise<void>
}

export default function ProjectAddUnitTab({
  projectId,
  addUnitAction,
}: Props) {
  const [name, setName] = useState('')
  const [modelCount, setModelCount] = useState('1')
  const [deadline, setDeadline] = useState('')
  const [notes, setNotes] = useState('')
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  const previewName = useMemo(
    () => name.trim() || 'Skeleton Warriors',
    [name]
  )
  const previewNotes = useMemo(
    () => notes.trim() || 'Ready for assembly, paint stages, and session notes.',
    [notes]
  )
  const formattedDeadline = useMemo(() => {
    if (!deadline) return 'No deadline set'

    try {
      return new Intl.DateTimeFormat('en', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }).format(new Date(`${deadline}T12:00:00`))
    } catch {
      return 'No deadline set'
    }
  }, [deadline])

  function handleImageChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]

    setImagePreview(file ? URL.createObjectURL(file) : null)
  }

  return (
    <section className="mt-5 rounded-2xl border border-neutral-800 bg-gradient-to-br from-neutral-900 to-neutral-950 p-5 shadow-sm">
      <p className="text-sm uppercase tracking-wider text-cyan-400">
        Add Unit
      </p>
      <h2 className="mt-1 text-xl font-semibold">Create a New Unit</h2>
      <p className="mt-2 text-sm text-neutral-400">
        Add a unit, squad, character, vehicle, or display piece to this project.
      </p>

      <form action={addUnitAction} className="mt-5 space-y-4">
        <input type="hidden" name="projectId" value={projectId} />

        <div>
          <label className="mb-1 block text-sm text-neutral-300">
            Unit Name
          </label>
          <input
            name="name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-3 text-white outline-none transition focus:border-cyan-500"
            placeholder="e.g. Skeleton Warriors"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-neutral-300">
            Model Count
          </label>
          <input
            name="modelCount"
            type="number"
            min="1"
            value={modelCount}
            onChange={(event) => setModelCount(event.target.value)}
            className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-3 text-white outline-none transition focus:border-cyan-500"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-neutral-300">
            Deadline
          </label>
          <input
            name="deadline"
            type="date"
            value={deadline}
            onChange={(event) => setDeadline(event.target.value)}
            className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-3 text-white outline-none transition focus:border-cyan-500"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-neutral-300">
            First Picture
          </label>
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-neutral-700 bg-neutral-900 p-3 transition hover:border-cyan-500/60">
            <span className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white/[0.06] text-2xl text-white/45">
              {imagePreview ? (
                <Image
                  src={imagePreview}
                  alt=""
                  fill
                  className="object-cover"
                  unoptimized
                />
              ) : (
                '+'
              )}
            </span>
            <span className="min-w-0 text-sm text-neutral-400">
              Add the first unit photo so this card has a thumbnail immediately.
            </span>
            <input
              name="image"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleImageChange}
              className="sr-only"
            />
          </label>
        </div>

        <div>
          <label className="mb-1 block text-sm text-neutral-300">
            Notes
          </label>
          <textarea
            name="notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={4}
            className="w-full resize-none rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-3 text-white outline-none transition focus:border-cyan-500"
            placeholder="Optional notes"
          />
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-cyan-400/25 bg-[#061018] p-4">
          <div className="absolute inset-0">
            {imagePreview ? (
              <Image
                src={imagePreview}
                alt=""
                fill
                className="object-cover opacity-55"
                unoptimized
              />
            ) : null}
            <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-black/20" />
          </div>

          <div className="relative min-h-40">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">
              Unit Preview
            </p>
            <h3 className="mt-2 max-w-[260px] text-2xl font-black leading-tight text-white">
              {previewName}
            </h3>
            <p className="mt-2 max-w-[280px] text-sm leading-6 text-white/65">
              {previewNotes}
            </p>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-white/10 bg-black/35 px-3 py-2">
                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/35">
                  Models
                </p>
                <p className="mt-1 text-sm font-black text-white">
                  {modelCount || '1'}
                </p>
              </div>
              <div className="rounded-xl border border-cyan-300/15 bg-cyan-300/[0.07] px-3 py-2">
                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-cyan-300">
                  Deadline
                </p>
                <p className="mt-1 text-sm font-black text-cyan-200">
                  {formattedDeadline}
                </p>
              </div>
            </div>
          </div>
        </div>

        <SubmitButton
          idleText="Add Unit"
          pendingText="Adding unit..."
          className="w-full rounded-xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-black shadow-lg shadow-cyan-500/20"
        />
      </form>
    </section>
  )
}
