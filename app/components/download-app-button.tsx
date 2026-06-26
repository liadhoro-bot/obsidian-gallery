'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function DownloadAppButton() {
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as BeforeInstallPromptEvent)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])

  async function handleInstall() {
    if (!installPrompt) return

    await installPrompt.prompt()
    await installPrompt.userChoice

    setInstallPrompt(null)
  }

  return (
    <button
      type="button"
      onClick={handleInstall}
      disabled={!installPrompt}
      className={`tap-press tap-target flex h-11 min-w-[118px] items-center justify-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 text-xs font-semibold text-cyan-100 shadow-lg shadow-cyan-950/30 hover:border-cyan-300/60 hover:bg-cyan-400/20 ${
        installPrompt
          ? ''
          : 'pointer-events-none invisible'
      }`}
      aria-label="Download app"
      aria-hidden={!installPrompt}
    >
      <Image
        src="/icon-192.png"
        alt=""
        width={22}
        height={22}
        className="rounded-md"
      />

      <span className="hidden sm:inline">Download</span>
    </button>
  )
}
