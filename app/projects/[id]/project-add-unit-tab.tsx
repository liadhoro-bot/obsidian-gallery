'use client'

import Image from 'next/image'
import { useMemo, useState } from 'react'
import SubmitButton from '../../components/SubmitButton'
import styles from './project-detail-silver.module.css'

type Props = {
  projectId: string
  addUnitAction: (formData: FormData) => Promise<void>
  onClose?: () => void
}

export default function ProjectAddUnitTab({
  projectId,
  addUnitAction,
  onClose,
}: Props) {
  const [name, setName] = useState('')
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

  function handleImageChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]

    setImagePreview(file ? URL.createObjectURL(file) : null)
  }

  return (
    <section className={`${styles.panel} ${styles.addUnitDrawer} mobile-scroll mt-3`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={styles.eyebrow}>
            Add Unit
          </p>
          <h2 className="mt-1 text-xl">Create a New Unit</h2>
          <p className="mt-2 text-sm">
            Add a unit, squad, character, vehicle, or display piece to this project.
          </p>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className={`${styles.iconControl} tap-press tap-target shrink-0`}
            aria-label="Close add unit form"
            title="Close"
          >
            <span>×</span>
          </button>
        ) : null}
      </div>

      <form action={addUnitAction} className="mt-5 space-y-4 pb-2">
        <input type="hidden" name="projectId" value={projectId} />

        <div className={styles.formField}>
          <label className="mb-1 block">
            Unit Name
          </label>
          <input
            name="name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            className="px-3 py-3 transition"
            placeholder="e.g. Skeleton Warriors"
          />
        </div>

        <div>
          <label className={`${styles.uploadLabel} mb-1 block`}>
            First Picture
          </label>
          <label className={`${styles.secondaryAction} flex cursor-pointer items-center gap-3 p-3 transition`}>
            <span className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-[var(--og-radius-s)] bg-white/[0.06] text-2xl text-white/45">
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
            <span className="min-w-0 text-sm text-[color:var(--og-paper-200)]">
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

        <div className={styles.formField}>
          <label className="mb-1 block">
            Notes
          </label>
          <textarea
            name="notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={4}
            className="resize-none px-3 py-3 transition"
            placeholder="Optional notes"
          />
        </div>

        <div className={`${styles.unitHeroCard} relative overflow-hidden p-4`}>
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
            <div className={styles.unitImageOverlay} />
          </div>

          <div className="relative min-h-40">
            <p className={styles.eyebrow}>
              Unit Preview
            </p>
            <h3 className="mt-2 max-w-[260px] text-2xl font-black leading-tight text-white">
              {previewName}
            </h3>
            <p className="mt-2 max-w-[280px] text-sm leading-6 text-white/65">
              {previewNotes}
            </p>
          </div>
        </div>

        <div className={styles.addUnitSubmitDock}>
          <SubmitButton
            idleText="Add Unit"
            pendingText="Adding unit..."
            className={`${styles.primaryButton} w-full px-4 py-3 text-sm font-bold`}
          />
        </div>
      </form>
    </section>
  )
}
