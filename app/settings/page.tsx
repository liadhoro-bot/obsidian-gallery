import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '../../utils/supabase/server'
import MobileNav from '../components/MobileNav'
import SettingsProfileCard from './settings-profile-card'
import SettingsAccountSection from './settings-account-section'
import SettingsPreferencesSection from './settings-preferences-section'
import SettingsSupportSection from './settings-support-section'
import SettingsSessionSection from './settings-session-section'
import {
  SettingsProfileSkeleton,
  SettingsCardSkeleton,
} from './settings-skeletons'

export default async function SettingsPage() {
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
          <SettingsAccountSection />
        </Suspense>

        <Suspense fallback={<SettingsCardSkeleton />}>
          <SettingsPreferencesSection />
        </Suspense>

        <Suspense fallback={<SettingsCardSkeleton />}>
          <SettingsSupportSection />
        </Suspense>

        <Suspense fallback={<SettingsCardSkeleton />}>
          <SettingsSessionSection />
        </Suspense>
      </div>

      <MobileNav />
    </main>
  )
}