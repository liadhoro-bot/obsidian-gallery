'use client'

import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { logCuratorMessageEvent } from '../../curator/actions'
import type {
  CuratorMessageEventType,
  DashboardCuratorPrompt,
} from '../../../utils/curator/types'

type CuratorMessage = {
  key: string
  ruleKey?: string
  surface?: string
  category?: string
  variant?: string
  title: string
  bodyLines: string[]
  question?: string | null
  primaryCtaLabel?: string | null
  primaryCtaHref?: string | null
  secondaryCtaLabel?: string | null
  imageUrl?: string | null
}

type CuratorSurface =
  | 'dashboard'
  | 'unit'
  | 'project'
  | 'vault'
  | 'recipes'
  | 'themes'

type CuratorButtonProps = {
  curatorPrompt?: DashboardCuratorPrompt | null
  hideOnDashboard?: boolean
}

function mapPromptToMessage(curatorPrompt: DashboardCuratorPrompt): CuratorMessage {
  return {
    key: curatorPrompt.templateId,
    ruleKey: curatorPrompt.ruleKey,
    surface: 'dashboard',
    category: curatorPrompt.category,
    variant: 'phase_2',
    title: curatorPrompt.title,
    bodyLines: curatorPrompt.bodyLines ?? [],
    question: curatorPrompt.question,
    primaryCtaLabel: curatorPrompt.ctaLabel,
    primaryCtaHref: curatorPrompt.ctaHref,
    secondaryCtaLabel: curatorPrompt.secondaryCtaLabel,
    imageUrl: '/curator/the-curator.png',
  }
}

export default function CuratorButton({
  curatorPrompt,
  hideOnDashboard = false,
}: CuratorButtonProps) {
  const pathname = usePathname()
  const router = useRouter()
  const shownLoggedRef = useRef(false)
  const dismissedLoggedRef = useRef(false)
  const ctaClickedRef = useRef(false)
  const activePromptKeyRef = useRef<string | null>(null)

  const derivedContext = useMemo<{
    surface: CuratorSurface
    entityId: string | null
  }>(() => {
    if (pathname?.startsWith('/units/')) {
      return { surface: 'unit', entityId: pathname.split('/')[2] ?? null }
    }

    if (pathname === '/projects' || pathname?.startsWith('/projects/')) {
      return { surface: 'project', entityId: pathname.split('/')[2] ?? null }
    }

    if (pathname?.startsWith('/vault')) return { surface: 'vault', entityId: null }
    if (pathname?.startsWith('/recipes')) return { surface: 'recipes', entityId: null }
    if (pathname?.startsWith('/themes')) return { surface: 'themes', entityId: null }

    return { surface: 'dashboard', entityId: null }
  }, [pathname])

  const [isOpen, setIsOpen] = useState(false)
  const [message, setMessage] = useState<CuratorMessage | null>(
    curatorPrompt ? mapPromptToMessage(curatorPrompt) : null,
  )
  const [isLoading, setIsLoading] = useState(false)
  const promptEventInput = useMemo(
    () =>
      curatorPrompt
        ? {
            ruleKey: curatorPrompt.ruleKey,
            category: curatorPrompt.category,
            templateId: curatorPrompt.templateId,
            messageKey: curatorPrompt.templateKey,
            surface: 'dashboard',
          }
        : null,
    [curatorPrompt],
  )

  async function logPromptEvent(
    eventType: CuratorMessageEventType,
    metadata?: Record<string, unknown>,
  ) {
    if (!promptEventInput) return

    const result = await logCuratorMessageEvent({
      ...promptEventInput,
      eventType,
      metadata,
    })

    if (!result.ok) {
      console.error('Curator event logging failed:', result)
    }
  }

  async function loadCuratorMessage(options?: { auto?: boolean }) {
    if (curatorPrompt) {
      setMessage(mapPromptToMessage(curatorPrompt))
      if (options?.auto && curatorPrompt.autoOpen) {
        setIsOpen(true)
      }
      return
    }

    setIsLoading(true)

    try {
      const params = new URLSearchParams()
      params.set('surface', derivedContext.surface)

      if (derivedContext.entityId) {
        params.set('entityId', derivedContext.entityId)
      }

      if (options?.auto) {
        params.set('auto', 'true')
      }

      const response = await fetch(`/api/curator/message?${params.toString()}`)
      const data = await response.json()

      setMessage(data.message)

      if (data.shouldOpen) {
        setIsOpen(true)
      }
    } catch (error) {
      console.error('Failed to load Curator message:', error)
      setMessage(null)
    } finally {
      setIsLoading(false)
    }
  }

  async function openCurator() {
    setIsOpen(true)

    if (!curatorPrompt) {
      await loadCuratorMessage()
    }
  }

  async function closeCurator(options: { logDismissed?: boolean } = { logDismissed: true }) {
    setIsOpen(false)

    if (
      options.logDismissed &&
      promptEventInput &&
      !ctaClickedRef.current &&
      !dismissedLoggedRef.current
    ) {
      dismissedLoggedRef.current = true
      await logPromptEvent('dismissed')
    }
  }

  async function handleCtaClick() {
    const ctaHref = curatorPrompt?.ctaHref ?? message?.primaryCtaHref

    ctaClickedRef.current = true

    await logPromptEvent('cta_clicked', {
      ctaHref,
      ctaLabel: curatorPrompt?.ctaLabel,
    })

    setIsOpen(false)

    if (ctaHref) {
      router.push(ctaHref)
    }
  }

  useEffect(() => {
    if (hideOnDashboard && derivedContext.surface === 'dashboard') return

    const promptKey = curatorPrompt
      ? `${curatorPrompt.ruleKey}:${curatorPrompt.templateId}`
      : null

    if (activePromptKeyRef.current !== promptKey) {
      activePromptKeyRef.current = promptKey
      shownLoggedRef.current = false
      dismissedLoggedRef.current = false
      ctaClickedRef.current = false
    }

    if (curatorPrompt) {
      setMessage(mapPromptToMessage(curatorPrompt))
      if (curatorPrompt.autoOpen && !shownLoggedRef.current) {
        shownLoggedRef.current = true
        setIsOpen(true)
        void logPromptEvent('shown', {
          autoOpen: true,
          ctaHref: curatorPrompt.ctaHref,
        })
      } else {
        setIsOpen((currentIsOpen) => currentIsOpen && curatorPrompt.autoOpen)
      }
      return
    }

    loadCuratorMessage({ auto: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    curatorPrompt?.ruleKey,
    curatorPrompt?.templateId,
    curatorPrompt?.autoOpen,
    hideOnDashboard,
    derivedContext.surface,
    derivedContext.entityId,
  ])

  if (hideOnDashboard && derivedContext.surface === 'dashboard') {
    return null
  }

  const bodyText =
    message?.bodyLines?.length && !isLoading
      ? message.bodyLines.join(' ')
      : isLoading
        ? 'Consulting the archive...'
        : 'The archive is silent. Suspicious.'

  const curatorImageUrl = message?.imageUrl || '/curator/the-curator.png'

  return (
    <>
      <button
        type="button"
        onClick={openCurator}
        className="fixed bottom-24 left-1/2 z-40 ml-[8.5rem] flex h-16 w-16 items-center justify-center rounded-full border border-cyan-300/40 bg-[#07131a]/90 shadow-[0_0_28px_rgba(34,211,238,0.35)] backdrop-blur transition active:scale-95"
        aria-label="Open The Curator"
      >
        <Image
          src="/curator/curator-bubble.png"
          alt=""
          width={64}
          height={64}
          className="h-14 w-14 object-contain"
        />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-40 bg-black/75 backdrop-blur-sm">
          <button
            type="button"
            aria-label="Close The Curator"
            onClick={() => {
              void closeCurator()
            }}
            className="absolute inset-0"
          />

          <div className="pointer-events-none fixed inset-x-0 top-14 bottom-16 z-50 mx-auto flex max-w-md flex-col items-center justify-start px-0 overflow-visible">
            <div className="pointer-events-auto relative z-30 mx-3 w-[calc(100%-1.5rem)] rounded-[28px] border border-cyan-300/30 bg-[#02070b]/90 px-5 pb-6 pt-9 text-center text-white shadow-[0_0_55px_rgba(34,211,238,0.24)] backdrop-blur-md">
              <div className="absolute -top-7 left-1/2 flex h-14 w-14 -translate-x-1/2 items-center justify-center rounded-full border border-cyan-300/40 bg-[#02070b] shadow-[0_0_24px_rgba(34,211,238,0.45)]">
                <Image
                  src="/curator/curator-bubble.png"
                  alt=""
                  width={48}
                  height={48}
                  className="h-12 w-12 object-contain"
                />
              </div>

              <div className="mb-4 mt-1 text-sm font-semibold uppercase tracking-[0.45em] text-cyan-300">
                {message?.title ?? 'The Curator'}
              </div>

              <div className="mx-auto mb-4 h-px w-4/5 bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent shadow-[0_0_12px_rgba(34,211,238,0.35)]" />

              <p className="mx-auto max-w-[19rem] text-balance text-base leading-relaxed text-slate-300">
                {bodyText}
              </p>

              <div className="mx-auto my-4 h-px w-5/6 bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent shadow-[0_0_12px_rgba(34,211,238,0.35)]" />

              <p className="mb-4 text-sm font-medium text-cyan-300">
                {message?.question ?? 'Shall we refine your approach?'}
              </p>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    void closeCurator()
                  }}
                  className="rounded-xl border border-white/15 bg-white/[0.02] px-3 py-3 text-sm font-semibold text-slate-400"
                >
                  {message?.secondaryCtaLabel ?? 'Not Now'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    void handleCtaClick()
                  }}
                  className="rounded-xl border border-cyan-300/70 bg-cyan-400/10 px-3 py-3 text-sm font-semibold text-cyan-200 shadow-[0_0_20px_rgba(34,211,238,0.25)]"
                >
                  {message?.primaryCtaLabel ?? 'Show Me Insights'}
                </button>
              </div>
            </div>

            <div className="relative -mt-px min-h-0 flex-1 w-full overflow-hidden">
              <Image
                src={curatorImageUrl}
                alt="The Curator"
                width={640}
                height={640}
                priority
                className="block h-full w-full object-cover object-top"
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
