'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import type { ButtonHTMLAttributes } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import styles from './app-hamburger-menu.module.css'

type AppHamburgerMenuProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  buttonClassName?: string
}

export default function AppHamburgerMenu({
  buttonClassName,
  className,
  ...buttonProps
}: AppHamburgerMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const currentPage = useMemo(() => {
    const query = searchParams.toString()
    return `${pathname}${query ? `?${query}` : ''}`
  }, [pathname, searchParams])
  const settingsHref =
    searchParams.get('preview') === '1' ? '/settings?preview=1' : '/settings'
  const reportHref = `/report-bug?page=${encodeURIComponent(currentPage)}`

  useEffect(() => {
    if (!isOpen) return

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  return (
    <div className={[styles.menuRoot, className].filter(Boolean).join(' ')} ref={rootRef}>
      <button
        {...buttonProps}
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={buttonProps['aria-label'] ?? 'Open app menu'}
        className={[styles.menuButton, buttonClassName].filter(Boolean).join(' ')}
        onClick={(event) => {
          buttonProps.onClick?.(event)
          setIsOpen((open) => !open)
        }}
      >
        <MenuIcon />
      </button>

      {isOpen ? (
        <nav className={styles.menuPanel} role="menu" aria-label="App menu">
          <p className={styles.menuLabel}>Obsidian Gallery</p>
          <Link href={settingsHref} className={styles.menuItem} role="menuitem">
            <SettingsIcon />
            <span>Settings</span>
          </Link>
          <Link href="/support" className={styles.menuItem} role="menuitem">
            <HeartIcon />
            <span>Support us</span>
          </Link>
          <Link href={reportHref} className={styles.menuItem} role="menuitem">
            <BugIcon />
            <span>Report a bug</span>
          </Link>
        </nav>
      ) : null}
    </div>
  )
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z" stroke="currentColor" strokeWidth="1.8" />
      <path d="M19.2 13.1a1.4 1.4 0 0 0 .28 1.54l.05.05a1.6 1.6 0 1 1-2.26 2.26l-.05-.05a1.4 1.4 0 0 0-1.54-.28 1.4 1.4 0 0 0-.86 1.29V18a1.6 1.6 0 0 1-3.2 0v-.08a1.4 1.4 0 0 0-.86-1.29 1.4 1.4 0 0 0-1.54.28l-.05.05a1.6 1.6 0 1 1-2.26-2.26l.05-.05a1.4 1.4 0 0 0 .28-1.54 1.4 1.4 0 0 0-1.29-.86H5.9a1.6 1.6 0 0 1 0-3.2h.08a1.4 1.4 0 0 0 1.29-.86 1.4 1.4 0 0 0-.28-1.54l-.05-.05a1.6 1.6 0 1 1 2.26-2.26l.05.05a1.4 1.4 0 0 0 1.54.28 1.4 1.4 0 0 0 .86-1.29V3.3a1.6 1.6 0 0 1 3.2 0v.08a1.4 1.4 0 0 0 .86 1.29 1.4 1.4 0 0 0 1.54-.28l.05-.05a1.6 1.6 0 1 1 2.26 2.26l-.05.05a1.4 1.4 0 0 0-.28 1.54 1.4 1.4 0 0 0 1.29.86h.08a1.6 1.6 0 0 1 0 3.2h-.08a1.4 1.4 0 0 0-1.29.86Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.5" />
    </svg>
  )
}

function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 20s-7-4.35-9.1-8.55C1.4 8.45 3.3 5 6.65 5c1.82 0 3.14 1 3.98 2.15C11.47 6 12.78 5 14.6 5c3.35 0 5.25 3.45 3.75 6.45C16 15.65 12 20 12 20Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.7" />
    </svg>
  )
}

function BugIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M8 8.4A4 4 0 0 1 12 5a4 4 0 0 1 4 3.4v5.2A4 4 0 0 1 12 17a4 4 0 0 1-4-3.4V8.4Z" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 10H4M20 10h-4M8 14H4M20 14h-4M9.5 5 8 3M14.5 5 16 3M12 8.5v6" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
    </svg>
  )
}
