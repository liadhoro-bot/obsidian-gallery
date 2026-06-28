'use client'

import { useRef } from 'react'

export default function ImageSourcePicker({
  allowImageUpload,
  allowCameraCapture,
  disabled,
  onFileSelected,
}: {
  allowImageUpload: boolean
  allowCameraCapture: boolean
  disabled?: boolean
  onFileSelected: (file: File, method: 'upload' | 'camera') => void
}) {
  const uploadInputRef = useRef<HTMLInputElement | null>(null)
  const cameraInputRef = useRef<HTMLInputElement | null>(null)

  function handleFile(
    event: React.ChangeEvent<HTMLInputElement>,
    method: 'upload' | 'camera'
  ) {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (file) {
      onFileSelected(file, method)
    }
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300">
        Image source
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {allowImageUpload ? (
          <>
            <input
              ref={uploadInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => handleFile(event, 'upload')}
            />
            <button
              type="button"
              onClick={() => uploadInputRef.current?.click()}
              disabled={disabled}
              className="tap-press mobile-upload-action rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 text-sm font-bold text-white transition hover:border-cyan-300/40 hover:text-cyan-100 disabled:opacity-50"
            >
              Choose Image
            </button>
          </>
        ) : null}

        {allowCameraCapture ? (
          <>
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(event) => handleFile(event, 'camera')}
            />
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              disabled={disabled}
              className="tap-press mobile-upload-action rounded-xl bg-cyan-400 px-3 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-300 disabled:opacity-50"
            >
              Take Photo
            </button>
          </>
        ) : null}
      </div>
    </div>
  )
}
