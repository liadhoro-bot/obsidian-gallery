'use client'

type BackButtonProps = {
  fallbackHref: string
  className?: string
}

export default function BackButton({
  fallbackHref,
  className,
}: BackButtonProps) {
  function handleBack() {
    if (window.history.length > 1) {
      window.history.back()
      return
    }

    window.location.assign(fallbackHref)
  }

  return (
    <button
      type="button"
      onClick={handleBack}
      className={[
        'tap-press tap-target inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-2 text-sm font-medium lowercase text-white backdrop-blur hover:bg-black/60',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      back
    </button>
  )
}
