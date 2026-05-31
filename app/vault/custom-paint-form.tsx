'use client'

import Image from 'next/image'
import { useEffect, useMemo, useRef, useState, useTransition } from 'react'

import {
  createCustomPaintAction,
  updateCustomPaintAction,
} from './custom-paint-actions'

type CustomPaint = {
  id: string
  name: string | null
  manufacturer: string | null
  series: string | null
  color_hex: string | null
  image_url?: string | null
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
    paint?.series || 'Custom Color'
  )
  const [hex, setHex] = useState(
    paint?.color_hex || '#4A4F57'
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
    formData.set('hex', hex)

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
          setLine('Custom Color')
          setHex('#4A4F57')

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

  return (
    <>
      <div className="space-y-5">
        <section className="rounded-3xl border border-white/10 bg-slate-950/70 p-4 shadow-[0_0_24px_rgba(34,211,238,0.08)]">
          <h2 className="mb-5 text-sm font-black uppercase tracking-[0.22em] text-cyan-300">
            {mode === 'edit'
              ? 'Edit Custom Color'
              : 'Create Custom Color'}
          </h2>

          <div className="space-y-4">
            <label className="block space-y-2">
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-white/55">
                Color Name
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
                  placeholder="Custom Color"
                  className="w-full rounded-xl border border-white/10 bg-slate-900/90 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-400/60"
                />
              </label>
            </div>

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
                {name || 'Custom Color Name'}
              </h3>

              <p className="truncate text-xs font-semibold uppercase text-cyan-300">
                {brand || 'Custom'}{' '}
                {line || 'Custom Color'}
              </p>

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
              ? 'Saving Color...'
              : 'Save Color'}
          </span>
        </button>
      </div>

      {toast ? (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-2xl border border-cyan-400/20 bg-slate-950/95 px-5 py-3 text-sm font-semibold text-cyan-300 shadow-[0_0_24px_rgba(34,211,238,0.18)] backdrop-blur">
          {toast}
        </div>
      ) : null}

    </>
  )
}
