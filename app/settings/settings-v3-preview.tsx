'use client'

import Image from 'next/image'
import Link from '@/app/components/navigation-feedback/navigation-link'
import { useState, useTransition } from 'react'
import V3PerfIndicator from '../components/v3-perf-indicator'
import AvatarUploadInput from './avatar-upload-input'
import SettingsProfileEditor from './settings-profile-editor'
import SettingsPlanCard from './settings-plan-card'
import type { PlanSummary } from '../../lib/subscription/billing'
import { logout, updateAvatar, updateStartupPage } from './settings-actions'
import styles from '../settings-support-silver.module.css'
import type { StartupPage } from '../../lib/startup-page'

type SettingsV3User = {
  avatarUrl: string | null
  createdAt: string | null
  displayName: string
  email: string
  username: string | null
  startupPage: StartupPage
}

const startupPages: Array<{
  id: StartupPage
  label: string
  icon: string
}> = [
  { id: 'dashboard', label: 'Dashboard', icon: '/icons/nav/dashboard-active.svg' },
  { id: 'projects', label: 'Projects', icon: '/icons/nav/projects-active.svg' },
  { id: 'paints', label: 'Paints', icon: '/icons/nav/vault-active.svg' },
  { id: 'guides', label: 'Guides', icon: '/icons/nav/recipes-active.svg' },
  { id: 'community', label: 'Community', icon: '/icons/nav/community-active.svg' },
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

export default function SettingsV3Preview({
  plan,
  user,
}: {
  plan: PlanSummary | null
  user: SettingsV3User
}) {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [startupPage, setStartupPage] = useState<StartupPage>(user.startupPage)
  const [startupPageError, setStartupPageError] = useState<string | null>(null)
  const [isSavingStartupPage, startSavingStartupPage] = useTransition()

  function chooseStartupPage(nextPage: StartupPage) {
    if (nextPage === startupPage || isSavingStartupPage) return

    const previousPage = startupPage
    setStartupPage(nextPage)
    setStartupPageError(null)

    startSavingStartupPage(async () => {
      const result = await updateStartupPage(nextPage)

      if (result.error) {
        setStartupPage(previousPage)
        setStartupPageError(result.error)
      }
    })
  }

  return (
    <main className={styles.root}>
      <V3PerfIndicator surface="settings" detail="main" />
      <div className={styles.shell}>
        <TopNav avatarUrl={user.avatarUrl} displayName={user.displayName} />

        <AccountCard user={user} />

        {plan ? <SettingsPlanCard plan={plan} /> : null}

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
                  onClick={() => chooseStartupPage(page.id)}
                  aria-pressed={startupPage === page.id}
                  disabled={isSavingStartupPage}
                  className={[
                    styles.toggleItem,
                    startupPage === page.id
                      ? styles.toggleItemActive
                      : '',
                  ].join(' ')}
                >
                  <NavMiniIcon icon={page.icon} />
                  <span className="block w-full truncate text-center">
                    {page.label}
                  </span>
                </button>
              ))}
            </div>
            <p className={styles.startupStatus} role="status" aria-live="polite">
              {startupPageError
                ? startupPageError
                : isSavingStartupPage
                  ? 'Saving startup page…'
                  : `${startupPages.find((page) => page.id === startupPage)?.label} will open first.`}
            </p>
          </div>

          <div className={styles.previewRows}>
            {settingsRows.map((row) => (
              <SettingsLinkRow key={row.title} row={row} />
            ))}
          </div>
        </section>

        <form action={logout} className="grid">
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

function TopNav({
  avatarUrl,
  displayName,
}: {
  avatarUrl: string | null
  displayName: string
}) {
  return (
    <header className={styles.previewTop}>
      <Link
        href="/dashboard?preview=1"
        aria-label="Back to dashboard"
        className={styles.roundControl}
      >
        <span className="grid gap-1">
          <span className="h-0.5 w-4 rounded-full bg-current" />
          <span className="h-0.5 w-4 rounded-full bg-current" />
          <span className="h-0.5 w-4 rounded-full bg-current" />
        </span>
      </Link>

      <h1 className={styles.previewTitle}>Settings</h1>

      <div className={styles.avatarControl}>
        <Image
          src={avatarUrl || '/curator/the-curator.png'}
          alt={avatarUrl ? displayName : ''}
          fill
          sizes="36px"
          className="object-cover"
          priority
        />
      </div>
    </header>
  )
}

function formatMemberSince(value: string | null) {
  if (!value) {
    return 'Member'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Member'
  }

  return `Member since ${new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
  }).format(date)}`
}

function AccountCard({ user }: { user: SettingsV3User }) {
  return (
    <section className={`${styles.panel} ${styles.previewPanel}`}>
      <div className={styles.panelHeader}>
        <h2 className={styles.panelLabel}>
          Account
        </h2>
      </div>
      <div className={styles.previewSectionBody}>
        <div className={styles.previewAccountGrid}>
          <form action={updateAvatar}>
            <div className={styles.previewAvatar}>
              <Image
                src={user.avatarUrl || '/curator/the-curator.png'}
                alt={user.avatarUrl ? user.displayName : ''}
                fill
                sizes="96px"
                className="object-cover"
              />
              <label
                aria-label="Edit avatar"
                className={styles.avatarEditControl}
              >
                <SvgIcon name="edit" />
                <AvatarUploadInput />
              </label>
            </div>
          </form>

          <div className="min-w-0 self-center">
            <h3 className={`${styles.previewName} truncate`}>
              {user.displayName}
            </h3>
            <p className={`${styles.muted} truncate`}>
              {user.email || 'No email on file'}
            </p>
            {user.username ? (
              <p className={`${styles.muted} truncate`}>@{user.username}</p>
            ) : null}
            <div className={styles.memberMeta}>
              <SvgIcon name="calendar" />
              <span>{formatMemberSince(user.createdAt)}</span>
            </div>
          </div>
        </div>

        <SettingsProfileEditor
          buttonClassName={styles.walnutButton}
          email={user.email}
          username={user.username || 'No username yet'}
        />
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
    <Link
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
    </Link>
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

function NavMiniIcon({ icon }: { icon: string }) {
  return (
    <span
      className={styles.startupNavIcon}
      style={{ '--startup-nav-icon': `url(${icon})` } as React.CSSProperties}
      aria-hidden="true"
    />
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
