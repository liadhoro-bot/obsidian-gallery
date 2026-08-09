'use client'

import Image from 'next/image'
import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import PaintPickerDialog, {
  PaintPickerPaint,
} from '../../components/paints/paint-picker-dialog'

import {
  createCustomPaintAction,
  updateCustomPaintAction,
} from './custom-paint-actions'

type CustomPaint = {
  id: string
  name: string | null
  manufacturer: string | null
  series: string | null
  description: string | null
  color_hex: string | null
  image_url?: string | null
  mix_paints?: CustomPaintMixPaint[]
}

type CustomPaintMixPaint = {
  id: string
  paint_order: number
  ratio_text: string | null
  paint_source: 'catalog' | 'custom' | null
  paint: PaintPickerPaint | null
}

type MixPaintState = {
  value: string
  ratio: string
  paint: PaintPickerPaint | null
}

type Props = {
  mode: 'create' | 'edit'
  paint?: CustomPaint
}

export default function CustomPaintForm({
  mode,
  paint,
}: Props) {
  const [name, setName] = useState(paint?.name || '')
  const [brand, setBrand] = useState(
    paint?.manufacturer || 'Custom'
  )
  const [line, setLine] = useState(
    paint?.series || 'Custom Paint'
  )
  const [description, setDescription] = useState(paint?.description || '')
  const [hex, setHex] = useState(
    paint?.color_hex || '#4A4F57'
  )
  const [mixPaints, setMixPaints] = useState<MixPaintState[]>(() => {
    const existingPaints = paint?.mix_paints || []

    return Array.from({ length: 3 }).map((_, index) => {
      const mixPaint = existingPaints.find(
        (item) => item.paint_order === index + 1
      )
      const value =
        mixPaint?.paint_source && mixPaint.paint?.id
          ? `${mixPaint.paint_source}:${mixPaint.paint.id}`
          : ''

      return {
        value,
        ratio: mixPaint?.ratio_text || '',
        paint: mixPaint?.paint || null,
      }
    })
  })
  const [visibleMixPaints, setVisibleMixPaints] = useState(() =>
    Math.min(Math.max(paint?.mix_paints?.length || 0, 0), 3)
  )
  const [openPaintPickerIndex, setOpenPaintPickerIndex] = useState<number | null>(
    null
  )

  const [toast, setToast] = useState('')

  const [previewImage, setPreviewImage] = useState<
    string | null
  >(paint?.image_url || null)

  const [selectedFile, setSelectedFile] =
    useState<File | null>(null)

  const [isPending, startTransition] = useTransition()

  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const safeHex = useMemo(() => {
    if (/^#[0-9A-Fa-f]{6}$/.test(hex)) return hex
    return '#4A4F57'
  }, [hex])

  useEffect(() => {
    if (!toast) return

    const timeout = setTimeout(() => {
      setToast('')
    }, 2400)

    return () => clearTimeout(timeout)
  }, [toast])

  function handleFileChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0]

    if (!file) return

    setSelectedFile(file)

    const objectUrl = URL.createObjectURL(file)
    setPreviewImage(objectUrl)
  }

  function handleSave() {
    const formData = new FormData()

    if (paint?.id) {
      formData.set('paintId', paint.id)
    }

    formData.set('name', name)
    formData.set('brand', brand)
    formData.set('line', line)
    formData.set('description', description)
    formData.set('hex', hex)

    mixPaints.forEach((mixPaint, index) => {
      const paintNumber = index + 1
      formData.set(`mixPaintId${paintNumber}`, mixPaint.value)
      formData.set(`mixRatio${paintNumber}`, mixPaint.ratio)
    })

    if (selectedFile) {
      formData.set('swatch', selectedFile)
    }

    startTransition(async () => {
      try {
        if (mode === 'edit') {
          await updateCustomPaintAction(formData)
          setToast('Custom paint updated.')
        } else {
          await createCustomPaintAction(formData)

          setName('')
          setBrand('Custom')
          setLine('Custom Paint')
          setDescription('')
          setHex('#4A4F57')
          setMixPaints(
            Array.from({ length: 3 }).map(() => ({
              value: '',
              ratio: '',
              paint: null,
            }))
          )
          setVisibleMixPaints(0)

          setSelectedFile(null)
          setPreviewImage(null)

          if (fileInputRef.current) {
            fileInputRef.current.value = ''
          }

          setToast('Custom paint created.')
        }
      } catch (error) {
        setToast(
          error instanceof Error
            ? error.message
            : 'Something went wrong.'
        )
      }
    })
  }

  function addMixPaint() {
    setVisibleMixPaints((current) => Math.min(current + 1, 3))
  }

  function updateMixPaint(index: number, update: Partial<MixPaintState>) {
    setMixPaints((current) =>
      current.map((mixPaint, currentIndex) =>
        currentIndex === index ? { ...mixPaint, ...update } : mixPaint
      )
    )
  }

  function selectMixPaint(index: number, selectedPaint: PaintPickerPaint) {
    updateMixPaint(index, {
      value: `${selectedPaint.source}:${selectedPaint.id}`,
      paint: selectedPaint,
    })
    setOpenPaintPickerIndex(null)
  }

  function clearMixPaint(index: number) {
    updateMixPaint(index, {
      value: '',
      ratio: '',
      paint: null,
    })
  }

  return (
    <>
      <div className="space-y-5">
        <section className="rounded-3xl border border-white/10 bg-slate-950/70 p-4 shadow-[0_0_24px_rgba(34,211,238,0.08)]">
          <h2 className="mb-5 text-sm font-black uppercase tracking-[0.22em] text-cyan-300">
            {mode === 'edit'
              ? 'Edit Custom Paint'
              : 'Create Custom Paint'}
          </h2>

          <div className="space-y-4">
            <label className="block space-y-2">
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-white/55">
                Paint Name
              </span>

              <input
                value={name}
                onChange={(event) =>
                  setName(event.target.value)
                }
                placeholder="e.g. Void Stalker Grey"
                className="w-full rounded-xl border border-white/10 bg-slate-900/90 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-400/60"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-2">
                <span className="text-xs font-bold uppercase tracking-[0.18em] text-white/55">
                  Brand
                </span>

                <input
                  value={brand}
                  onChange={(event) =>
                    setBrand(event.target.value)
                  }
                  placeholder="Custom"
                  className="w-full rounded-xl border border-white/10 bg-slate-900/90 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-400/60"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-xs font-bold uppercase tracking-[0.18em] text-white/55">
                  Line
                </span>

                <input
                  value={line}
                  onChange={(event) =>
                    setLine(event.target.value)
                  }
                  placeholder="Custom Paint"
                  className="w-full rounded-xl border border-white/10 bg-slate-900/90 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-400/60"
                />
              </label>
            </div>

            <label className="block space-y-2">
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-white/55">
                Description
              </span>

              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Describe the mix, recipe, or making process."
                rows={4}
                className="w-full resize-none rounded-xl border border-white/10 bg-slate-900/90 px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-white/30 focus:border-cyan-400/60"
              />
            </label>

            <section className="rounded-2xl border border-white/10 bg-slate-900/45 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-white/55">
                    Mix Paints
                  </p>
                </div>

                {visibleMixPaints === 0 ? (
                  <button
                    type="button"
                    onClick={addMixPaint}
                    className="shrink-0 rounded-xl border border-cyan-400/40 bg-cyan-400/10 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-cyan-200 transition hover:bg-cyan-400/20 active:scale-[0.98] active:opacity-70"
                  >
                    + Add Paint
                  </button>
                ) : null}
              </div>

              {visibleMixPaints > 0 ? (
                <div className="mt-3 space-y-3">
                  {Array.from({ length: visibleMixPaints }).map((_, index) => {
                    const mixPaint = mixPaints[index]
                    const paintNumber = index + 1
                    const canAddAnotherPaint = visibleMixPaints < 3
                    const isLastVisiblePaint = paintNumber === visibleMixPaints

                    return (
                      <div
                        key={paintNumber}
                        className="rounded-xl border border-white/10 bg-black/35 p-3"
                      >
                        <p className="text-sm font-bold text-white">
                          Paint {paintNumber}
                        </p>

                        <div className="mt-3 space-y-3">
                          <button
                            type="button"
                            onClick={() => setOpenPaintPickerIndex(index)}
                            className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-left text-sm text-white transition hover:border-cyan-400/40 hover:bg-cyan-400/10"
                          >
                            <span className="min-w-0 truncate">
                              {mixPaint.paint
                                ? [
                                    mixPaint.paint.brand,
                                    mixPaint.paint.line,
                                    mixPaint.paint.name,
                                  ]
                                    .filter(Boolean)
                                    .join(' / ')
                                : 'No paint selected'}
                            </span>
                            <span className="shrink-0 text-xs font-bold text-cyan-300">
                              Choose
                            </span>
                          </button>

                          <input
                            value={mixPaint.ratio}
                            onChange={(event) =>
                              updateMixPaint(index, { ratio: event.target.value })
                            }
                            type="text"
                            placeholder="Optional ratio"
                            className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-400/60"
                          />

                          {mixPaint.value ? (
                            <button
                              type="button"
                              onClick={() => clearMixPaint(index)}
                              className="text-xs font-semibold text-white/40 transition hover:text-cyan-300"
                            >
                              Clear paint
                            </button>
                          ) : null}
                        </div>

                        {isLastVisiblePaint && canAddAnotherPaint ? (
                          <button
                            type="button"
                            onClick={addMixPaint}
                            className="mt-3 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-xs font-black uppercase tracking-[0.14em] text-white/70 transition hover:border-cyan-400/40 hover:bg-cyan-400/10 hover:text-cyan-200 active:scale-[0.98] active:opacity-70"
                          >
                            + Add Another Paint
                          </button>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              ) : null}
            </section>

            <label className="block space-y-2">
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-white/55">
                Hex Code
              </span>

              <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-900/90 px-4 py-3">
                <input
                  value={hex}
                  onChange={(event) =>
                    setHex(event.target.value)
                  }
                  placeholder="#4A4F57"
                  className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/30"
                />

                <div
                  className="h-8 w-8 rounded-lg border border-white/10"
                  style={{ backgroundColor: safeHex }}
                />
              </div>
            </label>

            <label className="block space-y-2">
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-white/55">
                Swatch Image
              </span>

              <div className="rounded-2xl border border-dashed border-white/15 bg-slate-900/40 p-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleFileChange}
                  className="text-xs text-white/70 file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-400/15 file:px-3 file:py-2 file:text-xs file:font-bold file:text-cyan-300"
                />

                <p className="mt-3 text-xs text-white/40">
                  Upload a custom swatch image.
                </p>
              </div>
            </label>
          </div>
        </section>

        <section className="rounded-3xl border border-cyan-400/30 bg-slate-950/80 p-4 shadow-[0_0_28px_rgba(34,211,238,0.16)]">
          <p className="mb-3 text-xs font-black uppercase tracking-[0.22em] text-white/55">
            Live Preview
          </p>

          <div className="grid grid-cols-[112px_1fr] gap-4 rounded-2xl border border-white/10 bg-slate-900/80 p-3">
            <div className="relative aspect-square overflow-hidden rounded-xl border border-white/10">
              {previewImage ? (
                <Image
                  src={previewImage}
                  alt="Paint preview"
                  fill
                  className="object-cover"
                />
              ) : (
                <div
                  className="h-full w-full"
                  style={{ backgroundColor: safeHex }}
                />
              )}
            </div>

            <div className="flex min-w-0 flex-col justify-center space-y-2">
              <h3 className="truncate text-lg font-black text-white">
                {name || 'Custom Paint Name'}
              </h3>

              <p className="truncate text-xs font-semibold uppercase text-cyan-300">
                {brand || 'Custom'}{' '}
                {line || 'Custom Paint'}
              </p>

              {description.trim() ? (
                <p className="line-clamp-2 text-xs leading-5 text-white/50">
                  {description.trim()}
                </p>
              ) : null}

              <span className="w-fit rounded-lg bg-cyan-500/15 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-cyan-300">
                Custom
              </span>
            </div>
          </div>
        </section>

        <button
          type="button"
          disabled={isPending || !name.trim()}
          onClick={handleSave}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 px-5 py-4 text-sm font-black uppercase tracking-[0.25em] text-slate-950 shadow-[0_0_24px_rgba(34,211,238,0.35)] transition active:scale-[0.98] active:opacity-70 disabled:opacity-50"
        >
          {isPending ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />
          ) : null}

          <span>
            {mode === 'edit'
              ? isPending
                ? 'Saving Changes...'
                : 'Save Changes'
              : isPending
              ? 'Saving Paint...'
              : 'Save Paint'}
          </span>
        </button>
      </div>

      <PaintPickerDialog
        open={openPaintPickerIndex !== null}
        onOpenChange={(open) => {
          if (!open) setOpenPaintPickerIndex(null)
        }}
        title="Choose Mix Paint"
        selectedPaint={
          openPaintPickerIndex === null
            ? null
            : mixPaints[openPaintPickerIndex]?.paint
        }
        onSelectPaint={(selectedPaint) => {
          if (openPaintPickerIndex === null) return
          selectMixPaint(openPaintPickerIndex, selectedPaint)
        }}
        source="custom_paint_mix_picker"
      />

      {toast ? (
        <div className="fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] left-1/2 z-50 -translate-x-1/2 rounded-2xl border border-cyan-400/20 bg-slate-950/95 px-5 py-3 text-sm font-semibold text-cyan-300 shadow-[0_0_24px_rgba(34,211,238,0.18)] backdrop-blur">
          {toast}
        </div>
      ) : null}

    </>
  )
}
