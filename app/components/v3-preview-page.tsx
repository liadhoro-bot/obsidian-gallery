import Link from 'next/link'

type PreviewLink = {
  href: string
  label: string
  text: string
}

type V3PreviewPageProps = {
  eyebrow: string
  title: string
  text: string
  active: 'dashboard' | 'projects' | 'paints' | 'guides' | 'themes'
  primary?: PreviewLink
  panels: PreviewLink[]
}

const navItems: Array<{
  id: V3PreviewPageProps['active']
  label: string
  href: string
}> = [
  { id: 'dashboard', label: 'Dashboard', href: '/dashboard?preview=1' },
  { id: 'projects', label: 'Projects', href: '/projects?preview=1' },
  { id: 'paints', label: 'Paints', href: '/paints?preview=1' },
  { id: 'guides', label: 'Guides', href: '/guides?preview=1' },
  { id: 'themes', label: 'Themes', href: '/themes?preview=1' },
]

export default function V3PreviewPage({
  active,
  eyebrow,
  panels,
  primary,
  text,
  title,
}: V3PreviewPageProps) {
  return (
    <main className="min-h-screen bg-[#081018] text-white">
      <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 pb-24 pt-5">
        <header className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300">
                Obsidian Gallery
              </p>
              <p className="mt-1 text-sm font-bold text-white/50">
                V3 mirror preview
              </p>
            </div>
            <span className="rounded-full bg-cyan-300 px-3 py-1 text-xs font-black text-black">
              Preview
            </span>
          </div>

          <nav className="mt-4 flex gap-2 overflow-x-auto pb-1" aria-label="V3 preview sections">
            {navItems.map((item) => {
              const isActive = active === item.id

              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={[
                    'shrink-0 rounded-full px-3 py-2 text-xs font-black transition',
                    isActive
                      ? 'bg-cyan-300 text-black'
                      : 'bg-white/[0.07] text-white/48 hover:bg-white/[0.12] hover:text-white/75',
                  ].join(' ')}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </header>

        <section className="space-y-3">
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300/75">
            {eyebrow}
          </p>
          <h1 className="text-3xl font-black leading-tight">{title}</h1>
          <p className="text-sm font-medium leading-6 text-white/58">{text}</p>
        </section>

        {primary ? (
          <Link
            href={primary.href}
            className="tap-press tap-target rounded-2xl bg-cyan-400 px-5 py-4 text-center text-sm font-black text-black shadow-[0_0_28px_rgba(34,211,238,0.24)] transition hover:bg-cyan-300"
          >
            {primary.label} -&gt;
          </Link>
        ) : null}

        <section className="grid gap-3">
          {panels.map((panel) => (
            <Link
              key={panel.href}
              href={panel.href}
              className="rounded-2xl border border-white/10 bg-white/[0.045] p-4 transition hover:border-cyan-300/35 hover:bg-cyan-300/[0.06]"
            >
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300/80">
                {panel.label}
              </p>
              <p className="mt-2 text-base font-bold leading-6 text-white">
                {panel.text}
              </p>
            </Link>
          ))}
        </section>

        <section className="rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.06] p-4">
          <p className="text-sm font-bold leading-6 text-cyan-50">
            This is a mirror scaffold for the v3 refactor. It preserves the new
            route names and UX flow while the live data pages are replaced one
            by one.
          </p>
        </section>
      </div>
    </main>
  )
}
