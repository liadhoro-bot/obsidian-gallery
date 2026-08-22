'use client'

import styles from '../../../auth-flow-silver.module.css'

type CuratorBridgeScreenProps = {
  onEnter: () => void
}

export default function CuratorBridgeScreen({
  onEnter,
}: CuratorBridgeScreenProps) {
  return (
    <section className={`${styles.paperScreen} ${styles.curatorScreen}`}>
      <div className={styles.stepDots} aria-label="Onboarding complete">
        {[0, 1, 2].map((step) => (
          <span
            key={step}
            className={`${styles.stepDot} ${styles.stepDotActive}`}
          />
        ))}
      </div>

      <div className={styles.curatorCenter}>
        <div className={styles.curatorBadge}>
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
            <path
              d="M7 4.5h8.5L18 7v12.5H7v-15Z"
              fill="currentColor"
              opacity="0.92"
            />
            <path
              d="M9 10h6M9 13h6M9 16h4"
              stroke="#111827"
              strokeLinecap="round"
              strokeWidth="1.5"
            />
          </svg>
          <span className={styles.curatorCheck}>
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
              <path
                d="m5.5 12.5 4 4 9-9"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="3"
              />
            </svg>
          </span>
        </div>

        <p className={`${styles.eyebrow} mt-8`}>
          The Curator
        </p>

        <blockquote className={styles.curatorQuote}>
          &quot;One miniature. One step at a time. We shall postpone panic until
          it becomes necessary.&quot;
        </blockquote>

        <button
          type="button"
          onClick={onEnter}
          className={`tap-press tap-target mt-8 ${styles.ctaButton}`}
        >
          Enter the Gallery -&gt;
        </button>
      </div>
    </section>
  )
}
