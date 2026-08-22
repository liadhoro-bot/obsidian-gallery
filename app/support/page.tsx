import dynamic from 'next/dynamic'
import BackButton from '../components/back-button'
import styles from '../settings-support-silver.module.css'

const FeedbackCard = dynamic(() => import('./feedback-card'))

const payboxLink = 'https://links.payboxapp.com/oPJxbFBZM2b'
const bitPhone = '054-4459145'

// Best-effort Bit app opener.
// Test this on your phone after deploy.
const bitLink = `https://bitpay.co.il/app/`

const amounts = [25, 50, 100, 200]

export default function SupportPage() {
  return (
    <main className={styles.root}>
      <div className={styles.shell}>
        <section className={styles.supportHero}>
          <div className={styles.backWrap}>
            <BackButton fallbackHref="/dashboard" className={styles.backButton} />
          </div>

          <div className={styles.supportPill}>
            Support
          </div>

          <div className={styles.heroBody}>
            <div className={styles.heroIcon}>
              ❤️
            </div>

            <div>
              <p className={styles.eyebrow}>
                Support the App
              </p>

              <h1 className={styles.title}>
                Keep the workshop running
              </h1>

              <p className={styles.copy}>
                Obsidian Gallery is a passion project built by a miniature
                painter and tabletop wargamer who wanted a better way to
                organize projects, guides, palettes, and hobby progress.

                <span className={styles.copyBlock}>
                  Every bit of support helps keep the app alive and growing -
                  covering hosting, storage, development time, and future
                  features for the community.
                </span>
              </p>
            </div>
          </div>
        </section>

        <section className={styles.card}>
          <h2 className={styles.sectionTitle}>
            Suggested amounts
          </h2>

          <p className={styles.muted}>
            These are suggestions only. We can&apos;t reliably pre-fill
            the payment amount from the app.
          </p>

          <div className={styles.amountGrid}>
            {amounts.map((amount) => (
              <div
                key={amount}
                className={styles.amountChip}
              >
                ₪{amount}
              </div>
            ))}
          </div>
        </section>

        <section className={styles.card}>
          <div className={styles.paymentHeader}>
            <div className={styles.paymentIcon}>
              bit
            </div>

            <div>
              <h2 className={styles.paymentTitle}>Pay with Bit</h2>
              <p className={styles.paymentCopy}>
                If Bit does not fill the recipient automatically, search/send to
              </p>
            </div>
          </div>

          <div className={`${styles.darkInset} ${styles.paymentInset}`}>
            <div className={styles.paymentLabel}>Bit phone number</div>
            <div className={styles.paymentValue}>
              {bitPhone}
            </div>
          </div>

          <a
            href={bitLink}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.walnutButton}
          >
            Open Bit to Pay
            ↗
          </a>

        </section>

        <div className={styles.divider} />

        <section className={styles.card}>
          <div className={styles.paymentHeader}>
            <div className={styles.paymentIcon}>
              PB
            </div>

            <div>
              <h2 className={styles.paymentTitle}>Pay with PayBox</h2>
              <p className={styles.paymentCopy}>
                Opens the Obsidian Gallery PayBox payment group.
              </p>
            </div>
          </div>

          <a
            href={payboxLink}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.walnutButton}
          >
            Open PayBox ↗
          </a>

          <p className={styles.note}>
            Recommended for Israeli users who prefer PayBox.
          </p>
        </section>

        <FeedbackCard />
      </div>
    </main>
  )
}
