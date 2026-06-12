'use client'

import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'

type BarcodeScannerModalProps = {
  open: boolean
  onClose: () => void
  onDetected: (barcode: string) => void
}

export default function BarcodeScannerModal({
  open,
  onClose,
  onDetected,
}: BarcodeScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const controlsRef = useRef<{ stop: () => void } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !videoRef.current) return

    let cancelled = false

    async function startScanner() {
      try {
        setError(null)

        const reader = new BrowserMultiFormatReader()

        const controls = await reader.decodeFromConstraints(
          {
            video: {
              facingMode: { ideal: 'environment' },
            },
            audio: false,
          },
          videoRef.current!,
          (result) => {
            if (!result || cancelled) return

            const barcode = result.getText().replace(/\D/g, '')

            if (!barcode) return

            cancelled = true
            controlsRef.current?.stop()
            controlsRef.current = null

            onDetected(barcode)
            onClose()
          }
        )

        controlsRef.current = controls
      } catch (err) {
        console.error('Barcode scanner error:', err)
        setError('Could not open camera. Check camera permission and try again.')
      }
    }

    startScanner()

    return () => {
      cancelled = true
      controlsRef.current?.stop()
      controlsRef.current = null
    }
  }, [open, onClose, onDetected])

  if (!open) return null

  return (
    <div className="mobile-sheet-overlay fixed inset-0 z-50 flex justify-center bg-black/80 backdrop-blur-sm">
      <div className="mobile-sheet max-w-md rounded-3xl border border-white/10 bg-[#07111a] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div>
            <h2 className="text-sm font-bold text-white">Scan barcode</h2>
            <p className="mt-1 text-xs text-slate-400">
              Point your camera at the paint barcode.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="tap-press mobile-close-button rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-slate-300"
          >
            Close
          </button>
        </div>

        <div className="relative aspect-[4/3] bg-black">
          <video
            ref={videoRef}
            className="h-full w-full object-cover"
            muted
            playsInline
          />

          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="relative h-32 w-72 rounded-2xl border-2 border-cyan-300/70 shadow-[0_0_24px_rgba(34,211,238,0.18)]">
              <div className="absolute left-4 right-4 top-1/2 h-0.5 -translate-y-1/2 bg-red-400 shadow-[0_0_12px_rgba(248,113,113,0.9)]" />
            </div>
          </div>
        </div>

        <div className="px-4 py-3">
          {error ? (
            <p className="text-sm text-red-300">{error}</p>
          ) : (
            <p className="text-xs text-slate-400">
              Camera access is only active while this scanner is open.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
