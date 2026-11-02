'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useRouter } from '@/app/components/navigation-feedback/navigation-provider'
import { OgPlaque } from '@/src/components/v3'
import PrefetchLink from '../components/prefetch-link'
import { prefetchRoute } from '../components/route-prefetch'
import { capturePostHog } from '../../utils/analytics/client'
import { resolveActionDestination } from '../../lib/recommended-action/dispatch'
import type { RecommendedActionDTO } from '../../lib/recommended-action/types'
import { clearDashboardReturn } from './dashboard-return-store'
import styles from './recommended-action-card.module.css'

type FeedbackType =
  | 'impression'
  | 'primary_click'
  | 'show_another'
  | 'snooze'
  | 'dismiss'
  | 'dismiss_reason'
  | 'action_failed'

type DismissReason = 'not_relevant' | 'already_done' | 'not_now' | 'dont_use_feature'

// Optional, one tap, after "Not interested". Never required to move on.
const DISMISS_REASONS: { value: DismissReason; label: string }[] = [
  { value: 'not_relevant', label: 'Not relevant' },
  { value: 'already_done', label: 'Already done' },
  { value: 'not_now', label: 'Not now' },
  { value: 'dont_use_feature', label: "Don't use this" },
]

export type RecommendedActionCardProps =
  | { status: 'ok'; recommendations: RecommendedActionDTO[]; storageReady: boolean }
  | { status: 'error' }

// Card counts as seen once at least half of it has been on screen for 1s.
const IMPRESSION_DELAY_MS = 1000
const OPTIMIZED_IMAGE_HOST = 'vwshzvxsitiwyayawcvr.supabase.co'

const FEEDBACK_NOTES: Partial<Record<FeedbackType, string>> = {
  snooze: "Noted. I'll bring that one back in a week.",
  dismiss: "Understood. I'll suggest less of that for a while.",
}

function createVisitId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

// Same keys the events route accepts. No names, quotes or image URLs.
function eventPayload(
  recommendation: RecommendedActionDTO,
  type: FeedbackType,
  visitId: string,
  reason?: DismissReason
) {
  return {
    type,
    ...(reason ? { reason } : {}),
    key: recommendation.recommendationKey,
    family: recommendation.family,
    actionType: recommendation.primary.type,
    targetType: recommendation.targetType,
    ruleVersion: recommendation.ruleVersion,
    rulesetVersion: recommendation.rulesetVersion,
    persona: recommendation.persona,
    personaSource: recommendation.personaSource,
    rankingRevision: recommendation.rankingRevision,
    lifecycle: recommendation.lifecycle,
    observedIntent: recommendation.observedIntent,
    dataConfidence: recommendation.dataConfidence,
    visitId,
    clientTs: new Date().toISOString(),
  }
}

function sendFeedback(
  recommendation: RecommendedActionDTO,
  type: FeedbackType,
  visitId: string,
  reason?: DismissReason
) {
  const payload = eventPayload(recommendation, type, visitId, reason)

  // keepalive lets a click event finish even as the CTA navigates away.
  void fetch('/api/recommended-action/events', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => undefined)

  void capturePostHog(`ra_${type}`, {
    recommendation_key: recommendation.recommendationKey,
    rule_id: recommendation.ruleId,
    rule_version: recommendation.ruleVersion,
    ruleset_version: recommendation.rulesetVersion,
    feature_family: recommendation.family,
    action_type: recommendation.primary.type,
    target_type: recommendation.targetType,
    persona: recommendation.persona,
    persona_source: recommendation.personaSource,
    ranking_revision: recommendation.rankingRevision ?? null,
    lifecycle: recommendation.lifecycle ?? null,
    observed_intent: recommendation.observedIntent ?? null,
    data_confidence: recommendation.dataConfidence ?? null,
    ...(reason ? { dismiss_reason: reason } : {}),
    experiment_id: recommendation.experimentAssignment?.experimentId ?? null,
    variant: recommendation.experimentAssignment?.variant ?? null,
    correlation_id: visitId,
  })
}

function RecommendationImage({ recommendation }: { recommendation: RecommendedActionDTO }) {
  const [failed, setFailed] = useState(false)
  const image = recommendation.image

  if (!image || failed) {
    return (
      <span className={styles.imageFallback} aria-hidden="true">
        <BrushIcon />
      </span>
    )
  }

  return (
    <Image
      src={image.url}
      alt={image.alt}
      fill
      sizes="(max-width: 480px) 38vw, 160px"
      // Top of the dashboard: lazy loading left an empty frame after "Show another".
      loading="eager"
      className={styles.image}
      unoptimized={!image.url.includes(OPTIMIZED_IMAGE_HOST)}
      onError={() => setFailed(true)}
    />
  )
}

function BrushIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M14.5 4.5 19.5 9.5 11 18l-5-5 8.5-8.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M6 13c-1.9.3-3 1.7-3 3.6V20h3.4c1.9 0 3.3-1.1 3.6-3" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  )
}

function Ribbon({ curator = false }: { curator?: boolean }) {
  return (
    <div className={styles.header}>
      <h2 className={styles.heading}>
        <OgPlaque>Recommended Action</OgPlaque>
      </h2>
      {curator ? <span className={styles.curatorLabel}>Note from the Curator</span> : null}
    </div>
  )
}

export default function RecommendedActionCard(props: RecommendedActionCardProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isPreview = searchParams.get('preview') === '1'
  const [visitId] = useState(createVisitId)
  const [index, setIndex] = useState(0)
  const [note, setNote] = useState<string | null>(null)
  // The recommendation just marked "Not interested", while its optional
  // reason row is showing.
  const [reasonFor, setReasonFor] = useState<RecommendedActionDTO | null>(null)
  const failedKeys = useRef(new Set<string>())
  const [isNavigating, setIsNavigating] = useState(false)
  const cardRef = useRef<HTMLElement>(null)
  const seenKeys = useRef(new Set<string>())

  const recommendations = props.status === 'ok' ? props.recommendations : []
  const current = recommendations[index] ?? null
  const destination = current
    ? resolveActionDestination(current.primary.type, current.primary.targetId)
    : null
  const href =
    destination?.kind === 'navigate'
      ? `${destination.href}${isPreview ? `${destination.href.includes('?') ? '&' : '?'}preview=1` : ''}`
      : null

  // Impression: visible ≥50% for a full second, once per recommendation per visit.
  useEffect(() => {
    const element = cardRef.current
    if (!current || !element || seenKeys.current.has(current.recommendationKey)) return

    let timer: number | null = null
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          timer ??= window.setTimeout(() => {
            seenKeys.current.add(current.recommendationKey)
            sendFeedback(current, 'impression', visitId)
            observer.disconnect()
          }, IMPRESSION_DELAY_MS)
        } else if (timer !== null) {
          window.clearTimeout(timer)
          timer = null
        }
      },
      { threshold: 0.5 }
    )

    observer.observe(element)

    return () => {
      observer.disconnect()
      if (timer !== null) window.clearTimeout(timer)
    }
  }, [current, visitId])

  // A recommendation whose CTA can't be built (target id missing or
  // invalid) is an engineering fault: report it and move on, never dead-end.
  useEffect(() => {
    if (!current || href || failedKeys.current.has(current.recommendationKey)) return
    failedKeys.current.add(current.recommendationKey)
    sendFeedback(current, 'action_failed', visitId)
    setIndex((value) => value + 1)
  }, [current, href, visitId])

  useEffect(() => {
    if (props.status === 'ok' && recommendations.length === 0) {
      void capturePostHog('ra_no_candidate', { correlation_id: visitId })
    }
  }, [props.status, recommendations.length, visitId])

  function advance(type: 'show_another' | 'snooze' | 'dismiss') {
    if (!current) return
    sendFeedback(current, type, visitId)
    setNote(FEEDBACK_NOTES[type] ?? null)
    setReasonFor(type === 'dismiss' ? current : null)
    setIndex((value) => value + 1)
  }

  function chooseReason(reason: DismissReason) {
    if (!reasonFor) return
    sendFeedback(reasonFor, 'dismiss_reason', visitId, reason)
    setReasonFor(null)
    setNote('Thanks. That helps me suggest better.')
  }

  const feedbackNote = reasonFor ? (
    <div className={styles.reasons} role="group" aria-label="Why not? Optional">
      <p className={styles.reasonsLabel}>{note} Why? <span>(optional)</span></p>
      <div className={styles.reasonButtons}>
        {DISMISS_REASONS.map((reason) => (
          <button key={reason.value} type="button" onClick={() => chooseReason(reason.value)}>
            {reason.label}
          </button>
        ))}
      </div>
    </div>
  ) : note ? (
    <p className={styles.note} role="status">{note}</p>
  ) : null

  function openAction() {
    if (!current || !href || isNavigating) return
    setIsNavigating(true)
    clearDashboardReturn()
    sendFeedback(current, 'primary_click', visitId)
    router.push(href)
  }

  if (props.status === 'error') {
    return (
      <section className={styles.card} data-v3-dashboard-indicator="recommended-action-error" aria-label="Recommended action">
        <Ribbon />
        <div className={styles.emptyBody}>
          <p className={styles.emptyTitle}>Explore your workbench</p>
          <p className={styles.emptyCopy}>Your next suggestion is taking a moment. Your projects are right here.</p>
          <PrefetchLink href={`/projects${isPreview ? '?preview=1' : ''}`} className={styles.cta}>
            Open Projects
          </PrefetchLink>
        </div>
      </section>
    )
  }

  if (!current) {
    return (
      <section className={styles.card} data-v3-dashboard-indicator="recommended-action-empty" aria-label="Recommended action">
        <Ribbon />
        <div className={styles.emptyBody}>
          {feedbackNote}
          <p className={styles.emptyTitle}>You&rsquo;re all caught up</p>
          <p className={styles.emptyCopy}>Nothing pressing on the bench. The guide library is always open.</p>
          <PrefetchLink href={`/guides?tab=library${isPreview ? '&preview=1' : ''}`} className={styles.cta}>
            Browse Guides
          </PrefetchLink>
        </div>
      </section>
    )
  }

  return (
    <section
      ref={cardRef}
      className={styles.card}
      data-v3-dashboard-indicator="recommended-action"
      data-ra-rule={current.ruleId}
      data-feature-guide-target="dashboard.next_actions.panel"
      aria-label="Recommended action"
    >
      <Ribbon curator />

      <blockquote className={styles.quote}>
        <p>&ldquo;{current.quote}&rdquo;</p>
      </blockquote>

      <div className={styles.hero} key={current.recommendationKey}>
        <div className={styles.imageMount}>
          <span className={styles.imageFrame}>
            <RecommendationImage recommendation={current} />
          </span>
        </div>

        <div className={styles.copy}>
          <p className={styles.eyebrow}>{current.eyebrow}</p>
          <h3 className={styles.title}>{current.title}</h3>
          <p className={styles.description}>{current.description}</p>
        </div>
      </div>

      {feedbackNote}

      {href ? (
        <button
          type="button"
          className={styles.cta}
          onClick={openAction}
          onPointerEnter={() => prefetchRoute(router, href)}
          disabled={isNavigating}
          aria-busy={isNavigating || undefined}
        >
          {isNavigating ? 'Opening…' : current.primary.label}
        </button>
      ) : null}

      <div className={styles.feedback} role="group" aria-label="Recommendation options">
        <button type="button" onClick={() => advance('show_another')} disabled={isNavigating}>
          Show another
        </button>
        <button type="button" onClick={() => advance('snooze')} disabled={isNavigating}>
          Remind me later
        </button>
        <button type="button" onClick={() => advance('dismiss')} disabled={isNavigating}>
          Not interested
        </button>
      </div>
    </section>
  )
}
