import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '../../utils/supabase/server'
import SettingsProfileCard from './settings-profile-card'
import SettingsSupportSection from './settings-support-section'
import SettingsSessionSection from './settings-session-section'
import SettingsV3Preview from './settings-v3-preview'
import { hasV3PreviewSession } from '../../lib/v3-preview-server'
import {
  SettingsProfileSkeleton,
  SettingsCardSkeleton,
} from './settings-skeletons'
import styles from '../settings-support-silver.module.css'

type SettingsPageProps = {
  searchParams?: Promise<{
    preview?: string
  }>
}

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const params = searchParams ? await searchParams : undefined
  const isPreview = await hasV3PreviewSession(params?.preview)

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(
      isPreview
        ? '/login?next=%2Fsettings%3Fpreview%3D1&preview=1'
        : '/login'
    )
  }

  if (isPreview) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name, username, avatar_url')
      .eq('id', user.id)
      .maybeSingle()

    return (
      <SettingsV3Preview
        user={{
          createdAt: user.created_at ?? null,
          displayName:
            profile?.display_name ||
            user.user_metadata?.full_name ||
            user.email?.split('@')[0] ||
            'Painter',
          email: user.email ?? '',
          avatarUrl: profile?.avatar_url ?? null,
          username: profile?.username ?? null,
        }}
      />
    )
  }

  return (
    <main className={styles.root}>
      <div className={styles.shell}>
        <Suspense fallback={<SettingsProfileSkeleton />}>
          <SettingsProfileCard />
        </Suspense>

        <Suspense fallback={<SettingsCardSkeleton />}>
          <SettingsSupportSection />
        </Suspense>

        <Suspense fallback={<SettingsCardSkeleton />}>
          <SettingsSessionSection />
        </Suspense>
      </div>
    </main>
  )
}
