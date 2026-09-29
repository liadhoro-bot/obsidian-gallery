'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import PaintPickerDialog, {
  type PaintPickerPaint,
} from '../../../components/paints/paint-picker-dialog'
import SubmitButton from '../../components/SubmitButton'
import type { PaletteEdit, PaletteEditResult } from '../../../lib/palette/palette-edit'
import { calculateProjectPaletteAction, editProjectPalette } from './actions'
import { calculateUnitPaletteAction, editUnitPalette } from '../../units/[id]/actions'
import styles from './palette-card.module.css'

export type PaletteCardPaint = PaintPickerPaint & {
  // theme_paints row id - identifies this entry for replace/remove/reorder.
  themePaintId: string
}

type PickerTarget = { type: 'add' } | { type: 'replace'; themePaintId: string }

// view: tap a swatch to change it. edit: x buttons remove paints.
// move: press and drag swatches to reorder (pointer events, so it works on
// touch screens too).
type PaletteMode = 'view' | 'edit' | 'move'

type DragState = {
  themePaintId: string
  pointerId: number
  startPaints: PaletteCardPaint[]
}

type Props = {
  projectId?: string
  unitId?: string
  paints: PaletteCardPaint[]
  className?: string
}

// A unit or project palette: any number of paints, added with the shared
// paint picker.
export default function PaletteCard({
  projectId,
  unitId,
  paints,
  className,
}: Props) {
  const [localPaints, setLocalPaints] = useState(paints)
  const paintsRef = useRef(paints)
  const [pickerTarget, setPickerTarget] = useState<PickerTarget | null>(null)
  const [mode, setMode] = useState<PaletteMode>('view')
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const [pendingCount, setPendingCount] = useState(0)
  const [error, setError] = useState('')
  const subject = unitId ? 'unit' : 'project'
  const isBusy = pendingCount > 0

  // Re-adopt server data only when its content changes (callers map a
  // fresh array each render; identity alone would wipe optimistic edits).
  const paintsKey = paints
    .map((paint) => `${paint.themePaintId}:${paint.source}:${paint.id}`)
    .join('|')

  useEffect(() => {
    if (dragRef.current) return
    paintsRef.current = paints
    setLocalPaints(paints)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paintsKey])

  // Nothing left to edit or move - drop back to the normal view.
  useEffect(() => {
    if (localPaints.length === 0 || (mode === 'move' && localPaints.length < 2)) {
      setMode('view')
    }
  }, [localPaints.length, mode])

  function commit(updater: (current: PaletteCardPaint[]) => PaletteCardPaint[]) {
    paintsRef.current = updater(paintsRef.current)
    setLocalPaints(paintsRef.current)
  }

  async function runEdit(edit: PaletteEdit) {
    if (unitId) return editUnitPalette(unitId, edit)
    if (projectId) return editProjectPalette(projectId, edit)
    throw new Error('Missing palette owner')
  }

  async function applyEdit(
    edit: PaletteEdit,
    optimistic: (current: PaletteCardPaint[]) => PaletteCardPaint[],
    settle?: (result: PaletteEditResult) => void,
    previous: PaletteCardPaint[] = paintsRef.current
  ) {
    setError('')
    commit(optimistic)
    setPendingCount((count) => count + 1)

    try {
      settle?.(await runEdit(edit))
    } catch (editError) {
      commit(() => previous)
      setError(editError instanceof Error ? editError.message : 'Could not update palette.')
    } finally {
      setPendingCount((count) => Math.max(0, count - 1))
    }
  }

  function choosePaint(paint: PaintPickerPaint) {
    const target = pickerTarget
    setPickerTarget(null)
    if (!target) return

    const tempId = `pending:${crypto.randomUUID()}`
    const nextPaint: PaletteCardPaint = { ...paint, themePaintId: tempId }
    const settle = ({ themePaintId }: PaletteEditResult) => {
      if (!themePaintId) return
      commit((current) =>
        current.map((item) =>
          item.themePaintId === tempId ? { ...item, themePaintId } : item
        )
      )
    }

    if (target.type === 'add') {
      void applyEdit(
        { type: 'add', paintSource: paint.source, paintId: paint.id },
        (current) => [...current, nextPaint],
        settle
      )
      return
    }

    void applyEdit(
      {
        type: 'replace',
        themePaintId: target.themePaintId,
        paintSource: paint.source,
        paintId: paint.id,
      },
      (current) =>
        current.map((item) =>
          item.themePaintId === target.themePaintId ? nextPaint : item
        ),
      settle
    )
  }

  function removePaint(themePaintId: string) {
    void applyEdit({ type: 'remove', themePaintId }, (current) =>
      current.filter((item) => item.themePaintId !== themePaintId)
    )
  }

  function startDrag(event: PointerEvent<HTMLDivElement>, themePaintId: string) {
    if (mode !== 'move' || isBusy || dragRef.current) return
    event.preventDefault()
    try {
      // Keep receiving moves after the finger leaves this swatch.
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Pointer already released - the drag just ends on pointerup/cancel.
    }
    dragRef.current = {
      themePaintId,
      pointerId: event.pointerId,
      startPaints: paintsRef.current,
    }
    setDraggingId(themePaintId)
  }

  function moveDrag(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return

    const target = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>('[data-palette-cell]')
    const targetId = target?.dataset.paletteCell
    if (!targetId || targetId === drag.themePaintId) return

    commit((current) => {
      const fromIndex = current.findIndex((paint) => paint.themePaintId === drag.themePaintId)
      const toIndex = current.findIndex((paint) => paint.themePaintId === targetId)
      if (fromIndex < 0 || toIndex < 0) return current
      const next = [...current]
      const [moved] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, moved)
      return next
    })
  }

  function endDrag(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    dragRef.current = null
    setDraggingId(null)

    const order = paintsRef.current.map((paint) => paint.themePaintId)
    const unchanged = order.every(
      (id, index) => id === drag.startPaints[index]?.themePaintId
    )
    if (unchanged) return

    void applyEdit(
      { type: 'reorder', themePaintIds: order },
      (current) => current,
      ({ orderedThemePaintIds }) => {
        // Ids change if the server had to rewrite the rows.
        if (!orderedThemePaintIds || orderedThemePaintIds.length !== order.length) return
        commit((current) =>
          current.map((paint, index) =>
            paint.themePaintId === order[index]
              ? { ...paint, themePaintId: orderedThemePaintIds[index] }
              : paint
          )
        )
      },
      drag.startPaints
    )
  }

  function toggleMode(nextMode: Exclude<PaletteMode, 'view'>) {
    setMode((current) => (current === nextMode ? 'view' : nextMode))
  }

  const replacingPaint =
    pickerTarget?.type === 'replace'
      ? localPaints.find((paint) => paint.themePaintId === pickerTarget.themePaintId) ??
        null
      : null

  return (
    <section className={[styles.palette, className].filter(Boolean).join(' ')}>
      <header className={styles.header}>
        <h2 className={styles.title}>
          Palette
          {localPaints.length ? (
            <span className={styles.count}>{localPaints.length}</span>
          ) : null}
        </h2>
        <div className={styles.headerActions}>
          {localPaints.length > 1 ? (
            <button
              type="button"
              className={styles.modeButton}
              aria-pressed={mode === 'move'}
              disabled={isBusy && mode !== 'move'}
              onClick={() => toggleMode('move')}
            >
              {mode === 'move' ? 'Done' : 'Move'}
            </button>
          ) : null}
          {localPaints.length ? (
            <button
              type="button"
              className={styles.modeButton}
              aria-pressed={mode === 'edit'}
              onClick={() => toggleMode('edit')}
            >
              {mode === 'edit' ? 'Done' : 'Edit'}
            </button>
          ) : null}
          <button
            type="button"
            className={styles.addButton}
            // One edit at a time: the first paint also creates the palette's
            // theme row, and two racing "first" adds would create two.
            disabled={isBusy}
            onClick={() => setPickerTarget({ type: 'add' })}
          >
            {isBusy ? 'Saving...' : 'Add Paint'}
          </button>
        </div>
      </header>

      {mode === 'move' ? (
        <p className={styles.modeHint}>Press and drag a paint to move it.</p>
      ) : null}

      {localPaints.length ? (
        <div className={styles.grid} data-mode={mode}>
          {localPaints.map((paint, index) => {
            const isSaving = paint.themePaintId.startsWith('pending:')
            const paintName = paint.name || 'Paint'

            return (
              <div
                key={paint.themePaintId}
                className={[
                  styles.cell,
                  draggingId === paint.themePaintId ? styles.cellDragging : '',
                ].join(' ')}
                title={paintName}
                data-palette-cell={paint.themePaintId}
                onPointerDown={(event) => startDrag(event, paint.themePaintId)}
                onPointerMove={moveDrag}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
              >
                <button
                  type="button"
                  className={styles.swatchButton}
                  disabled={isSaving || isBusy}
                  tabIndex={mode === 'move' ? -1 : undefined}
                  onClick={() => {
                    if (mode === 'move') return
                    setPickerTarget({ type: 'replace', themePaintId: paint.themePaintId })
                  }}
                >
                  <span className={styles.srOnly}>
                    Change palette paint {index + 1}: {paintName}
                  </span>
                  {paint.swatch_image_url ? (
                    <Image
                      src={paint.swatch_image_url}
                      alt=""
                      width={96}
                      height={96}
                      sizes="64px"
                      draggable={false}
                    />
                  ) : (
                    <span
                      className={styles.swatchColor}
                      style={{
                        backgroundColor: paint.hex || paint.hex_approx || '#262626',
                      }}
                    />
                  )}
                  {mode === 'move' ? (
                    <span className={styles.moveGrip} aria-hidden="true">
                      <svg viewBox="0 0 24 24">
                        <path d="M12 3v18M3 12h18M12 3l-3 3m3-3 3 3M12 21l-3-3m3 3 3-3M3 12l3-3m-3 3 3 3M21 12l-3-3m3 3-3 3" />
                      </svg>
                    </span>
                  ) : null}
                </button>
                {mode === 'edit' && !isSaving && !isBusy ? (
                  <button
                    type="button"
                    className={styles.removeButton}
                    onClick={() => removePaint(paint.themePaintId)}
                  >
                    <span className={styles.srOnly}>Remove {paintName}</span>
                    <span className={styles.removeGlyph} aria-hidden="true">
                      ×
                    </span>
                  </button>
                ) : null}
                <span className={styles.brand}>{paint.brand || paint.line || 'Paint'}</span>
                <span className={styles.name}>{paintName}</span>
              </div>
            )
          })}
        </div>
      ) : (
        <>
          <p className={styles.emptyText}>
            No paints yet. Add paints, or let Magic Palette match paints to this{' '}
            {subject}&apos;s hero image.
          </p>
          <form
            className={styles.magic}
            action={unitId ? calculateUnitPaletteAction : calculateProjectPaletteAction}
          >
            {unitId ? (
              <input type="hidden" name="unitId" value={unitId} />
            ) : (
              <input type="hidden" name="projectId" value={projectId} />
            )}
            <SubmitButton
              idleText="Magic Palette"
              pendingText="Calculating..."
              className={styles.magicButton}
            />
          </form>
        </>
      )}

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      <PaintPickerDialog
        open={pickerTarget !== null}
        onOpenChange={(open) => {
          if (!open) setPickerTarget(null)
        }}
        title={pickerTarget?.type === 'replace' ? 'Change Paint' : 'Add Paint'}
        selectedPaint={replacingPaint}
        selectedPaintId={
          replacingPaint ? `${replacingPaint.source}:${replacingPaint.id}` : null
        }
        onSelectPaint={choosePaint}
        source={unitId ? 'unit_palette_picker' : 'project_palette_picker'}
      />
    </section>
  )
}
