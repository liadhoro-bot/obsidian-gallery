import Link from 'next/link'

export default function SupportButton() {
  return (
    <Link
      href="/support"
      className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1.5 text-xs font-semibold text-cyan-200 shadow-sm transition hover:bg-cyan-400/20"
    >
      ❤️ Support Us
    </Link>
  )
}