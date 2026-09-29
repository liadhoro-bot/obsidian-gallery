'use client'

import { useRef, useState } from 'react'
import styles from './feature-on-dashboard-button.module.css'

// Hero-card toggle on the unit and project pages: makes this unit/project
// the one featured item in the dashboard's hero card. Featuring one thing
// un-features whatever was featured before (see the server actions).
//
// Fully optimistic: the pill flips on tap and never waits on (or dims for)
// the server. Taps queue so the server applies them in order, and only a
// failure of the latest tap rolls the pill back.
export default function FeatureOnDashboardButton({
  entityLabel,
  isFeatured,
  onToggle,
}: {
  entityLabel: 'unit' | 'project'
  isFeatured: boolean
  onToggle: (nextFeatured: boolean) => Promise<void>
}) {
  const [featured, setFeatured] = useState(isFeatured)
  const [serverFeatured, setServerFeatured] = useState(isFeatured)
  const [inFlight, setInFlight] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const queue = useRef<Promise<void>>(Promise.resolve())
  const latestRequest = useRef(0)

  // Adopt server state, but not while our own writes are still landing -
  // a refresh mid-flight can carry the pre-toggle value.
  if (isFeatured !== serverFeatured) {
    setServerFeatured(isFeatured)
    if (inFlight === 0) setFeatured(isFeatured)
  }

  function toggle() {
    const nextFeatured = !featured
    const requestId = ++latestRequest.current
    setError(null)
    setFeatured(nextFeatured)
    setInFlight((count) => count + 1)

    queue.current = queue.current
      .then(() => onToggle(nextFeatured))
      .catch((toggleError: unknown) => {
        if (requestId !== latestRequest.current) return
        setFeatured(!nextFeatured)
        setError(
          toggleError instanceof Error && toggleError.message
            ? toggleError.message
            : 'Could not update the dashboard.'
        )
      })
      .finally(() => {
        setInFlight((count) => count - 1)
      })
  }

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={styles.button}
        aria-pressed={featured}
        onClick={toggle}
        title={
          featured
            ? `Featured on your dashboard - tap to remove`
            : `Feature this ${entityLabel} in your dashboard hero card`
        }
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className={styles.icon}
          fill={featured ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        >
          <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z" />
        </svg>
        <span>{featured ? 'Featured' : 'Feature'}</span>
      </button>
      {error ? (
        <span className={styles.error} role="alert">
          {error}
        </span>
      ) : null}
    </div>
  )
}
