import Link from 'next/link'

export default function SupportButton({ className }: { className?: string }) {
  const hasCustomClass = Boolean(className)

  return (
    <Link
      href="/support"
      className={
        className ??
        'flex h-11 items-center justify-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 text-xs font-semibold text-cyan-100 shadow-lg shadow-cyan-950/30 transition hover:border-cyan-300/60 hover:bg-cyan-400/20 active:scale-95'
      }
    >
      {hasCustomClass ? null : (
        <span aria-hidden="true" className="text-sm leading-none">
          &#9829;
        </span>
      )}
      <span>Support</span>
    </Link>
  )
}
