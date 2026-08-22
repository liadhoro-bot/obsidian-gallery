import Link from 'next/link'
import styles from '../settings-support-silver.module.css'

function SupportCard({
  title,
  description,
  icon,
  href,
}: {
  title: string
  description: string
  icon: string
  href: string
}) {
  return (
    <Link
      href={href}
      className={styles.linkRow}
    >
      <div className={styles.linkIcon}>
        {icon}
      </div>

      <div className={styles.linkText}>
        <div className={styles.linkTitle}>{title}</div>
        <div className={styles.linkDescription}>{description}</div>
      </div>

      <span className={styles.chevron}>›</span>
    </Link>
  )
}

export default async function SettingsSupportSection() {
  return (
    <section className={styles.card}>
      <h2 className={styles.sectionTitle}>
        <span className={styles.sectionIcon}>ⓘ</span>
        App Info & Support
      </h2>

      <p className={styles.description}>
        Legal details, community rules, and ways to reach us.
      </p>

      <div className={styles.linkStack}>
        <SupportCard
          icon="📜"
          title="Terms & Conditions"
          description="Rules for using Obsidian Gallery"
          href="/settings/terms"
        />

        <SupportCard
          icon="🔒"
          title="Privacy Policy"
          description="How your data and content are handled"
          href="/privacy"
        />

        <SupportCard
          icon="✉️"
          title="Contact Us"
          description="Send feedback or request help"
          href="/support"
        />
      </div>
    </section>
  )
}
