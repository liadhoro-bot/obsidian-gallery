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

type SettingsPageProps = {
  searchParams?: Promise<{
    preview?: string
  }>
}

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const params = searchParams ? await searchParams : undefined
  const isPreview = await hasV3PreviewSession(params?.preview)

  if (isPreview) {
    return <SettingsV3Preview />
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <main className="min-h-screen bg-[#061012] pb-24 text-slate-100">

      <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 pt-8">
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
