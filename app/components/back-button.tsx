'use client'

import { useRouter } from 'next/navigation'

type BackButtonProps = {
  fallbackHref: string
  className?: string
}

export default function BackButton({
  fallbackHref,
  className,
}: BackButtonProps) {
  const router = useRouter()

  function handleBack() {
    if (window.history.length > 1) {
      router.back()
      return
    }

    router.push(fallbackHref)
  }

  return (
    <button
      type="button"
      onClick={handleBack}
      className={[
        'inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-2 text-sm font-medium lowercase text-white backdrop-blur transition hover:bg-black/60',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      back
    </button>
  )
}
