'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import type { PointerEvent } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { buildVaultColorMatchHref } from '../../components/color-sampler/color-match-navigation'
import type { SampledImageColor } from '../../components/color-sampler/types'

const ColorSamplerDialog = dynamic(
  () => import('../../components/color-sampler/ColorSamplerDialog'),
  { ssr: false }
)

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

function getWheelPointerPosition({ h, s }: HslColor) {
  const angle = ((h - 90) * Math.PI) / 180
  const radius = s / 100

  return {
    left: `${50 + Math.cos(angle) * radius * 50}%`,
    top: `${50 + Math.sin(angle) * radius * 50}%`,
  }
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
  const [samplerOpen, setSamplerOpen] = useState(false)
  const [hex, setHex] = useState(initialHex)
  const [hsl, setHsl] = useState<HslColor>(() => hexToHsl(initialHex))
  const wheelRef = useRef<HTMLDivElement>(null)
  const selectedColor = normalizeHex(hex)

  useEffect(() => {
    setHex(initialHex)
    setHsl(hexToHsl(initialHex))
  }, [initialHex])

  function updateFromHex(nextHex: string) {
    const normalized =
      normalizeHex(nextHex) ??
      normalizeHex(nextHex.startsWith('#') ? nextHex : `#${nextHex}`)

    setHex(nextHex.toUpperCase())

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

  function updateFromWheel(event: PointerEvent<HTMLDivElement>) {
    const wheel = wheelRef.current

    if (!wheel) return

    const rect = wheel.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    const dx = event.clientX - centerX
    const dy = event.clientY - centerY
    const radius = rect.width / 2
    const distance = Math.min(Math.sqrt(dx * dx + dy * dy), radius)
    const hue = Math.round((Math.atan2(dy, dx) * 180) / Math.PI + 450) % 360
    const saturation = Math.round((distance / radius) * 100)

    updateHsl({
      ...hsl,
      h: hue,
      s: saturation,
    })
  }

  function closeModal() {
    setIsOpen(false)
  }

  function findClosestPaints(nextHex = selectedColor) {
    if (!nextHex) return

    startTransition(() => {
      router.replace(
        buildVaultColorMatchHref(nextHex, {
          brand,
          line,
          ownership,
        })
      )
      closeModal()
    })
  }

  function handleSampleConfirmed(sample: SampledImageColor) {
    updateFromHex(sample.hex)
    setSamplerOpen(false)
    findClosestPaints(sample.hex)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="tap-press tap-target inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl border border-white/10 bg-slate-950/80 px-3 text-sm font-semibold text-white outline-none hover:border-white/20 hover:bg-slate-900"
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
          className="mobile-sheet-overlay fixed inset-0 z-50 flex justify-center bg-black/75 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="vault-color-match-title"
        >
          <div className="mobile-sheet max-w-2xl rounded-3xl border border-cyan-300/20 bg-[#081018] p-5 shadow-[0_0_44px_rgba(34,211,238,0.18)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300">
                  Paints
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
                className="tap-press mobile-close-button flex items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-lg font-bold text-white/70 hover:bg-white/[0.08] hover:text-white"
                aria-label="Close color matcher"
              >
                x
              </button>
            </div>

            <div className="mobile-scroll mt-6 grid min-h-0 gap-5 overflow-y-auto pr-1 md:grid-cols-[220px_1fr]">
              <div className="grid place-items-center rounded-3xl border border-white/10 bg-slate-950/70 p-5">
                <div
                  ref={wheelRef}
                  role="slider"
                  tabIndex={0}
                  aria-label="Color wheel"
                  aria-valuemin={0}
                  aria-valuemax={359}
                  aria-valuenow={hsl.h}
                  aria-valuetext={`${hsl.h} degrees, ${hsl.s}% saturation`}
                  onPointerDown={(event) => {
                    event.currentTarget.setPointerCapture(event.pointerId)
                    updateFromWheel(event)
                  }}
                  onPointerMove={(event) => {
                    if (event.buttons !== 1) return
                    updateFromWheel(event)
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'ArrowLeft') {
                      event.preventDefault()
                      updateHsl({ ...hsl, h: hsl.h - 1 })
                    }
                    if (event.key === 'ArrowRight') {
                      event.preventDefault()
                      updateHsl({ ...hsl, h: hsl.h + 1 })
                    }
                    if (event.key === 'ArrowDown') {
                      event.preventDefault()
                      updateHsl({ ...hsl, s: hsl.s - 1 })
                    }
                    if (event.key === 'ArrowUp') {
                      event.preventDefault()
                      updateHsl({ ...hsl, s: hsl.s + 1 })
                    }
                  }}
                  className="relative h-44 w-44 touch-none cursor-crosshair rounded-full border border-white/15 shadow-[0_0_30px_rgba(0,0,0,0.45)] outline-none ring-cyan-300/40 transition focus-visible:ring-2"
                  style={{
                    background:
                      'radial-gradient(circle, white 0 2%, transparent 62%), conic-gradient(from 90deg, #ef4444, #f97316, #facc15, #22c55e, #06b6d4, #3b82f6, #8b5cf6, #ef4444)',
                  }}
                >
                  <span
                    className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.55),0_0_16px_rgba(0,0,0,0.35)]"
                    style={{
                      ...getWheelPointerPosition(hsl),
                      backgroundColor: selectedColor ?? '#22D3EE',
                    }}
                    aria-hidden="true"
                  />
                </div>
              </div>

              <div className="space-y-4 rounded-3xl border border-white/10 bg-slate-950/70 p-4">
                <button
                  type="button"
                  onClick={() => setSamplerOpen(true)}
                  className="tap-press tap-target flex w-full items-center justify-center gap-2 rounded-2xl border border-cyan-300/30 bg-cyan-300/10 px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-cyan-100 transition hover:border-cyan-200/60 hover:bg-cyan-300/15"
                >
                  <span aria-hidden="true">◎</span>
                  Sample from Image
                </button>

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
                  <input
                    value={hex}
                    onChange={(event) => updateFromHex(event.target.value)}
                    onBlur={() => {
                      if (selectedColor) setHex(selectedColor)
                    }}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 text-lg font-black uppercase text-white outline-none transition focus:border-cyan-300/60 focus:shadow-[0_0_18px_rgba(34,211,238,0.16)]"
                    placeholder="#22D3EE"
                    spellCheck={false}
                    aria-label="Selected HEX"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => findClosestPaints()}
                disabled={!selectedColor}
                className="tap-press tap-target rounded-2xl border border-cyan-300/30 bg-cyan-300/10 px-5 py-4 text-sm font-black uppercase tracking-[0.18em] text-cyan-100 shadow-[0_0_24px_rgba(34,211,238,0.18)] transition hover:border-cyan-200/60 hover:bg-cyan-300/15 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-white/35 disabled:shadow-none"
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

      {samplerOpen ? (
        <ColorSamplerDialog
          open={samplerOpen}
          onOpenChange={setSamplerOpen}
          source="vault_upload"
          allowCameraCapture={true}
          allowImageUpload={true}
          onConfirm={handleSampleConfirmed}
        />
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
