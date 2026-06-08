'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/

type HslColor = {
  h: number
  s: number
  l: number
}

type ColorMatchModalProps = {
  selectedHex: string
  brand: string
  line: string
  ownership: string
}

function normalizeHex(value: string) {
  const trimmed = value.trim()

  if (!HEX_COLOR_PATTERN.test(trimmed)) {
    return null
  }

  return trimmed.toUpperCase()
}

function hexToHsl(hex: string): HslColor {
  const normalized = normalizeHex(hex) ?? '#22D3EE'
  const r = parseInt(normalized.slice(1, 3), 16) / 255
  const g = parseInt(normalized.slice(3, 5), 16) / 255
  const b = parseInt(normalized.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min
  let h = 0
  const l = (max + min) / 2
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1))

  if (delta !== 0) {
    if (max === r) {
      h = 60 * (((g - b) / delta) % 6)
    } else if (max === g) {
      h = 60 * ((b - r) / delta + 2)
    } else {
      h = 60 * ((r - g) / delta + 4)
    }
  }

  return {
    h: Math.round((h + 360) % 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  }
}

function hslToHex({ h, s, l }: HslColor) {
  const saturation = s / 100
  const lightness = l / 100
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation
  const x = chroma * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = lightness - chroma / 2
  let r = 0
  let g = 0
  let b = 0

  if (h < 60) {
    r = chroma
    g = x
  } else if (h < 120) {
    r = x
    g = chroma
  } else if (h < 180) {
    g = chroma
    b = x
  } else if (h < 240) {
    g = x
    b = chroma
  } else if (h < 300) {
    r = x
    b = chroma
  } else {
    r = chroma
    b = x
  }

  return `#${[r, g, b]
    .map((channel) =>
      Math.round((channel + m) * 255)
        .toString(16)
        .padStart(2, '0')
    )
    .join('')
    .toUpperCase()}`
}

export default function ColorMatchModal({
  selectedHex,
  brand,
  line,
  ownership,
}: ColorMatchModalProps) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const initialHex = normalizeHex(selectedHex) ?? '#22D3EE'
  const [isOpen, setIsOpen] = useState(false)
  const [hex, setHex] = useState(initialHex)
  const [hsl, setHsl] = useState<HslColor>(() => hexToHsl(initialHex))
  const selectedColor = normalizeHex(hex)

  useEffect(() => {
    setHex(initialHex)
    setHsl(hexToHsl(initialHex))
  }, [initialHex])

  function updateFromHex(nextHex: string) {
    const normalized = normalizeHex(nextHex)

    if (!normalized) return

    setHex(normalized)
    setHsl(hexToHsl(normalized))
  }

  function updateHsl(nextHsl: HslColor) {
    const normalizedHsl = {
      h: Math.max(0, Math.min(359, nextHsl.h)),
      s: Math.max(0, Math.min(100, nextHsl.s)),
      l: Math.max(0, Math.min(100, nextHsl.l)),
    }

    setHsl(normalizedHsl)
    setHex(hslToHex(normalizedHsl))
  }

  function closeModal() {
    setIsOpen(false)
  }

  function findClosestPaints() {
    if (!selectedColor) return

    const params = new URLSearchParams()
    params.set('tab', 'find')
    params.set('matchHex', selectedColor)

    if (brand) params.set('brand', brand)
    if (line) params.set('line', line)

    if (ownership && ownership !== 'all') {
      params.set('ownership', ownership)
    }

    startTransition(() => {
      router.replace(`/vault?${params.toString()}`)
      closeModal()
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl border border-white/10 bg-slate-950/80 px-3 text-sm font-semibold text-white outline-none transition hover:border-white/20 hover:bg-slate-900 active:scale-95"
      >
        <span
          className="relative h-4 w-4 rounded-full border border-white/25"
          style={{
            background:
              'conic-gradient(from 90deg, #ef4444, #f97316, #facc15, #22c55e, #06b6d4, #3b82f6, #8b5cf6, #ef4444)',
          }}
          aria-hidden="true"
        >
          <span
            className="absolute inset-[4px] rounded-full border border-black/40"
            style={{ backgroundColor: selectedColor ?? '#22D3EE' }}
          />
        </span>
        Match a Color
      </button>

      {isOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/75 px-4 py-5 backdrop-blur-sm sm:items-center sm:justify-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="vault-color-match-title"
        >
          <div className="w-full max-w-2xl rounded-3xl border border-cyan-300/20 bg-[#081018] p-5 shadow-[0_0_44px_rgba(34,211,238,0.18)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300">
                  Vault
                </p>
                <h2
                  id="vault-color-match-title"
                  className="mt-2 text-2xl font-black text-white"
                >
                  Match a Color
                </h2>
              </div>

              <button
                type="button"
                onClick={closeModal}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-lg font-bold text-white/70 transition hover:bg-white/[0.08] hover:text-white"
                aria-label="Close color matcher"
              >
                x
              </button>
            </div>

            <div className="mt-6 grid gap-5 md:grid-cols-[220px_1fr]">
              <div className="grid place-items-center rounded-3xl border border-white/10 bg-slate-950/70 p-5">
                <label
                  className="relative grid h-44 w-44 cursor-pointer place-items-center rounded-full border border-white/15 shadow-[0_0_30px_rgba(0,0,0,0.45)]"
                  style={{
                    background:
                      'radial-gradient(circle at center, white 0 8%, transparent 9%), conic-gradient(from 90deg, #ef4444, #f97316, #facc15, #22c55e, #06b6d4, #3b82f6, #8b5cf6, #ef4444)',
                  }}
                >
                  <span className="sr-only">Selected color</span>
                  <span
                    className="h-14 w-14 rounded-full border-4 border-slate-950 shadow-[0_0_0_1px_rgba(255,255,255,0.24)]"
                    style={{ backgroundColor: selectedColor ?? '#22D3EE' }}
                    aria-hidden="true"
                  />
                  <input
                    type="color"
                    value={selectedColor ?? '#22D3EE'}
                    onChange={(event) => updateFromHex(event.target.value)}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  />
                </label>
              </div>

              <div className="space-y-4 rounded-3xl border border-white/10 bg-slate-950/70 p-4">
                <ColorDial
                  label="Tone"
                  value={hsl.h}
                  max={359}
                  unit="deg"
                  track="linear-gradient(90deg, #ef4444, #f97316, #facc15, #22c55e, #06b6d4, #3b82f6, #8b5cf6, #ef4444)"
                  onChange={(value) => updateHsl({ ...hsl, h: value })}
                />

                <ColorDial
                  label="Saturation"
                  value={hsl.s}
                  max={100}
                  unit="%"
                  track={`linear-gradient(90deg, hsl(${hsl.h} 0% ${hsl.l}%), hsl(${hsl.h} 100% ${hsl.l}%))`}
                  onChange={(value) => updateHsl({ ...hsl, s: value })}
                />

                <ColorDial
                  label="Luminosity"
                  value={hsl.l}
                  max={100}
                  unit="%"
                  track={`linear-gradient(90deg, #000, hsl(${hsl.h} ${hsl.s}% 50%), #fff)`}
                  onChange={(value) => updateHsl({ ...hsl, l: value })}
                />
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]">
              <div className="grid grid-cols-[56px_1fr] gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                <div
                  className="h-14 rounded-xl border border-white/15"
                  style={{ backgroundColor: selectedColor ?? '#22D3EE' }}
                />
                <div className="flex min-w-0 flex-col justify-center">
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-white/40">
                    Selected HEX
                  </p>
                  <p className="mt-1 text-lg font-black text-white">
                    {selectedColor ?? 'Invalid color'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={findClosestPaints}
                disabled={!selectedColor}
                className="rounded-2xl bg-cyan-400 px-5 py-4 text-sm font-black uppercase tracking-[0.18em] text-slate-950 shadow-[0_0_24px_rgba(34,211,238,0.28)] transition active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/35 disabled:shadow-none"
              >
                Find closest paints
              </button>
            </div>

            {!selectedColor ? (
              <p className="mt-4 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-100">
                Choose a valid color before searching.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  )
}

function ColorDial({
  label,
  value,
  max,
  unit,
  track,
  onChange,
}: {
  label: string
  value: number
  max: number
  unit: string
  track: string
  onChange: (value: number) => void
}) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center justify-between gap-3 text-xs font-bold uppercase tracking-[0.18em] text-white/50">
        <span>{label}</span>
        <span className="text-white/75">
          {value}
          {unit}
        </span>
      </span>
      <input
        type="range"
        min="0"
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-3 w-full cursor-pointer rounded-full border border-white/10 bg-transparent"
        style={{ background: track }}
      />
    </label>
  )
}
