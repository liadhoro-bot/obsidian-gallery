'use client'

import { useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'

export default function PendingNavButton({
  href,
  children,
  pendingLabel = 'Loading...',
  className = '',
}: {
  href: string
  children: React.ReactNode
  pendingLabel?: string
  className?: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    router.prefetch(href)
  }, [href, router])

  return (
    <button
      type="button"
      disabled={isPending}
      aria-busy={isPending || undefined}
      onClick={() => {
        startTransition(() => {
          router.push(href)
        })
      }}
      className={`${className} disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/10 disabled:text-white/45 disabled:shadow-none`}
    >
      {isPending ? (
        <span className="inline-flex items-center justify-center gap-2">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          <span>{pendingLabel}</span>
        </span>
      ) : (
        children
      )}
    </button>
  )
}
