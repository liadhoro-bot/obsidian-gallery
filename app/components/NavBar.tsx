export default function NavBar() {
  return (
    <nav className="mb-6 flex flex-wrap gap-3 border-b border-neutral-800 pb-4">
      <a
        href="/"
        className="rounded bg-neutral-800 px-3 py-2 text-sm text-white hover:bg-neutral-700"
      >
        Projects
      </a>

      <a
        href="/recipes"
        className="rounded bg-neutral-800 px-3 py-2 text-sm text-white hover:bg-neutral-700"
      >
        Recipes
      </a>

      <a
        href="/vault"
        className="rounded bg-neutral-800 px-3 py-2 text-sm text-white hover:bg-neutral-700"
      >
        Paint Vault
      </a>

      <a
        href="/dashboard"
        className="rounded bg-cyan-500 px-3 py-2 text-sm font-medium text-black hover:bg-cyan-400"
      >
        Dashboard
      </a>
    </nav>
  )
}