'use client'

import Image from 'next/image'
import { useState } from 'react'
import V3PerfIndicator from '../components/v3-perf-indicator'
import styles from '../settings-support-silver.module.css'

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
    <main className={styles.root}>
      <V3PerfIndicator surface="settings" detail="main" />
      <div className={styles.shell}>
        <TopNav />

        <AccountCard />

        <section className={`${styles.panel} ${styles.previewPanel}`}>
          <div className={styles.panelHeader}>
            <h2 className={styles.panelLabel}>
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

          <div className={styles.preferenceBlock}>
            <div className={styles.preferenceIntro}>
              <IconBadge name="home" />
              <div>
                <h3 className={styles.linkTitle}>Startup Page</h3>
                <p className={styles.linkDescription}>
                  Choose the page the app opens first.
                </p>
              </div>
            </div>

            <div className={styles.toggleGrid}>
              {startupPages.map((page) => (
                <button
                  key={page.id}
                  type="button"
                  onClick={() => setStartupPage(page.id)}
                  aria-pressed={startupPage === page.id}
                  className={[
                    styles.toggleItem,
                    startupPage === page.id
                      ? styles.toggleItemActive
                      : '',
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

          <div className={styles.previewRows}>
            {settingsRows.map((row) => (
              <SettingsLinkRow key={row.title} row={row} />
            ))}
          </div>
        </section>

        <form action="/login" className="grid">
          <button
            type="submit"
            className={styles.dangerButton}
          >
            Sign Out
          </button>
        </form>

        <footer className={styles.footer}>
          <p>App Version 3.0 preview</p>
          <p>2026 Obsidian Gallery. All rights reserved.</p>
        </footer>
      </div>
    </main>
  )
}

function TopNav() {
  return (
    <header className={styles.previewTop}>
      <a
        href="/dashboard?preview=1"
        aria-label="Back to dashboard"
        className={styles.roundControl}
      >
        <span className="grid gap-1">
          <span className="h-0.5 w-4 rounded-full bg-current" />
          <span className="h-0.5 w-4 rounded-full bg-current" />
          <span className="h-0.5 w-4 rounded-full bg-current" />
        </span>
      </a>

      <h1 className={styles.previewTitle}>Settings</h1>

      <div className={styles.avatarControl}>
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
    <section className={`${styles.panel} ${styles.previewPanel}`}>
      <div className={styles.panelHeader}>
        <h2 className={styles.panelLabel}>
          Account
        </h2>
      </div>
      <div className={styles.previewSectionBody}>
        <div className={styles.previewAccountGrid}>
          <div className={styles.previewAvatar}>
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
              className={styles.avatarEditControl}
            >
              <SvgIcon name="edit" />
            </button>
          </div>

          <div className="min-w-0 self-center">
            <h3 className={`${styles.previewName} truncate`}>Alex Mortimer</h3>
            <p className={`${styles.muted} truncate`}>
              alex.mortimer@example.com
            </p>
            <div className={styles.memberMeta}>
              <SvgIcon name="calendar" />
              <span>Member since March 2024</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          className={styles.walnutButton}
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
    <div className={styles.preferenceRow}>
      <IconBadge name={icon} />
      <div>
        <h3 className={styles.linkTitle}>{title}</h3>
        <p className={styles.linkDescription}>
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
      className={styles.previewLinkRow}
    >
      <IconBadge name={row.icon} />
      <span className={styles.linkText}>
        <span className={`${styles.linkTitle} truncate`}>{row.title}</span>
        <span className={styles.linkDescription}>
          {row.description}
        </span>
      </span>
      <span className={styles.chevron}>&gt;</span>
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
        styles.switch,
        enabled ? styles.switchOn : '',
      ].join(' ')}
    >
      <span
        className={styles.switchThumb}
      >
        {enabled ? 'ON' : 'OFF'}
      </span>
    </button>
  )
}

function IconBadge({ name }: { name: string }) {
  return (
    <span className={styles.iconBadge}>
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
