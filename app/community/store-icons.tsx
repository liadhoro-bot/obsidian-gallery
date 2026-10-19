import type { ReactNode } from 'react'
import type { StoreOffering } from './stores-data'

function Icon({ children, size }: { children: ReactNode; size: number }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  )
}

const offeringPaths: Record<StoreOffering, ReactNode> = {
  trading_cards: (
    <>
      <rect x="3" y="6" width="10" height="14" rx="1.5" transform="rotate(-10 8 13)" />
      <rect x="10" y="4" width="10" height="14" rx="1.5" transform="rotate(8 15 11)" />
    </>
  ),
  board_games: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M9 3v18" />
      <circle cx="15" cy="15" r="2" />
    </>
  ),
  dice: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <circle cx="9" cy="9" r="1" />
      <circle cx="15" cy="15" r="1" />
      <circle cx="15" cy="9" r="1" />
      <circle cx="9" cy="15" r="1" />
    </>
  ),
  play_tables: (
    <>
      <path d="M3 9h18M5 9v11M19 9v11M8 9V5h8v4" />
    </>
  ),
  miniatures: (
    <>
      <circle cx="12" cy="6" r="2.5" />
      <path d="M9 21l1-8-3-3 5-1 5 1-3 3 1 8" />
      <path d="M6 21h12" />
    </>
  ),
  paints: (
    <>
      <path d="M8 3h8v3H8z" />
      <path d="M7 6h10l-1 15H8z" />
      <path d="M9 12h6" />
    </>
  ),
  airbrushes: (
    <>
      <path d="M3 13h11l4-3h3" />
      <path d="M9 13v5h3v-5" />
      <path d="M10 13V9h4v4" />
    </>
  ),
  scenery: (
    <>
      <path d="M3 20l6-10 4 6 3-4 5 8z" />
      <circle cx="17" cy="6" r="2" />
    </>
  ),
  hobby_tools: (
    <>
      <path d="M4 20l9-9" />
      <path d="M13 11l3-7 4 4-7 3" />
      <path d="M14 20l6-6" />
    </>
  ),
  accessories: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M5 7h14" />
    </>
  ),
  trains: (
    <>
      <rect x="5" y="3" width="14" height="13" rx="3" />
      <path d="M5 10h14" />
      <circle cx="9" cy="13" r="0.8" />
      <circle cx="15" cy="13" r="0.8" />
      <path d="M8 21l2-5M16 21l-2-5" />
    </>
  ),
  track: (
    <>
      <path d="M8 3L6 21M16 3l2 18" />
      <path d="M6.5 7h11M6 12h12M5.5 17h13" />
    </>
  ),
}

export function OfferingIcon({ offering }: { offering: StoreOffering }) {
  return <Icon size={30}>{offeringPaths[offering]}</Icon>
}

export function InfoPinIcon() {
  return (
    <Icon size={22}>
      <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </Icon>
  )
}

export function InfoClockIcon() {
  return (
    <Icon size={22}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </Icon>
  )
}

export function InfoPhoneIcon() {
  return (
    <Icon size={22}>
      <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" />
    </Icon>
  )
}

export function InfoGlobeIcon() {
  return (
    <Icon size={22}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </Icon>
  )
}
