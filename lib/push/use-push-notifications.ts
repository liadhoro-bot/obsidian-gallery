'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  removePushSubscription,
  savePushSubscription,
  sendTestPush,
} from '../../app/settings/push-actions'

export type PushStatus =
  | 'loading'
  | 'unsupported' // browser has no Push API at all
  | 'needs-install' // iPhone/iPad Safari: only works from the Home Screen app
  | 'unconfigured' // server has no VAPID key yet
  | 'denied' // user blocked notifications in browser/OS settings
  | 'off'
  | 'on'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i)
  return output
}

function isIos() {
  const ua = navigator.userAgent
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (ua.includes('Macintosh') && navigator.maxTouchPoints > 1)
  )
}

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

async function getRegistration() {
  const existing = await navigator.serviceWorker.getRegistration('/')
  if (existing) return existing
  return navigator.serviceWorker.register('/sw.js', {
    scope: '/',
    updateViaCache: 'none',
  })
}

export function usePushNotifications() {
  const [status, setStatus] = useState<PushStatus>('loading')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function detect(): Promise<PushStatus> {
      const supported =
        'serviceWorker' in navigator &&
        'PushManager' in window &&
        'Notification' in window

      if (!supported) return isIos() && !isStandalone() ? 'needs-install' : 'unsupported'
      if (!VAPID_PUBLIC_KEY) return 'unconfigured'
      if (Notification.permission === 'denied') return 'denied'

      const registration = await navigator.serviceWorker.getRegistration('/')
      const subscription = await registration?.pushManager.getSubscription()
      return subscription ? 'on' : 'off'
    }

    detect()
      .then((next) => !cancelled && setStatus(next))
      .catch(() => !cancelled && setStatus('off'))

    return () => {
      cancelled = true
    }
  }, [])

  const enable = useCallback(async () => {
    if (!VAPID_PUBLIC_KEY) return
    setBusy(true)
    setError(null)
    try {
      // Must run straight from the tap: iOS only shows the prompt for a
      // user gesture.
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setStatus(permission === 'denied' ? 'denied' : 'off')
        return
      }

      const registration = await getRegistration()
      await navigator.serviceWorker.ready
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        }))

      const result = await savePushSubscription(
        JSON.parse(JSON.stringify(subscription)),
        navigator.userAgent
      )
      if (result.error) {
        await subscription.unsubscribe()
        setError(result.error)
        setStatus('off')
        return
      }
      setStatus('on')
    } catch (enableError) {
      setError(
        enableError instanceof Error
          ? enableError.message
          : 'Could not turn on notifications.'
      )
      setStatus('off')
    } finally {
      setBusy(false)
    }
  }, [])

  const disable = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      const registration = await navigator.serviceWorker.getRegistration('/')
      const subscription = await registration?.pushManager.getSubscription()
      if (subscription) {
        await removePushSubscription(subscription.endpoint)
        await subscription.unsubscribe()
      }
      setStatus('off')
    } catch (disableError) {
      setError(
        disableError instanceof Error
          ? disableError.message
          : 'Could not turn off notifications.'
      )
    } finally {
      setBusy(false)
    }
  }, [])

  const sendTest = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      const result = await sendTestPush()
      if (result.error) setError(result.error)
    } finally {
      setBusy(false)
    }
  }, [])

  return { status, error, busy, enable, disable, sendTest }
}

export function describePushStatus(status: PushStatus) {
  switch (status) {
    case 'loading':
      return 'Checking this device…'
    case 'unsupported':
      return "This browser doesn't support notifications."
    case 'needs-install':
      return 'On iPhone, tap Share → Add to Home Screen, then open the app from there to turn on notifications.'
    case 'unconfigured':
      return 'Notifications are not available yet.'
    case 'denied':
      return 'Notifications are blocked for this app. Allow them in your phone or browser settings, then come back.'
    case 'off':
      return 'Get reminders and updates on this device.'
    case 'on':
      return 'Notifications are on for this device.'
  }
}
