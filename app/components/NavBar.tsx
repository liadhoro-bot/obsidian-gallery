import Link from 'next/link'

export default function NavBar() {
  return (
    <nav className="mb-6 flex flex-wrap gap-3 border-b border-neutral-800 pb-4">
      <Link
        href="/dashboard"
        className="rounded bg-neutral-800 px-3 py-2 text-sm text-white hover:bg-neutral-700"
      >
        Dashboard
      </Link>

      <Link
        href="/projects"
        className="rounded bg-neutral-800 px-3 py-2 text-sm text-white hover:bg-neutral-700"
      >
        Projects
      </Link>

      <Link
        href="/vault"
        className="rounded bg-neutral-800 px-3 py-2 text-sm text-white hover:bg-neutral-700"
      >
        Paints
      </Link>

      <Link
        href="/recipes"
        className="rounded bg-neutral-800 px-3 py-2 text-sm text-white hover:bg-neutral-700"
      >
        Guides
      </Link>

      <Link
        href="/themes"
        className="rounded bg-neutral-800 px-3 py-2 text-sm text-white hover:bg-neutral-700"
      >
        Themes
      </Link>

      <Link
        href="/settings"
        className="rounded bg-cyan-500 px-3 py-2 text-sm font-medium text-black hover:bg-cyan-400"
      >
        Settings
      </Link>
    </nav>
  )
}
