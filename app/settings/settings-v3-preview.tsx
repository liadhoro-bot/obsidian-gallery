'use client'

import Image from 'next/image'
import { useState } from 'react'
import V3PerfIndicator from '../components/v3-perf-indicator'

type StartupPage = 'dashboard' | 'guides' | 'projects' | 'paints' | 'community'

const startupPages: Array<{
  id: StartupPage
  label: string
  href: string
  icon: string
}> = [
  { id: 'dashboard', label: 'Dashboard', href: '/dashboard?preview=1', icon: 'grid' },
  { id: 'projects', label: 'Projects', href: '/projects?preview=1', icon: 'tool' },
  { id: 'paints', label: 'Paints', href: '/paints?preview=1', icon: 'paint' },
  { id: 'guides', label: 'Guides', href: '/guides?preview=1', icon: 'book' },
  { id: 'community', label: 'Community', href: '/community?preview=1', icon: 'group' },
]

const settingsRows = [
  {
    title: 'Privacy Settings',
    description: 'Manage your data and visible information.',
    href: '/settings/privacy?preview=1',
    icon: 'shield',
  },
  {
    title: 'Terms and Conditions',
    description: 'View the terms and conditions of use.',
    href: '/settings/terms',
    icon: 'scroll',
  },
  {
    title: 'Privacy Policy',
    description: 'Learn how we collect and use your data.',
    href: '/privacy',
    icon: 'lock',
  },
  {
    title: 'Contact Us',
    description: 'Get in touch with our support team.',
    href: '/support',
    icon: 'mail',
  },
]

export default function SettingsV3Preview() {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [startupPage, setStartupPage] = useState<StartupPage>('guides')

  return (
    <main className="min-h-screen bg-[#05090b] text-white">
      <V3PerfIndicator surface="settings" detail="main" />
      <div className="mx-auto flex w-full max-w-md flex-col gap-3 px-3 pb-28 pt-6">
        <TopNav />

        <header>
          <h1 className="text-[28px] font-black leading-none tracking-normal">
            Settings
          </h1>
        </header>

        <AccountCard />

        <section className="overflow-hidden rounded-[8px] border border-white/[0.06] bg-[#111821]">
          <div className="border-b border-white/[0.06] px-4 py-3">
            <h2 className="text-[10px] font-black uppercase tracking-[0.22em] text-white/28">
              Preferences
            </h2>
          </div>

          <PreferenceRow
            icon="bell"
            title="Notifications"
            description="Receive updates about guides, projects, and community activity."
            action={
              <Toggle
                enabled={notificationsEnabled}
                onChange={() => setNotificationsEnabled((enabled) => !enabled)}
              />
            }
          />

          <div className="border-t border-white/[0.06] px-4 py-4">
            <div className="grid grid-cols-[48px_1fr] gap-3">
              <IconBadge name="home" />
              <div className="min-w-0">
                <h3 className="text-sm font-black">Startup Page</h3>
                <p className="mt-1 truncate text-xs font-semibold text-white/44">
                  Choose the page the app opens first.
                </p>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-5 overflow-hidden rounded-[8px] border border-white/10 bg-black/20">
              {startupPages.map((page) => (
                <button
                  key={page.id}
                  type="button"
                  onClick={() => setStartupPage(page.id)}
                  aria-pressed={startupPage === page.id}
                  className={[
                    'grid h-[58px] min-w-0 grid-rows-[22px_1fr] place-items-center gap-1 border-l border-white/10 px-1 py-2 text-[9px] font-black leading-none text-white/36 first:border-l-0',
                    startupPage === page.id
                      ? 'bg-cyan-300 text-black'
                      : 'hover:bg-white/[0.05] hover:text-white/64',
                  ].join(' ')}
                >
                  <NavMiniIcon name={page.icon} />
                  <span className="block w-full truncate text-center">
                    {page.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-white/[0.06] border-t border-white/[0.06]">
            {settingsRows.map((row) => (
              <SettingsLinkRow key={row.title} row={row} />
            ))}
          </div>
        </section>

        <form action="/login" className="grid">
          <button
            type="submit"
            className="h-12 rounded-[8px] border border-red-400/24 bg-red-500/14 text-sm font-black text-red-200 transition hover:bg-red-500/20"
          >
            Sign Out
          </button>
        </form>

        <footer className="pb-2 text-center text-xs font-semibold leading-5 text-white/30">
          <p>App Version 3.0 preview</p>
          <p>2026 Obsidian Gallery. All rights reserved.</p>
        </footer>
      </div>
    </main>
  )
}

function TopNav() {
  return (
    <header className="flex items-center justify-between gap-4">
      <a
        href="/dashboard?preview=1"
        aria-label="Back to dashboard"
        className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/[0.055] text-white/52"
      >
        <span className="grid gap-1">
          <span className="h-0.5 w-4 rounded-full bg-current" />
          <span className="h-0.5 w-4 rounded-full bg-current" />
          <span className="h-0.5 w-4 rounded-full bg-current" />
        </span>
      </a>

      <div className="min-w-0 text-center">
        <p className="text-[8px] font-black uppercase tracking-[0.28em] text-cyan-300">
          Obsidian Gallery
        </p>
        <p className="mt-1 text-xs font-black uppercase tracking-[0.22em] text-white/30">
          Settings
        </p>
      </div>

      <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full border border-cyan-300/24 bg-white/10">
        <Image
          src="/curator/the-curator.png"
          alt=""
          fill
          sizes="36px"
          className="object-cover"
          priority
        />
      </div>
    </header>
  )
}

function AccountCard() {
  return (
    <section className="overflow-hidden rounded-[8px] border border-white/[0.06] bg-[#111821]">
      <div className="border-b border-white/[0.06] px-4 py-3">
        <h2 className="text-[10px] font-black uppercase tracking-[0.22em] text-white/28">
          Account
        </h2>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-[94px_1fr] gap-4">
          <div className="relative h-24 w-24 overflow-hidden rounded-full border border-cyan-300/20 bg-black">
            <Image
              src="/curator/the-curator.png"
              alt=""
              fill
              sizes="96px"
              className="object-cover"
            />
            <button
              type="button"
              aria-label="Edit avatar"
              className="absolute bottom-1 right-1 grid h-8 w-8 place-items-center rounded-full border border-cyan-300/24 bg-[#10161d] text-cyan-300"
            >
              <SvgIcon name="edit" />
            </button>
          </div>

          <div className="min-w-0 self-center">
            <h3 className="truncate text-xl font-black">Alex Mortimer</h3>
            <p className="mt-1 truncate text-sm font-semibold text-white/48">
              alex.mortimer@example.com
            </p>
            <div className="mt-4 flex items-center gap-2 border-t border-white/10 pt-3 text-xs font-semibold text-white/44">
              <SvgIcon name="calendar" />
              <span>Member since March 2024</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          className="mt-4 h-12 w-full rounded-[8px] bg-cyan-300 text-sm font-black text-black transition hover:bg-cyan-200"
        >
          Edit Profile
        </button>
      </div>
    </section>
  )
}

function PreferenceRow({
  action,
  description,
  icon,
  title,
}: {
  action: React.ReactNode
  description: string
  icon: string
  title: string
}) {
  return (
    <div className="grid grid-cols-[48px_1fr_auto] items-center gap-3 px-4 py-4">
      <IconBadge name={icon} />
      <div className="min-w-0">
        <h3 className="text-sm font-black">{title}</h3>
        <p className="mt-1 text-xs font-semibold leading-5 text-white/44">
          {description}
        </p>
      </div>
      {action}
    </div>
  )
}

function SettingsLinkRow({
  row,
}: {
  row: {
    title: string
    description: string
    href: string
    icon: string
  }
}) {
  return (
    <a
      href={row.href}
      className="grid grid-cols-[48px_1fr_auto] items-center gap-3 px-4 py-4 transition hover:bg-white/[0.035]"
    >
      <IconBadge name={row.icon} />
      <span className="min-w-0">
        <span className="block truncate text-sm font-black">{row.title}</span>
        <span className="mt-1 block truncate text-xs font-semibold text-white/44">
          {row.description}
        </span>
      </span>
      <span className="text-lg font-black text-white/28">&gt;</span>
    </a>
  )
}

function Toggle({
  enabled,
  onChange,
}: {
  enabled: boolean
  onChange: () => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={onChange}
      className={[
        'relative h-9 w-16 rounded-full border transition',
        enabled
          ? 'border-cyan-300/35 bg-cyan-300/22'
          : 'border-white/10 bg-white/[0.06]',
      ].join(' ')}
    >
      <span
        className={[
          'absolute top-1 grid h-7 w-7 place-items-center rounded-full bg-white text-[9px] font-black text-black transition',
          enabled ? 'left-8' : 'left-1',
        ].join(' ')}
      >
        {enabled ? 'ON' : 'OFF'}
      </span>
    </button>
  )
}

function IconBadge({ name }: { name: string }) {
  return (
    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-cyan-300/18 bg-cyan-300/8 text-cyan-300">
      <SvgIcon name={name} />
    </span>
  )
}

function NavMiniIcon({ name }: { name: string }) {
  return (
    <span className="grid h-5 w-5 place-items-center">
      <SvgIcon name={name} />
    </span>
  )
}

function SvgIcon({ name }: { name: string }) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth: 2,
  }

  if (name === 'bell') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" {...common}>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M13.7 21a2 2 0 0 1-3.4 0" />
      </svg>
    )
  }

  if (name === 'home') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" {...common}>
        <path d="m3 11 9-8 9 8" />
        <path d="M5 10v10h14V10" />
        <path d="M10 20v-6h4v6" />
      </svg>
    )
  }

  if (name === 'shield') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" {...common}>
        <path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6l-7-3Z" />
      </svg>
    )
  }

  if (name === 'scroll') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" {...common}>
        <path d="M8 4h10v14a2 2 0 0 1-2 2H6a2 2 0 0 0 2-2V4Z" />
        <path d="M6 20a2 2 0 0 1-2-2v-2h12" />
        <path d="M10 8h5M10 12h5" />
      </svg>
    )
  }

  if (name === 'lock') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" {...common}>
        <rect x="5" y="10" width="14" height="10" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </svg>
    )
  }

  if (name === 'mail') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" {...common}>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 7 9 6 9-6" />
      </svg>
    )
  }

  if (name === 'edit') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" {...common}>
        <path d="m4 20 4-1 11-11-3-3L5 16l-1 4Z" />
      </svg>
    )
  }

  if (name === 'calendar') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" {...common}>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M16 3v4M8 3v4M3 11h18" />
      </svg>
    )
  }

  if (name === 'grid') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" {...common}>
        <rect x="4" y="4" width="6" height="6" />
        <rect x="14" y="4" width="6" height="6" />
        <rect x="4" y="14" width="6" height="6" />
        <rect x="14" y="14" width="6" height="6" />
      </svg>
    )
  }

  if (name === 'book') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" {...common}>
        <path d="M4 5c3 0 5 .5 8 2v14c-3-1.5-5-2-8-2V5Z" />
        <path d="M20 5c-3 0-5 .5-8 2v14c3-1.5 5-2 8-2V5Z" />
      </svg>
    )
  }

  if (name === 'tool') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" {...common}>
        <path d="m14 7 3-3 3 3-3 3-3-3Z" />
        <path d="M4 20 15 9" />
        <path d="m5 7 4 4" />
      </svg>
    )
  }

  if (name === 'paint') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" {...common}>
        <path d="M12 3a9 9 0 0 0 0 18h1.5a2 2 0 0 0 1.4-3.4 1 1 0 0 1 .7-1.7H17a7 7 0 0 0 0-14h-5Z" />
        <circle cx="7.5" cy="10" r="1" />
        <circle cx="10.5" cy="7" r="1" />
        <circle cx="14" cy="7.5" r="1" />
      </svg>
    )
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" {...common}>
      <circle cx="8" cy="9" r="3" />
      <circle cx="16" cy="9" r="3" />
      <path d="M3 20c1-4 4-6 7-6s6 2 7 6" />
      <path d="M13 15c1-.7 2-1 3-1 3 0 5 2 5 6" />
    </svg>
  )
}
