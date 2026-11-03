'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from '@/app/components/navigation-feedback/navigation-provider'
import { findVisibleFeatureGuideIndex } from '../components/feature-guide-navigation'
import { paintModeFeatureGuides } from '../components/feature-guide-presets'
import type { GuidesV3DeckDetail } from '../guides/guides-v3-detail-data'
import type { PaintPickerPaint } from '../../components/paints/paint-picker-dialog'
import { validateGalleryImageFile } from '../../utils/images/gallery-upload'
import {
  addPaintToStage,
  editUnitPalette,
  endUnitSession,
  startUnitSession,
  uploadUnitGalleryImages,
} from '../units/[id]/actions'
import { pausePaintSession, resumePaintSession, saveUnitNote } from './actions'
import { createPaintModeFixtureUnit } from './paint-mode-fixture'
import {
  getFocusUnit,
  type PaintModeImage,
  type PaintModeSessionTiming,
  type PaintModeSwatch,
  type PaintModeUnit,
  type PaintModeViewModel,
} from './paint-mode-model'
import PaintModeView, { getSessionSeconds, type PaintModeBusy, type PaintModeTool } from './paint-mode-view'
import {
  EndSessionDialog,
  GuidesSheet,
  ImagesSheet,
  NoteSheet,
  PaletteSheet,
  UnitPickerSheet,
  type UnitPickerIntent,
} from './paint-mode-overlays'
import styles from './paint-mode-og.module.css'

const FeatureGuideTour = dynamic(() => import('../components/feature-guide-tour'), { ssr: false })
const PaintPickerDialog = dynamic(() => import('../../components/paints/paint-picker-dialog'), { ssr: false })

type Overlay =
  | { type: 'picker'; intent: UnitPickerIntent }
  | { type: 'end' }
  | { type: 'note' }
  | { type: 'palette' }
  | { type: 'guide' }
  | { type: 'inspiration' }
  | { type: 'progress' }

type PaintModeScreenProps = {
  initialModel: PaintModeViewModel
  // 'fixture' runs every action against local state (golden fixtures only).
  mode: 'live' | 'fixture'
  returnHref: string
  // The ?return= value to carry along when Paint Mode rewrites its own URL.
  returnParam: string | null
  basePath: string
  // Server render time, so the first timer frame matches during hydration.
  renderedAt: number
  // Fixture mode only: the guide the sample units carry (a real one when signed in).
  fixtureDeck?: GuidesV3DeckDetail | null
}

export default function PaintModeScreen({ initialModel, mode, returnHref, returnParam, basePath, renderedAt, fixtureDeck = null }: PaintModeScreenProps) {
  const router = useRouter()
  const [isNavigating, startNavigation] = useTransition()
  const [model, setModel] = useState(initialModel)
  const [syncedModel, setSyncedModel] = useState(initialModel)
  const [busy, setBusy] = useState<PaintModeBusy>(null)
  const [overlay, setOverlay] = useState<Overlay | null>(null)
  const [paintPickerOpen, setPaintPickerOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [tourIndex, setTourIndex] = useState<number | null>(null)
  const [nowMs, setNowMs] = useState(renderedAt)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const overlayPushedRef = useRef(false)

  // A server refresh (live mode) hands us a new model; adopt it.
  if (initialModel !== syncedModel) {
    setSyncedModel(initialModel)
    setModel(initialModel)
  }

  const focusUnit = getFocusUnit(model)
  const isLive = mode === 'live'
  const shownBusy: PaintModeBusy = busy ?? (isNavigating ? 'start' : null)

  useEffect(() => {
    setNowMs(Date.now())
    const id = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(null), 4200)
    return () => window.clearTimeout(id)
  }, [toast])

  // Overlays sit on one history entry, so the phone's back button returns to
  // Paint Mode instead of leaving it.
  useEffect(() => {
    const onPopState = () => {
      if (!overlayPushedRef.current) return
      overlayPushedRef.current = false
      setOverlay(null)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const openOverlay = useCallback((next: Overlay) => {
    if (!overlayPushedRef.current) {
      window.history.pushState({ ...window.history.state, paintModeOverlay: true }, '')
      overlayPushedRef.current = true
    }
    setOverlay(next)
  }, [])

  const closeOverlay = useCallback(() => {
    setOverlay(null)
    if (overlayPushedRef.current) {
      overlayPushedRef.current = false
      window.history.back()
    }
  }, [])

  const patchUnit = useCallback((unitId: string, patch: (unit: PaintModeUnit) => PaintModeUnit) => {
    setModel((current) => ({
      ...current,
      units: current.units.map((unit) => (unit.unitId === unitId ? patch(unit) : unit)),
    }))
  }, [])

  const hrefFor = useCallback(
    (focusUnitId: string | null) => {
      const params = new URLSearchParams()
      if (focusUnitId) params.set('unit', focusUnitId)
      if (returnParam) params.set('return', returnParam)
      const query = params.toString()
      return query ? `${basePath}${basePath.includes('?') ? '&' : '?'}${query}` : basePath
    },
    [basePath, returnParam]
  )

  async function run(kind: Exclude<PaintModeBusy, null>, task: () => Promise<void>) {
    setBusy(kind)
    try {
      await task()
    } catch (error) {
      console.error('[paint-mode]', error)
      setToast(error instanceof Error && error.message !== 'Unauthorized'
        ? error.message
        : 'That did not save. Check your connection and try again.')
    } finally {
      setBusy(null)
    }
  }

  // ---------- Session lifecycle ----------

  function pickUnit(intent: UnitPickerIntent, unitId: string) {
    const previous = focusUnit
    closeOverlay()

    void run(intent, async () => {
      if (!isLive) {
        setModel((current) => {
          const remaining = intent === 'switch' && previous
            ? current.units.filter((unit) => unit.unitId !== previous.unitId)
            : current.units
          const existing = remaining.find((unit) => unit.unitId === unitId)
          return {
            ...current,
            units: existing ? remaining : [...remaining, createPaintModeFixtureUnit(unitId, undefined, fixtureDeck)],
            focusUnitId: unitId,
          }
        })
        return
      }

      if (intent === 'switch' && previous) {
        await endUnitSession(previous.unitId)
      }
      await startUnitSession(unitId, new Date().toISOString())
      // A new URL already re-renders on the server; refreshing as well raced
      // it with a request for the old URL, whose late answer blanked the screen.
      const href = hrefFor(unitId)
      const current = `${window.location.pathname}${window.location.search}`
      startNavigation(() => {
        if (href === current) router.refresh()
        else router.replace(href, { scroll: false })
      })
    })
  }

  function endSessions(scope: 'unit' | 'all') {
    if (!focusUnit) return
    const ending = scope === 'all' ? model.units : [focusUnit]
    const remaining = model.units.filter((unit) => !ending.includes(unit))
    closeOverlay()

    void run('end', async () => {
      if (isLive) {
        for (const unit of ending) {
          await endUnitSession(unit.unitId)
        }
      }

      if (!remaining.length) {
        if (isLive) {
          router.push(returnHref)
        } else {
          setModel((current) => ({ ...current, units: [], focusUnitId: null }))
        }
        return
      }

      const nextFocus = remaining[remaining.length - 1].unitId
      setModel((current) => ({ ...current, units: remaining, focusUnitId: nextFocus }))
      if (isLive) {
        startNavigation(() => router.replace(hrefFor(nextFocus), { scroll: false }))
      }
    })
  }

  function togglePause() {
    if (!focusUnit) return
    const unit = focusUnit
    const pausing = !unit.session.pausedAt

    void run('pause', async () => {
      let timing: PaintModeSessionTiming | null
      if (isLive) {
        timing = pausing ? await pausePaintSession(unit.unitId) : await resumePaintSession(unit.unitId)
      } else {
        const now = Date.now()
        timing = pausing
          ? { ...unit.session, pausedAt: new Date(now).toISOString() }
          : {
              ...unit.session,
              pausedAt: null,
              pausedSeconds:
                unit.session.pausedSeconds +
                Math.floor((now - Date.parse(unit.session.pausedAt!)) / 1000),
            }
      }

      if (!timing) {
        // The session was closed elsewhere (another device, or the 2h cap).
        setToast('This session already ended.')
        if (isLive) router.refresh()
        return
      }
      patchUnit(unit.unitId, (current) => ({ ...current, session: timing }))
    })
  }

  function focusOn(unitId: string) {
    setModel((current) => ({ ...current, focusUnitId: unitId }))
    if (isLive) window.history.replaceState(window.history.state, '', hrefFor(unitId))
  }

  // ---------- Tools ----------

  function openTool(tool: PaintModeTool) {
    if (!focusUnit) {
      openOverlay({ type: 'picker', intent: 'start' })
      return
    }

    switch (tool) {
      case 'note':
        openOverlay({ type: 'note' })
        return
      case 'paints-used':
        setPaintPickerOpen(true)
        return
      case 'snapshot':
        fileInputRef.current?.click()
        return
      case 'guide':
        openOverlay({ type: 'guide' })
        return
      case 'inspiration':
        openOverlay({ type: 'inspiration' })
        return
      case 'palette':
        openOverlay({ type: 'palette' })
        return
      case 'progress':
        openOverlay({ type: 'progress' })
        return
    }
  }

  async function saveNote(notes: string) {
    if (!focusUnit) return
    const unitId = focusUnit.unitId
    try {
      const saved = isLive ? await saveUnitNote(unitId, notes) : { notes: notes.trim() }
      patchUnit(unitId, (unit) => ({ ...unit, note: saved.notes }))
      closeOverlay()
    } catch (error) {
      console.error('[paint-mode] note', error)
      setToast('The note did not save. Try again.')
    }
  }

  function logPaint(paint: PaintPickerPaint) {
    if (!focusUnit) return
    const unit = focusUnit
    setPaintPickerOpen(false)

    const swatch: PaintModeSwatch = {
      id: paint.id,
      source: paint.source,
      name: paint.name || 'Paint',
      brand: paint.brand,
      line: paint.line,
      hex: paint.hex ?? paint.hex_approx ?? null,
      swatchImageUrl: paint.swatch_image_url,
    }
    const sameSwatch = (other: PaintModeSwatch) => other.id === swatch.id && other.source === swatch.source
    const alreadyOnStage = unit.stagePaints.some(sameSwatch)
    const alreadyInPalette = unit.palette.some(sameSwatch)

    patchUnit(unit.unitId, (current) => ({
      ...current,
      stagePaints: alreadyOnStage ? current.stagePaints : [...current.stagePaints, swatch],
      palette: alreadyInPalette ? current.palette : [...current.palette, swatch],
    }))
    setToast(`${swatch.name} logged${unit.stage ? ` on ${unit.stage.label}` : ''}.`)

    if (!isLive) return

    void (async () => {
      try {
        if (unit.stage?.stepId && !alreadyOnStage) {
          const formData = new FormData()
          formData.set('unitId', unit.unitId)
          formData.set('progressStepId', unit.stage.stepId)
          formData.set('paintSource', paint.source)
          formData.set('paintId', paint.id)
          await addPaintToStage(formData)
        }
        if (!alreadyInPalette) {
          await editUnitPalette(unit.unitId, { type: 'add', paintSource: paint.source, paintId: paint.id })
        }
      } catch (error) {
        console.error('[paint-mode] log paint', error)
        patchUnit(unit.unitId, (current) => ({
          ...current,
          stagePaints: alreadyOnStage ? current.stagePaints : current.stagePaints.filter((item) => !sameSwatch(item)),
          palette: alreadyInPalette ? current.palette : current.palette.filter((item) => !sameSwatch(item)),
        }))
        setToast(`${swatch.name} did not save. Try again.`)
      }
    })()
  }

  async function uploadSnapshots(fileList: FileList | null) {
    if (!focusUnit || !fileList?.length) return
    const unit = focusUnit
    const files = Array.from(fileList)
    const invalid = files.map(validateGalleryImageFile).find(Boolean)
    if (invalid) {
      setToast(invalid)
      return
    }

    const previews: PaintModeImage[] = files.map((file) => ({
      id: `pending-${crypto.randomUUID()}`,
      src: URL.createObjectURL(file),
      alt: `${unit.name} snapshot`,
      createdAt: new Date().toISOString(),
    }))
    patchUnit(unit.unitId, (current) => ({ ...current, snapshots: [...current.snapshots, ...previews] }))

    if (!isLive) {
      setToast(files.length > 1 ? `${files.length} snapshots saved.` : 'Snapshot saved.')
      return
    }

    try {
      const formData = new FormData()
      formData.set('unitId', unit.unitId)
      formData.set('uploadSource', 'camera')
      formData.set('unitSessionId', unit.session.id)
      if (unit.stage) formData.set('stageKey', unit.stage.stepKey)
      files.forEach((file) => formData.append('image', file))

      const result = await uploadUnitGalleryImages(formData)
      const uploaded: PaintModeImage[] = (result?.uploadedImages ?? []).map((image) => ({
        id: image.id,
        src: image.image_url,
        alt: `${unit.name} snapshot`,
        createdAt: image.created_at,
      }))
      const previewIds = new Set(previews.map((preview) => preview.id))
      patchUnit(unit.unitId, (current) => ({
        ...current,
        snapshots: [...current.snapshots.filter((image) => !previewIds.has(image.id)), ...uploaded],
      }))
      setToast(result?.failed.length
        ? `Could not save ${result.failed.map((failure) => failure.fileName).join(', ')}.`
        : uploaded.length > 1 ? `${uploaded.length} snapshots saved.` : 'Snapshot saved.')
    } catch (error) {
      console.error('[paint-mode] snapshot', error)
      const previewIds = new Set(previews.map((preview) => preview.id))
      patchUnit(unit.unitId, (current) => ({
        ...current,
        snapshots: current.snapshots.filter((image) => !previewIds.has(image.id)),
      }))
      setToast('The snapshot did not upload. Try again.')
    } finally {
      previews.forEach((preview) => URL.revokeObjectURL(preview.src))
    }
  }

  // ---------- Tour ----------

  const activeGuide = tourIndex === null ? null : paintModeFeatureGuides[tourIndex] ?? null
  const unitHref = focusUnit ? `/units/${focusUnit.unitId}?preview=1` : '/projects'
  const sessionUnitIds = useMemo(() => model.units.map((unit) => unit.unitId), [model.units])

  return (
    <>
      <PaintModeView
        model={model}
        focusUnit={focusUnit}
        nowMs={nowMs}
        busy={shownBusy}
        onClose={() => router.push(returnHref)}
        onHelp={() => setTourIndex(findVisibleFeatureGuideIndex(paintModeFeatureGuides, null, 1) ?? 0)}
        onChooseUnit={() => openOverlay({ type: 'picker', intent: 'start' })}
        onSwitchUnit={() => openOverlay({ type: 'picker', intent: 'switch' })}
        onAddUnit={() => openOverlay({ type: 'picker', intent: 'add' })}
        onFocusUnit={focusOn}
        onEnd={() => openOverlay({ type: 'end' })}
        onTogglePause={togglePause}
        onTool={openTool}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className={styles.srOnly}
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          void uploadSnapshots(event.target.files)
          event.target.value = ''
        }}
      />

      {overlay?.type === 'picker' ? (
        <UnitPickerSheet
          intent={overlay.intent}
          projects={model.projects}
          sessionUnitIds={sessionUnitIds}
          focusUnitId={focusUnit?.unitId ?? null}
          onPick={(unitId) => {
            // Choosing a unit that already has a timer just brings it forward.
            if (overlay.intent === 'start' && sessionUnitIds.includes(unitId)) {
              closeOverlay()
              focusOn(unitId)
              return
            }
            pickUnit(overlay.intent, unitId)
          }}
          onClose={closeOverlay}
        />
      ) : null}

      {overlay?.type === 'end' && focusUnit ? (
        <EndSessionDialog
          unit={focusUnit}
          unitCount={model.units.length}
          sessionSeconds={getSessionSeconds(focusUnit, nowMs)}
          onEndUnit={() => endSessions('unit')}
          onEndAll={() => endSessions('all')}
          onClose={closeOverlay}
        />
      ) : null}

      {overlay?.type === 'note' && focusUnit ? (
        <NoteSheet key={focusUnit.unitId} unit={focusUnit} onSave={saveNote} onClose={closeOverlay} />
      ) : null}

      {overlay?.type === 'palette' && focusUnit ? (
        <PaletteSheet unit={focusUnit} unitHref={unitHref} onClose={closeOverlay} />
      ) : null}

      {overlay?.type === 'guide' && focusUnit ? (
        <GuidesSheet
          guides={focusUnit.guides}
          initialGuideId={focusUnit.guides.length === 1 ? focusUnit.guides[0].id : null}
          unitHref={unitHref}
          onClose={closeOverlay}
        />
      ) : null}

      {overlay?.type === 'inspiration' && focusUnit ? (
        <ImagesSheet
          title="Inspiration Gallery"
          images={focusUnit.inspiration}
          emptyText="No gallery photos on this unit yet. Add reference photos from the unit page."
          showDates={false}
          onClose={closeOverlay}
        />
      ) : null}

      {overlay?.type === 'progress' && focusUnit ? (
        <ImagesSheet
          title="Progress Gallery"
          images={focusUnit.snapshots}
          emptyText="No snapshots yet. Use Take Snapshot while you paint to build a timeline of this unit."
          showDates
          onClose={closeOverlay}
        />
      ) : null}

      {paintPickerOpen ? (
        <PaintPickerDialog
          open={paintPickerOpen}
          onOpenChange={setPaintPickerOpen}
          title={focusUnit?.stage ? `Paints Used · ${focusUnit.stage.label}` : 'Paints Used'}
          onSelectPaint={logPaint}
          source="paint_mode"
        />
      ) : null}

      {activeGuide ? (
        <FeatureGuideTour
          activeIndex={tourIndex ?? 0}
          guide={activeGuide}
          guides={paintModeFeatureGuides}
          totalGuides={paintModeFeatureGuides.length}
          onClose={() => setTourIndex(null)}
          onNext={() => {
            const next = findVisibleFeatureGuideIndex(paintModeFeatureGuides, tourIndex, 1)
            if (next === tourIndex) setTourIndex(null)
            else setTourIndex(next)
          }}
          onPrevious={() => setTourIndex(findVisibleFeatureGuideIndex(paintModeFeatureGuides, tourIndex, -1) ?? 0)}
        />
      ) : null}

      {toast ? (
        <div className={styles.toast} role="status">{toast}</div>
      ) : null}
    </>
  )
}
