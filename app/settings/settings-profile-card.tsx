import Image from 'next/image'
import { createClient } from '../../utils/supabase/server'
import { updateAvatar } from './settings-actions'
import BackButton from '../components/back-button'
import AvatarUploadInput from './avatar-upload-input'
import SettingsProfileEditor from './settings-profile-editor'
import styles from '../settings-support-silver.module.css'

export default async function SettingsProfileCard() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, username, avatar_url')
    .eq('id', user.id)
    .single()

  const displayName =
    profile?.display_name ||
    user.user_metadata?.full_name ||
    user.email?.split('@')[0] ||
    'Painter'

  const username = profile?.username || 'No username yet'
  const avatarUrl = profile?.avatar_url

  return (
    <section className={`${styles.panel} ${styles.profilePanel}`}>
      <div className={styles.backWrap}>
        <BackButton fallbackHref="/dashboard" className={styles.backButton} />
      </div>

      <div className={styles.profileBody}>
        <form action={updateAvatar}>
          <label className={styles.avatarFrame}>
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt={displayName}
                fill
                className="object-cover"
                sizes="112px"
              />
            ) : (
              <div className={styles.avatarFallback}>
                🎨
              </div>
            )}

            <span className={styles.cameraBadge}>
              📷
            </span>

            <AvatarUploadInput />
          </label>
        </form>

        <p className={styles.hint}>
          Tap image to replace avatar
        </p>

        <h1 className={styles.identityTitle}>{displayName}</h1>
        <p className={styles.emailText}>{user.email}</p>
        <p className={styles.usernameText}>@{username}</p>

        <div className={styles.badgeRow}>
          <span className={styles.badge}>
            Painter
          </span>
          <span className={`${styles.badge} ${styles.badgeMuted}`}>
            Member
          </span>
        </div>

        <SettingsProfileEditor email={user.email || ''} username={username} />
        
      </div>
    </section>
  )
}
