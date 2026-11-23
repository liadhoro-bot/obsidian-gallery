'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  recordEngagementDelivery,
  recordNotificationEvent,
  recordVisitAndGetPrompt,
} from '../../engage/actions'
import { detectPushStatus, usePushNotifications } from '../../../lib/push/use-push-notifications'
import type { RenderedMessage } from '../../../lib/engage/types'
import { PopupView, TopperView } from './engage-surfaces'

// One ENGAGE surface for the whole app (framework sections 5 and 9): at most
// one topper visible, at most one popup per app session, never a popup the
// instant the app opens (it waits POPUP_DELAY_MS). What to show is decided on the server
// (recordVisitAndGetPrompt); this only renders it and reports what happened.
//
// ?engage_preview=<message key> (admins) renders any popup/topper with the
// admin's own data, live or still in review, without affecting suppression.

const POPUP_SESSION_KEY = 'og:engage:popup-shown'
const CHECK_INTERVAL_MS = 10 * 60 * 1000
// Long enough not to collide with the page appearing, short enough that a
// quick peek at the dashboard still sees it.
const POPUP_DELAY_MS = 2000
const PUSH_OBSERVED_KEY = 'og:engage:push-observed'

function readSession(key: string) {
  try {
    return window.sessionStorage.getItem(key)
  } catch {
    return null
  }
}

function writeSession(key: string, value: string) {
  try {
    window.sessionStorage.setItem(key, value)
  } catch {}
}

function toPermission(status: Awaited<ReturnType<typeof detectPushStatus>>) {
  if (status === 'on') return 'granted' as const
  if (status === 'denied') return 'denied' as const
  if (status === 'off') return 'prompt' as const
  return 'unsupported' as const
}

// The first-run tour, the upgrade dialog or any other modal has the floor.
function anotherOverlayIsOpen() {
  return Boolean(document.querySelector('[data-onboarding-tour], [aria-modal="true"]'))
}

function useMessageActions(message: RenderedMessage, onClose: () => void) {
  const router = useRouter()
  const isOptIn = message.family === 'notification_opt_in'
  const push = usePushNotifications(`engage_${message.surface}`)

  useEffect(() => {
    void recordEngagementDelivery(message.key, 'shown', message.targetId, message.isPreview).catch(() => {})
    if (isOptIn && !message.isPreview) {
      void recordNotificationEvent('soft_prompt_shown', `engage_${message.surface}`, 'prompt').catch(() => {})
    }
  }, [isOptIn, message])

  // A real opt-in ask closes once push is on. An admin preview stays up on a
  // device that already has push on, and only closes after it is turned on
  // from this ask.
  const sawPushOff = useRef(false)
  useEffect(() => {
    if (!isOptIn) return
    if (push.status !== 'on' && push.status !== 'loading') sawPushOff.current = true
    if (push.status === 'on' && (!message.isPreview || sawPushOff.current)) onClose()
  }, [isOptIn, message.isPreview, onClose, push.status])

  const act = useCallback(() => {
    void recordEngagementDelivery(message.key, 'clicked', message.targetId, message.isPreview).catch(() => {})
    if (isOptIn && message.isPreview && push.status === 'on') {
      // Preview on a device that already has push on: nothing to turn on.
      onClose()
      return
    }
    if (isOptIn) {
      if (!message.isPreview) {
        void recordNotificationEvent('soft_prompt_enable', `engage_${message.surface}`).catch(() => {})
      }
      // Straight from the tap so the native prompt is allowed to appear.
      void push.enable()
      return
    }
    onClose()
    router.push(message.ctaPath)
  }, [isOptIn, message, onClose, push, router])

  const dismiss = useCallback(() => {
    void recordEngagementDelivery(message.key, 'dismissed', message.targetId, message.isPreview).catch(() => {})
    if (isOptIn && !message.isPreview) {
      void recordNotificationEvent('soft_prompt_dismissed', `engage_${message.surface}`).catch(() => {})
    }
    onClose()
  }, [isOptIn, message, onClose])

  return { act, dismiss, busy: isOptIn && push.busy, error: isOptIn ? push.error : null }
}

function Topper({ message, onClose }: { message: RenderedMessage; onClose: () => void }) {
  const { act, dismiss, busy, error } = useMessageActions(message, onClose)
  return <TopperView message={message} onAct={act} onDismiss={dismiss} busy={busy} error={error} />
}

function Popup({ message, onClose }: { message: RenderedMessage; onClose: () => void }) {
  const { act, dismiss, busy, error } = useMessageActions(message, onClose)

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') dismiss()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [dismiss])

  return <PopupView message={message} onAct={act} onDismiss={dismiss} busy={busy} error={error} />
}

export default function EngageHost() {
  const pathname = usePathname()
  const [message, setMessage] = useState<RenderedMessage | null>(null)
  const lastCheck = useRef<{ path: string; at: number } | null>(null)
  const visible = useRef(false)
  useEffect(() => {
    visible.current = message !== null
  }, [message])

  const close = useCallback(() => setMessage(null), [])

  useEffect(() => {
    let cancelled = false
    let completed = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const previewKey = new URL(window.location.href).searchParams.get('engage_preview')

    // One check per app open, then at most every 10 minutes on navigation.
    const now = Date.now()
    if (!previewKey && visible.current) return
    if (!previewKey && lastCheck.current && now - lastCheck.current.at < CHECK_INTERVAL_MS) return
    lastCheck.current = { path: pathname, at: now }

    async function run() {
      const pushStatus = await detectPushStatus().catch(() => 'unsupported' as const)

      // Keep the server's view of this device's permission current, once a day.
      const today = new Date().toISOString().slice(0, 10)
      try {
        if (window.localStorage.getItem(PUSH_OBSERVED_KEY) !== `${today}:${pushStatus}`) {
          window.localStorage.setItem(PUSH_OBSERVED_KEY, `${today}:${pushStatus}`)
          void recordNotificationEvent('permission_observed', 'app_open', toPermission(pushStatus)).catch(() => {})
        }
      } catch {}

      const next = await recordVisitAndGetPrompt(
        {
          push:
            pushStatus === 'on' || pushStatus === 'off' || pushStatus === 'denied'
              ? pushStatus
              : pushStatus === 'loading'
                ? 'unknown'
                : 'unsupported',
          popupShownThisSession: !previewKey && readSession(POPUP_SESSION_KEY) === '1',
          pathname,
        },
        previewKey
      ).catch(() => null)

      if (cancelled) return
      completed = true
      if (!next) return
      if (next.surface === 'popup') {
        if (!next.isPreview) writeSession(POPUP_SESSION_KEY, '1')
        // Never interrupt the moment the app opens.
        timer = setTimeout(() => {
          if (cancelled || (!next.isPreview && anotherOverlayIsOpen())) return
          setMessage(next)
        }, next.isPreview ? 600 : POPUP_DELAY_MS)
      } else if (next.isPreview || !anotherOverlayIsOpen()) {
        setMessage(next)
      }
    }

    void run()
    return () => {
      cancelled = true
      // An effect torn down before it finished (route change, dev remount)
      // hasn't really checked; let the next one try.
      if (!completed) lastCheck.current = null
      if (timer) clearTimeout(timer)
    }
  }, [pathname])

  if (!message) return null
  return message.surface === 'popup' ? (
    <Popup key={message.key} message={message} onClose={close} />
  ) : (
    <Topper key={message.key} message={message} onClose={close} />
  )
}
