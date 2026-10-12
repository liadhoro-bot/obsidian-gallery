import Image from 'next/image'
import { createClient, getSessionUser } from '../../utils/supabase/server'
import { updateAvatar } from './settings-actions'
import AvatarUploadInput from './avatar-upload-input'
import SettingsProfileEditor from './settings-profile-editor'
import styles from '../settings-support-silver.module.css'

function formatMemberSince(value: string | null | undefined) {
  if (!value) return 'Member'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Member'

  return `Member since ${new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
  }).format(date)}`
}

export default async function SettingsProfileCard() {
  const supabase = await createClient()

  const user = await getSessionUser(supabase)

  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, username, avatar_url')
    .eq('id', user.id)
    .single()

  const memberSince = user.created_at
    ? user.created_at
    : (await supabase.auth.getUser()).data.user?.created_at

  const displayName =
    profile?.display_name ||
    user.user_metadata?.full_name ||
    user.email?.split('@')[0] ||
    'Painter'

  const username = profile?.username || 'No username yet'
  const avatarUrl = profile?.avatar_url

  return (
    <section className={`${styles.panel} ${styles.previewPanel}`}>
      <div className={styles.panelHeader}>
        <h1 className={styles.panelLabel}>Account</h1>
      </div>

      <div className={styles.previewSectionBody}>
        <div className={styles.previewAccountGrid}>
          <form action={updateAvatar}>
            <label className={styles.previewAvatar} aria-label="Replace avatar">
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt={displayName}
                  fill
                  className="object-cover"
                  sizes="96px"
                />
              ) : (
                <span className={styles.avatarFallback}>🎨</span>
              )}

              <span className={styles.avatarEditControl} aria-hidden="true">✎</span>
              <AvatarUploadInput />
            </label>
          </form>

          <div className="min-w-0 self-center">
            <h2 className={`${styles.previewName} truncate`}>{displayName}</h2>
            <p className={`${styles.emailText} truncate`}>{user.email}</p>
            <p className={`${styles.usernameText} truncate`}>@{username}</p>
            <div className={styles.memberMeta}>
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className={styles.memberCalendarIcon}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="5" width="18" height="16" rx="2" />
                <path d="M16 3v4M8 3v4M3 11h18" />
              </svg>
              <span>{formatMemberSince(memberSince)}</span>
            </div>
          </div>
        </div>

        <SettingsProfileEditor
          buttonClassName={styles.walnutButton}
          email={user.email || ''}
          username={username}
        />
      </div>
    </section>
  )
}
