'use client'

import { useEffect, useMemo, useState } from 'react'
import PaintSwatch from './paint-swatch'
import { Paint } from './types'

function formatPaintLabel(paint: Paint) {
  return [paint.brand, paint.line, paint.name].filter(Boolean).join(' • ')
}

export default function PaintPicker({
  name,
  paints,
  defaultValue,
}: {
  name: string
  paints: Paint[]
  defaultValue?: string
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedValue, setSelectedValue] = useState(defaultValue || '')

  useEffect(() => {
    setSelectedValue(defaultValue || '')
  }, [defaultValue])

  const selectedPaint = useMemo(
    () =>
      paints.find((paint) => `${paint.source}:${paint.id}` === selectedValue) ||
      null,
    [paints, selectedValue]
  )

  return (
    <div className="relative">
      <input type="hidden" name={name} value={selectedValue} readOnly />

      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center justify-between rounded-xl border border-neutral-700 bg-black px-3 py-2 text-left text-white"
      >
        <div className="flex min-w-0 items-center gap-3">
          {selectedPaint ? (
            <>
              <PaintSwatch paint={selectedPaint} size="sm" />
              <span className="truncate">{formatPaintLabel(selectedPaint)}</span>
            </>
          ) : (
            <span className="text-neutral-400">No paint selected</span>
          )}
        </div>

        <span className="ml-3 text-neutral-400">▾</span>
      </button>

      {isOpen ? (
        <div className="absolute z-20 mt-2 max-h-96 w-full overflow-auto rounded-xl border border-neutral-700 bg-neutral-950 shadow-2xl">
          <button
            type="button"
            onClick={() => {
              setSelectedValue('')
              setIsOpen(false)
            }}
            className="flex w-full items-center gap-3 border-b border-neutral-800 px-3 py-2 text-left text-neutral-300 hover:bg-neutral-900"
          >
            <div className="h-5 w-5 rounded-md border border-neutral-700 bg-neutral-800" />
            <span>No paint selected</span>
          </button>

          {paints.map((paint) => {
            const value = `${paint.source}:${paint.id}`

            return (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setSelectedValue(value)
                  setIsOpen(false)
                }}
                className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-neutral-900"
              >
                <PaintSwatch paint={paint} size="sm" />

                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-white">
                    {formatPaintLabel(paint)}
                  </div>
                  <div className="truncate text-xs text-neutral-500">
                    {paint.source === 'custom'
                      ? 'Custom paint'
                      : paint.sku || 'Catalog paint'}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}