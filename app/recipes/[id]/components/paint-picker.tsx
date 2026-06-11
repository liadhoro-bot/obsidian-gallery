'use client'

import { useMemo, useState } from 'react'
import PaintPickerDialog, {
  PaintPickerPaint,
} from '../../../../components/paints/paint-picker-dialog'
import PaintSwatch from './paint-swatch'
import { Paint } from './types'

type PickerPaint = PaintPickerPaint & {
  hex_approx: string | null
  is_owned: boolean
}

function formatPaintLabel(paint: Pick<Paint, 'brand' | 'line' | 'name'>) {
  return [paint.brand, paint.line, paint.name].filter(Boolean).join(' / ')
}

export default function PaintPicker({
  name,
  paints,
  defaultValue,
  defaultPaint,
}: {
  name: string
  paints: Paint[]
  defaultValue?: string
  defaultPaint?: PaintPickerPaint | null
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedState, setSelectedState] = useState({
    defaultValue: defaultValue || '',
    value: defaultValue || '',
    paint: defaultPaint
      ? {
          ...defaultPaint,
          hex_approx: defaultPaint.hex_approx || defaultPaint.hex || null,
          is_owned: Boolean(defaultPaint.is_owned),
        }
      : null,
  })
  const selectedValue =
    selectedState.defaultValue === (defaultValue || '')
      ? selectedState.value
      : defaultValue || ''

  const selectedPaintSnapshot = useMemo(() => {
    if (selectedState.defaultValue === (defaultValue || '')) {
      return selectedState.paint
    }

    if (!defaultPaint) return null

    return {
      ...defaultPaint,
      hex_approx: defaultPaint.hex_approx || defaultPaint.hex || null,
      is_owned: Boolean(defaultPaint.is_owned),
    }
  }, [defaultPaint, defaultValue, selectedState.defaultValue, selectedState.paint])

  function setSelectedValue(value: string, paint: PickerPaint | null = null) {
    setSelectedState({ defaultValue: defaultValue || '', value, paint })
  }

  const selectedPaint = useMemo(
    () =>
      paints.find((paint) => `${paint.source}:${paint.id}` === selectedValue) ||
      selectedPaintSnapshot ||
      null,
    [paints, selectedPaintSnapshot, selectedValue]
  )

  function selectPaint(paint: PaintPickerPaint) {
    setSelectedValue(`${paint.source}:${paint.id}`, {
      ...paint,
      hex_approx: paint.hex_approx || paint.hex || null,
      is_owned: Boolean(paint.is_owned),
    })
    setIsOpen(false)
  }

  return (
    <div>
      <input type="hidden" name={name} value={selectedValue} readOnly />

      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex w-full items-center justify-between rounded-xl border border-neutral-700 bg-black px-3 py-2 text-left text-white transition hover:border-cyan-400/40 hover:bg-cyan-400/10"
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

        <span className="ml-3 text-neutral-400">Choose</span>
      </button>

      {selectedValue ? (
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={() => setSelectedValue('')}
            className="text-xs font-semibold text-white/40 transition hover:text-cyan-300"
          >
            Clear
          </button>
        </div>
      ) : null}

      <PaintPickerDialog
        open={isOpen}
        onOpenChange={setIsOpen}
        title="Choose Paint"
        selectedPaint={selectedPaint}
        onSelectPaint={selectPaint}
        source="recipe_step_picker"
        initialPaints={paints}
      />
    </div>
  )
}
