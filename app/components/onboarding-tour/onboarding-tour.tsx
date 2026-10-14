'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { usePathname, useRouter } from 'next/navigation'
import guideStyles from '../feature-guide-tour.module.css'
import styles from './onboarding-tour.module.css'
import { saveOnboardingTourStatus, type OnboardingTourStatus } from './actions'
import {
  clearPendingOnboardingTourStart,
  peekPendingOnboardingTourStart,
  START_ONBOARDING_TOUR_EVENT,
  type StartOnboardingTourDetail,
} from './tour-events'
import {
  ONBOARDING_VIDEO_URL,
  onboardingTourSteps,
  type TourCopy,
  type TourPlacement,
  type TourStep,
} from './tour-steps'
import {
  markOnboardingTourDone,
  ONBOARDING_TOUR_SESSION_KEY,
  readSessionValue,
  REMIND_LATER_SESSION_KEY,
  writeSessionValue,
} from './tour-storage'

type TourSession = {
  stepIndex: number
  automatic: boolean
  test?: boolean
  userId: string | null
  /** Epoch ms when this run began. */
  startedAt?: number
}

type Resolved = {
  stepId: string
  copy: TourCopy
  /** Every highlighted element; the ring wraps them all as one area. */
  targets: HTMLElement[]
}

const RESOLVE_TIMEOUT_MS = 4000
const VIEWPORT_MARGIN = 12
const GAP = 14
const RING_PADDING = 7

const spotlightSteps = onboardingTourSteps.filter(
  (step) => step.kind === 'spotlight'
)

function isVisible(element: Element) {
  if (element.closest('[hidden], [aria-hidden="true"]')) return false
  const rect = element.getBoundingClientRect()
  const style = window.getComputedStyle(element)
  return (
    rect.width > 0 &&
    rect.height > 0 &&
    style.display !== 'none' &&
    style.visibility !== 'hidden'
  )
}

function findTargets(uids: string | string[] | undefined) {
  return [uids ?? []]
    .flat()
    .map(findTarget)
    .filter((target): target is HTMLElement => target !== null)
}

function findTarget(uid: string) {
  const candidates = document.querySelectorAll<HTMLElement>(
    `[data-tour-target="${uid}"], [data-feature-guide-target="${uid}"]`
  )
  return Array.from(candidates).find(isVisible) ?? null
}

function resolveStep(step: TourStep, timedOut: boolean): Resolved | null {
  const emptyMarker = step.emptyWhen
    ? document.querySelector(step.emptyWhen)
    : null

  if (emptyMarker && step.empty) {
    const targets = findTargets(step.empty.target ?? step.target)
    if (targets.length || timedOut) {
      return { stepId: step.id, copy: step.empty, targets }
    }
    return null
  }

  const targets = findTargets(step.target)
  if (targets.length || timedOut) {
    return { stepId: step.id, copy: step, targets }
  }
  return null
}

// One rectangle around every target, kept on screen so a long grid plus a
// docked panel still reads as a single highlighted area.
function getUnionRect(targets: HTMLElement[]) {
  const rects = targets.map((target) => target.getBoundingClientRect())
  const top = Math.max(
    VIEWPORT_MARGIN,
    Math.min(...rects.map((rect) => rect.top))
  )
  const left = Math.max(
    VIEWPORT_MARGIN,
    Math.min(...rects.map((rect) => rect.left))
  )
  const bottom = Math.min(
    window.innerHeight - VIEWPORT_MARGIN,
    Math.max(...rects.map((rect) => rect.bottom))
  )
  const right = Math.min(
    window.innerWidth - VIEWPORT_MARGIN,
    Math.max(...rects.map((rect) => rect.right))
  )
  return new DOMRect(left, top, Math.max(0, right - left), Math.max(0, bottom - top))
}

// Resume a tour that was in progress before a reload.
function sessionFromStart(detail: StartOnboardingTourDetail): TourSession {
  return {
    stepIndex: 0,
    automatic: Boolean(detail.automatic),
    test: Boolean(detail.test),
    userId: detail.userId ?? null,
    startedAt: Date.now(),
  }
}

function readSavedSession(): TourSession | null {
  const pending = peekPendingOnboardingTourStart()
  if (pending) return sessionFromStart(pending)

  const saved = readSessionValue(ONBOARDING_TOUR_SESSION_KEY)
  if (!saved) return null
  try {
    const parsed = JSON.parse(saved) as TourSession
    if (typeof parsed.stepIndex !== 'number') return null
    // A test link always starts over: ignore a run saved before this page
    // loaded, but keep the one the link itself just started.
    const isTestLink =
      new URLSearchParams(window.location.search).get('tour') === 'test'
    if (isTestLink && (parsed.startedAt ?? 0) < performance.timeOrigin) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function getStepHref(route: string) {
  const isPreview =
    new URLSearchParams(window.location.search).get('preview') === '1'
  return isPreview ? `${route}?preview=1` : route
}

function getPanelPosition(
  rect: DOMRect,
  placement: TourPlacement,
  panelWidth: number,
  panelHeight: number
) {
  const centerLeft = rect.left + rect.width / 2 - panelWidth / 2
  const fitsBelow =
    rect.bottom + GAP + panelHeight <= window.innerHeight - VIEWPORT_MARGIN
  const fitsAbove = rect.top - GAP - panelHeight >= VIEWPORT_MARGIN
  let left = centerLeft
  let top = rect.bottom + GAP

  if (placement === 'top') {
    // A highlight taller than half the screen (a grid plus a docked panel)
    // leaves no room outside it, so the card sits over its top edge and
    // keeps the bottom of the highlight visible.
    const isTall = rect.height > window.innerHeight / 2
    top = fitsAbove
      ? rect.top - GAP - panelHeight
      : isTall
        ? VIEWPORT_MARGIN
        : rect.bottom + GAP
  } else if (placement === 'left') {
    left = rect.left - panelWidth - GAP
    top = rect.top + rect.height / 2 - panelHeight / 2
  } else if (placement === 'right') {
    left = rect.right + GAP
    top = rect.top + rect.height / 2 - panelHeight / 2
  } else {
    if (placement === 'bottom-end') left = rect.right - panelWidth
    if (!fitsBelow && fitsAbove) top = rect.top - GAP - panelHeight
  }

  return {
    left: Math.max(
      VIEWPORT_MARGIN,
      Math.min(left, window.innerWidth - panelWidth - VIEWPORT_MARGIN)
    ),
    top: Math.max(
      VIEWPORT_MARGIN,
      Math.min(top, window.innerHeight - panelHeight - VIEWPORT_MARGIN)
    ),
  }
}

function Paragraphs({ text }: { text: string }) {
  return (
    <>
      {text.split('\n\n').map((paragraph) => (
        <p key={paragraph} className={guideStyles.copy}>
          {paragraph}
        </p>
      ))}
    </>
  )
}

function VideoButton() {
  return (
    <div className={styles.videoRow}>
      <a
        href={ONBOARDING_VIDEO_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={styles.videoButton}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.videoIcon}>
          <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <path d="M10 8.5v7l5.5-3.5z" fill="currentColor" />
        </svg>
        Watch the video walkthrough
      </a>
    </div>
  )
}

export default function OnboardingTour() {
  const router = useRouter()
  const pathname = usePathname()
  const [session, setSession] = useState<TourSession | null>(readSavedSession)
  const [resolved, setResolved] = useState<Resolved | null>(null)
  const [measured, setMeasured] = useState<{
    for: Resolved
    rect: DOMRect
  } | null>(null)
  const [panelSize, setPanelSize] = useState({ width: 340, height: 220 })
  const panelObserver = useRef<ResizeObserver | null>(null)
  const panelRef = useCallback((panel: HTMLElement | null) => {
    panelObserver.current?.disconnect()
    panelObserver.current = null
    if (!panel) return

    const measure = () => {
      const { offsetWidth: width, offsetHeight: height } = panel
      setPanelSize((current) =>
        current.width === width && current.height === height
          ? current
          : { width, height }
      )
    }
    measure()
    panelObserver.current = new ResizeObserver(measure)
    panelObserver.current.observe(panel)
  }, [])

  const step =
    session === null ? null : onboardingTourSteps[session.stepIndex] ?? null

  useEffect(() => {
    // Once a tour is running, its progress lives in session storage, so a
    // remount resumes it instead of replaying the original start request.
    if (session) clearPendingOnboardingTourStart()
    writeSessionValue(
      ONBOARDING_TOUR_SESSION_KEY,
      session ? JSON.stringify(session) : null
    )
  }, [session])

  useEffect(() => {
    function handleStart(event: Event) {
      const detail = (event as CustomEvent<StartOnboardingTourDetail>).detail
      setResolved(null)
      setSession(sessionFromStart(detail ?? {}))
    }

    window.addEventListener(START_ONBOARDING_TOUR_EVENT, handleStart)
    return () =>
      window.removeEventListener(START_ONBOARDING_TOUR_EVENT, handleStart)
  }, [])

  const finish = useCallback(
    (status: OnboardingTourStatus | null) => {
      if (status && !session?.test) {
        markOnboardingTourDone(session?.userId ?? null)
        void saveOnboardingTourStatus(status)
      }
      setSession(null)
      setResolved(null)
    },
    [session?.test, session?.userId]
  )

  const goTo = useCallback((stepIndex: number) => {
    setResolved(null)
    setSession((current) => (current ? { ...current, stepIndex } : current))
  }, [])

  // Bring the user to the step's page, then wait for its target to render.
  useEffect(() => {
    if (!step || step.kind !== 'spotlight' || !step.route) return

    if (pathname !== step.route) {
      router.push(getStepHref(step.route))
      return
    }

    const startedAt = Date.now()
    let scrolled = false
    const timer = window.setInterval(() => {
      const timedOut = Date.now() - startedAt > RESOLVE_TIMEOUT_MS
      const next = resolveStep(step, timedOut)
      if (!next) return

      window.clearInterval(timer)
      const [first] = next.targets
      if (first && !scrolled) {
        scrolled = true
        first.scrollIntoView({
          behavior: 'smooth',
          block: next.targets.length > 1 ? 'start' : 'center',
        })
      }
      setResolved(next)
    }, 120)

    return () => window.clearInterval(timer)
  }, [pathname, router, step])

  // Keep the highlight glued to its target while the page scrolls or resizes.
  useEffect(() => {
    const current = resolved
    const targets = current?.targets ?? []
    if (!current || !targets.length) return

    let frame = 0
    const update = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() =>
        setMeasured({ for: current, rect: getUnionRect(targets) })
      )
    }

    update()
    const settle = window.setTimeout(update, 400)
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      cancelAnimationFrame(frame)
      window.clearTimeout(settle)
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [resolved])

  useEffect(() => {
    if (!session) return
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') finish(session?.automatic ? 'skipped' : null)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [finish, session])

  if (!session || !step || typeof document === 'undefined') return null

  const stepIndex = session.stepIndex
  const isWelcome = step.id === 'welcome'
  const isFinish = stepIndex === onboardingTourSteps.length - 1
  const spotlightPosition = spotlightSteps.indexOf(step) + 1
  const isReady = step.kind === 'modal' || resolved?.stepId === step.id
  const copy: TourCopy = step.kind === 'modal' ? step : resolved?.copy ?? step
  const rect =
    isReady && step.kind === 'spotlight' && measured?.for === resolved
      ? measured.rect
      : null

  const centered = {
    left: Math.max(VIEWPORT_MARGIN, (window.innerWidth - panelSize.width) / 2),
    top: Math.max(VIEWPORT_MARGIN, (window.innerHeight - panelSize.height) / 2),
  }
  const position = rect
    ? getPanelPosition(
        rect,
        copy.placement ?? step.placement ?? 'bottom',
        panelSize.width,
        panelSize.height
      )
    : centered

  return createPortal(
    <div className={guideStyles.overlay} data-onboarding-tour="true">
      <div className={`${guideStyles.scrim} ${styles.scrim}`} />

      {rect ? (
        <div
          aria-hidden="true"
          className={guideStyles.ring}
          style={{
            left: rect.left - RING_PADDING,
            top: rect.top - RING_PADDING,
            width: rect.width + RING_PADDING * 2,
            height: rect.height + RING_PADDING * 2,
          }}
        />
      ) : null}

      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-live="polite"
        aria-label={isReady ? copy.title : 'Loading the next stop'}
        data-onboarding-tour-step={step.id}
        className={`${guideStyles.panel} ${
          step.kind === 'modal' ? styles.modalPanel : styles.spotlightPanel
        }`}
        style={{ left: position.left, top: position.top }}
      >
        {!isReady ? (
          <div className={guideStyles.panelBody}>
            <p className={guideStyles.eyebrow}>App tour</p>
            <p className={`${guideStyles.copy} ${styles.loadingCopy}`}>
              Heading to {step.section}…
            </p>
          </div>
        ) : (
          <>
            <div className={guideStyles.panelHeader}>
              <div>
                <p className={guideStyles.eyebrow}>
                  {step.section}
                  {session.test ? ' · Test run' : ''}
                </p>
                <h2 className={guideStyles.title}>{copy.title}</h2>
              </div>
              <div className={guideStyles.headerActions}>
                {step.kind === 'spotlight' ? (
                  <span className={guideStyles.counter}>
                    {spotlightPosition}/{spotlightSteps.length}
                  </span>
                ) : null}
                {!isWelcome ? (
                  <button
                    type="button"
                    onClick={() => finish(isFinish ? 'completed' : 'skipped')}
                    aria-label="End the tour"
                    className={guideStyles.closeButton}
                  >
                    x
                  </button>
                ) : null}
              </div>
            </div>

            <div className={`${guideStyles.panelBody} ${styles.body}`}>
              <Paragraphs text={copy.body} />
              {step.kind === 'modal' && ONBOARDING_VIDEO_URL ? (
                <VideoButton />
              ) : null}
            </div>

            {isWelcome ? (
              <div className={styles.welcomeFooter}>
                <button
                  type="button"
                  className={`${guideStyles.navButton} ${guideStyles.primaryButton}`}
                  onClick={() => goTo(1)}
                >
                  Start the tour
                </button>
                {session.automatic ? (
                  <div className={styles.secondaryActions}>
                    <button
                      type="button"
                      className={guideStyles.navButton}
                      onClick={() => {
                        if (!session.test) {
                          writeSessionValue(REMIND_LATER_SESSION_KEY, '1')
                        }
                        finish(null)
                      }}
                    >
                      Remind me later
                    </button>
                    <button
                      type="button"
                      className={guideStyles.navButton}
                      onClick={() => finish('skipped')}
                    >
                      Skip tour
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className={guideStyles.navButton}
                    onClick={() => finish(null)}
                  >
                    Not now
                  </button>
                )}
              </div>
            ) : isFinish ? (
              <div className={styles.welcomeFooter}>
                <button
                  type="button"
                  className={`${guideStyles.navButton} ${guideStyles.primaryButton}`}
                  onClick={() => {
                    finish('completed')
                    if (pathname !== '/dashboard') {
                      router.push(getStepHref('/dashboard'))
                    }
                  }}
                >
                  Go to my Dashboard
                </button>
              </div>
            ) : (
              <div className={guideStyles.panelFooter}>
                <button
                  type="button"
                  onClick={() => goTo(stepIndex - 1)}
                  className={guideStyles.navButton}
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => goTo(stepIndex + 1)}
                  className={`${guideStyles.navButton} ${guideStyles.primaryButton}`}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </aside>
    </div>,
    document.body
  )
}
