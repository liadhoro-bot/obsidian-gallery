export default function MobileNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-neutral-800 bg-black/95 backdrop-blur">
      <div className="mx-auto grid max-w-3xl grid-cols-4">
        <a
          href="/dashboard"
          className="flex flex-col items-center justify-center gap-1 py-3 text-xs text-white"
        >
          <span>🏠</span>
          <span>Dashboard</span>
        </a>

        <a
          href="/"
          className="flex flex-col items-center justify-center gap-1 py-3 text-xs text-white"
        >
          <span>🪖</span>
          <span>Projects</span>
        </a>

        <a
          href="/vault"
          className="flex flex-col items-center justify-center gap-1 py-3 text-xs text-white"
        >
          <span>🎨</span>
          <span>Vault</span>
        </a>

        <a
          href="/recipes"
          className="flex flex-col items-center justify-center gap-1 py-3 text-xs text-white"
        >
          <span>📖</span>
          <span>Recipes</span>
        </a>
      </div>
    </nav>
  )
}