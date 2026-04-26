'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { name: 'Dashboard', href: '/dashboard', icon: '/icons/nav/dashboard.svg' },
  { name: 'Projects', href: '/projects', icon: '/icons/nav/projects.svg' },
  { name: 'Vault', href: '/vault', icon: '/icons/nav/vault.svg' },
  { name: 'Recipes', href: '/recipes', icon: '/icons/nav/recipes.svg' },
]

export default function MobileNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-[#061018]/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-md items-center justify-around px-3">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-1 ${
                isActive ? 'text-cyan-400' : 'text-slate-500'
              }`}
            >
              <span
                className="h-7 w-7 bg-current"
                style={{
                  maskImage: `url(${item.icon})`,
                  WebkitMaskImage: `url(${item.icon})`,
                  maskRepeat: 'no-repeat',
                  WebkitMaskRepeat: 'no-repeat',
                  maskPosition: 'center',
                  WebkitMaskPosition: 'center',
                  maskSize: 'contain',
                  WebkitMaskSize: 'contain',
                }}
              />

              <span className="text-[10px] font-bold uppercase tracking-[0.16em]">
                {item.name}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
} 