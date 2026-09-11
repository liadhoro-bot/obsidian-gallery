import Image from 'next/image'
import type { ContestNomination } from '../../lib/contests/types'
import styles from './contest-v3-silver.module.css'

type GalleryImage = {
  id: string
  image_url: string
  alt_text: string | null
}

export default function ContestNomineeDetail({
  nomination,
  galleryImages,
  hideIdentity,
}: {
  nomination: ContestNomination
  galleryImages: GalleryImage[]
  hideIdentity?: boolean
}) {
  const images =
    galleryImages.length > 0
      ? galleryImages
      : [{ id: nomination.id, image_url: nomination.snapshot_image_url, alt_text: null }]

  return (
    <div className={styles.contestStack}>
      <article className={`${styles.paperPanel} ${styles.nomineeDetailHero}`}>
        <div className={styles.nomineeDetailHeroImage}>
          <Image
            src={nomination.snapshot_image_url}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 720px"
            className="object-cover"
          />
        </div>
        <div className={styles.nomineeDetailHeroBody}>
          <p className={styles.eyebrow}>{nomination.source_type}</p>
          <h1 className={styles.sectionTitle}>{nomination.snapshot_title}</h1>
          {!hideIdentity && nomination.snapshot_owner_display_name ? (
            <p className={styles.mutedText}>By {nomination.snapshot_owner_display_name}</p>
          ) : null}
          {nomination.snapshot_description ? (
            <p className={styles.bodyText}>{nomination.snapshot_description}</p>
          ) : null}
        </div>
      </article>

      <article className={styles.paperPanel}>
        <p className={styles.eyebrow}>Gallery</p>
        <div className={`${styles.tileGrid} mt-3`}>
          {images.map((image) => (
            <div key={image.id} className={styles.nomineeTileImage}>
              <Image
                src={image.image_url}
                alt={image.alt_text || ''}
                fill
                sizes="(max-width: 640px) 33vw, 220px"
                className="object-cover"
              />
            </div>
          ))}
        </div>
      </article>
    </div>
  )
}
