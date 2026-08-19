import Image from 'next/image'
import styles from './dashboard-og.module.css'

const badges = [
  {
    title: 'Unproven Organism',
    trigger: '“Earned” by simply existing. Woot',
    flavor:
      'No accomplishment detected, but your pile of shame senses a disturbance in the force.',
    image: '/badges/unproven-organism.png',
  },
]

export default function DashboardHobbyBadges() {
  return (
    <section className={styles.badgePanel}>
      <h2 className={styles.profileSectionTitle}>Badges Earned</h2>

      <div className={styles.badgeStack}>
        {badges.map((badge) => (
          <div
            key={badge.title}
            className={styles.badgeCard}
          >
            <div className={styles.badgeImageMount}>
              <span className={styles.badgeImageFrame}>
                <Image
                  src={badge.image}
                  alt={badge.title}
                  width={96}
                  height={96}
                  className={styles.badgeImage}
                />
              </span>
            </div>

            <div className={styles.badgeCopy}>
              <h3>{badge.title}</h3>
              <p className={styles.badgeTrigger}>{badge.trigger}</p>
              <span className={styles.profileDivider} aria-hidden="true" />
              <p className={styles.badgeFlavor}>{badge.flavor}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
