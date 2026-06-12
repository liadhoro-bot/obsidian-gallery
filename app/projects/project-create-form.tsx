'use client'

import Image from 'next/image'
import { useMemo, useState } from 'react'
import SubmitButton from '../components/SubmitButton'

type ProjectCreateFormProps = {
  addProjectAction: (formData: FormData) => Promise<void>
}

export default function ProjectCreateForm({
  addProjectAction,
}: ProjectCreateFormProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  const previewName = useMemo(
    () => name.trim() || 'Tomb Kings Army',
    [name]
  )
  const previewDescription = useMemo(
    () =>
      description.trim() ||
      'A fresh project for reference photos, units, progress, and finished showcase shots.',
    [description]
  )

  function handleImageChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]

    setImagePreview(file ? URL.createObjectURL(file) : null)
  }

  return (
    <section className="rounded-2xl border border-neutral-800 bg-gradient-to-br from-neutral-900 to-neutral-950 p-5 shadow-sm">
      <div>
        <p className="text-sm uppercase tracking-wider text-cyan-400">
          New Project
        </p>
        <h2 className="mt-1 text-xl font-semibold">Create Project</h2>
        <p className="mt-2 text-sm text-neutral-400">
          Start a new army, warband, display project, or painting collection.
        </p>
      </div>

      <form action={addProjectAction} className="mt-5 grid gap-4">
        <div>
          <label className="text-sm font-medium text-neutral-300">
            Project name
          </label>
          <input
            name="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            placeholder="Example: Tomb Kings Army"
            className="mt-2 w-full rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-neutral-600 focus:border-cyan-500"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-neutral-300">
            Description
          </label>
          <textarea
            name="description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={4}
            placeholder="What are you building or painting?"
            className="mt-2 w-full resize-none rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-neutral-600 focus:border-cyan-500"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-neutral-300">
            First picture
          </label>
          <label className="mt-2 flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-neutral-700 bg-neutral-950 p-3 transition hover:border-cyan-500/60">
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
              Add a thumbnail now so the project has a featured image from the
              start.
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

        <div className="space-y-3">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
            Live Preview
          </p>

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
              ) : (
                <div className="h-full w-full bg-[radial-gradient(circle_at_25%_20%,rgba(34,211,238,0.22),transparent_34%),radial-gradient(circle_at_78%_75%,rgba(249,115,22,0.16),transparent_32%),linear-gradient(135deg,#111827,#020617)]" />
              )}

              <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-black/20" />
            </div>

            <div className="relative min-h-40">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">
                Project Preview
              </p>
              <h3 className="mt-2 max-w-[260px] text-2xl font-black leading-tight text-white">
                {previewName}
              </h3>

              <p className="mt-2 max-w-[280px] text-sm leading-6 text-white/65">
                {previewDescription}
              </p>

              <div className="mt-5 grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-white/10 bg-black/35 px-3 py-2">
                  <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/35">
                    Units
                  </p>
                  <p className="mt-1 text-sm font-black text-white">0</p>
                </div>
                <div className="rounded-xl border border-cyan-300/15 bg-cyan-300/[0.07] px-3 py-2">
                  <p className="text-[9px] font-black uppercase tracking-[0.18em] text-cyan-300">
                    Status
                  </p>
                  <p className="mt-1 text-sm font-black text-cyan-200">
                    Not started
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <SubmitButton
          idleText="Create project"
          pendingText="Creating project..."
          className="w-full rounded-xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-neutral-950 shadow-lg shadow-cyan-500/20"
        />
      </form>
    </section>
  )
}
