'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'obsidian-gallery-v3-install-dismissed-at'
const DISMISS_DAYS = 7

function isDismissedRecently() {
  const dismissedAt = Number(window.localStorage.getItem(DISMISS_KEY) || 0)

  if (!dismissedAt) {
    return false
  }

  return Date.now() - dismissedAt < DISMISS_DAYS * 24 * 60 * 60 * 1000
}

function isAppDisplayMode() {
  const navigatorWithStandalone = window.navigator as Navigator & {
    standalone?: boolean
  }

  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    navigatorWithStandalone.standalone === true
  )
}

function isMobileDevice() {
  return window.matchMedia('(pointer: coarse)').matches && window.innerWidth < 900
}

function isIosSafariLike() {
  return /iPad|iPhone|iPod/.test(window.navigator.userAgent)
}

export default function MobileInstallPrompt() {
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null)
  const [showIosPrompt, setShowIosPrompt] = useState(false)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (isAppDisplayMode() || !isMobileDevice() || isDismissedRecently()) {
      return
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as BeforeInstallPromptEvent)
      setIsVisible(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    const iosTimer = window.setTimeout(() => {
      if (isIosSafariLike() && !isAppDisplayMode() && !isDismissedRecently()) {
        setShowIosPrompt(true)
        setIsVisible(true)
      }
    }, 1400)

    return () => {
      window.clearTimeout(iosTimer)
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])

  async function handleInstall() {
    if (!installPrompt) {
      return
    }

    await installPrompt.prompt()
    const choice = await installPrompt.userChoice

    if (choice.outcome === 'accepted') {
      setIsVisible(false)
    }

    setInstallPrompt(null)
  }

  function handleDismiss() {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()))
    setIsVisible(false)
  }

  if (!isVisible || (!installPrompt && !showIosPrompt)) {
    return null
  }

  return (
    <div className="fixed inset-x-3 bottom-3 z-[80] mx-auto max-w-md pb-[env(safe-area-inset-bottom)] sm:hidden">
      <div className="v3-walnut-header rounded-2xl border p-3 text-white shadow-2xl shadow-black/45">
        <div className="flex items-center gap-3">
          <Image
            src="/icon-192.png"
            alt=""
            width={46}
            height={46}
            className="h-11 w-11 rounded-xl"
            priority
          />

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">Install Obsidian V3</p>
            <p className="mt-0.5 text-xs leading-4 text-white/70">
              {installPrompt
                ? 'Open from your home screen in app mode.'
                : 'Use Share, then Add to Home Screen.'}
            </p>
          </div>

          {installPrompt ? (
            <button
              type="button"
              onClick={handleInstall}
              className="tap-press tap-target rounded-xl border border-cyan-300/45 bg-cyan-300/15 px-3 text-xs font-bold text-cyan-50"
            >
              Install
            </button>
          ) : null}

          <button
            type="button"
            onClick={handleDismiss}
            className="tap-press tap-target rounded-xl border border-white/15 bg-white/5 px-3 text-xs font-bold text-white/72"
            aria-label="Dismiss install prompt"
          >
            Later
          </button>
        </div>
      </div>
    </div>
  )
}
