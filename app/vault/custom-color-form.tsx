'use client'

import { useMemo, useState } from 'react'

export default function CustomColorForm() {
  const [name, setName] = useState('')
  const [brand, setBrand] = useState('Custom')
  const [line, setLine] = useState('Custom Color')
  const [hex, setHex] = useState('#4A4F57')

  const safeHex = useMemo(() => {
    if (/^#[0-9A-Fa-f]{6}$/.test(hex)) return hex
    return '#4A4F57'
  }, [hex])

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-white/10 bg-slate-950/70 p-4 shadow-[0_0_24px_rgba(34,211,238,0.08)]">
        <h2 className="mb-5 text-sm font-black uppercase tracking-[0.22em] text-cyan-300">
          Create Custom Color
        </h2>

        <div className="space-y-4">
          <label className="block space-y-2">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-white/55">
              Color Name
            </span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
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
                onChange={(event) => setBrand(event.target.value)}
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
                onChange={(event) => setLine(event.target.value)}
                placeholder="Custom Color"
                className="w-full rounded-xl border border-white/10 bg-slate-900/90 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-400/60"
              />
            </label>
          </div>

          <label className="block space-y-2">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-white/55">
              Hex Code
            </span>

            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-900/90 px-4 py-3 focus-within:border-cyan-400/60">
              <input
                value={hex}
                onChange={(event) => setHex(event.target.value)}
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
              Swatch Image Optional
            </span>

            <div className="rounded-xl border border-dashed border-white/20 bg-slate-900/40 p-5 text-center">
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="text-xs text-white/55 file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-400/15 file:px-3 file:py-2 file:text-xs file:font-bold file:text-cyan-300"
              />

              <p className="mt-3 text-xs text-white/45">
                Upload or capture a swatch image. PNG, JPG, or WEBP.
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
          <div
            className="aspect-square rounded-xl border border-white/10 shadow-inner"
            style={{ backgroundColor: safeHex }}
          />

          <div className="flex min-w-0 flex-col justify-center space-y-2">
            <h3 className="truncate text-lg font-black text-white">
              {name || 'Custom Color Name'}
            </h3>

            <p className="truncate text-xs font-semibold uppercase text-cyan-300">
              {brand || 'Custom'} {line || 'Custom Color'}
            </p>

            <span className="w-fit rounded-lg bg-cyan-500/15 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-cyan-300">
              Custom
            </span>
          </div>
        </div>
      </section>

      <button
        type="button"
        className="w-full rounded-xl bg-cyan-400 px-5 py-4 text-sm font-black uppercase tracking-[0.25em] text-slate-950 shadow-[0_0_24px_rgba(34,211,238,0.35)]"
      >
        Save Color
      </button>
    </div>
  )
}