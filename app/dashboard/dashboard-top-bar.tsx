import Image from 'next/image'
import { createClient } from '../../utils/supabase/server'
import PrefetchLink from '../components/prefetch-link'
import SupportButton from '../components/SupportButton'
import DownloadAppButton from '../components/download-app-button'

type ProfileResult = {
  data: {
    avatar_url: string | null
    level: number | null
    username: string | null
  } | null
}

type ProfilePromise = Promise<ProfileResult>

type DashboardTopBarProps = {
  userId?: string
  profilePromise?: ProfilePromise
}

function getAvatarInitials(username?: string | null) {
  const letters = (username || '').replace(/^@/, '').match(/[a-z0-9]/gi)

  return letters?.slice(0, 2).join('').toUpperCase() || 'OG'
}

export default async function DashboardTopBar({
  userId,
  profilePromise,
}: DashboardTopBarProps) {
  let profile: ProfileResult['data'] = null

  if (profilePromise) {
    const result = await profilePromise
    profile = result.data
  } else {
    const supabase = await createClient()

    let resolvedUserId = userId

    if (!resolvedUserId) {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      resolvedUserId = user?.id
    }

    if (resolvedUserId) {
      const { data } = await supabase
        .from('profiles')
        .select('avatar_url, level, username')
        .eq('id', resolvedUserId)
        .single()

      profile = data
    }
  }

  const avatarUrl = profile?.avatar_url || null
  const level = profile?.level ?? 0
  const avatarInitials = getAvatarInitials(profile?.username)

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <PrefetchLink
          href="/settings"
          viewportPrefetch
          className="block rounded-full focus:outline-none focus:ring-2 focus:ring-cyan-400/60"
          aria-label="Open settings"
        >
          {avatarUrl ? (
            <div className="relative h-12 w-12 overflow-hidden rounded-full border border-cyan-400/30 bg-white/5">
              <Image
                src={avatarUrl}
                alt="User avatar"
                fill
                className="object-cover"
                sizes="48px"
                priority
              />
            </div>
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-cyan-400/30 bg-white/5 text-sm font-semibold text-cyan-300">
              {avatarInitials}
            </div>
          )}
        </PrefetchLink>

        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-white/50">
            Obsidian Gallery
          </p>
          <p className="text-sm font-medium text-white/90">
            Lv. {level} Painter
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
  <DownloadAppButton />
  <SupportButton />
</div>
    </div>
  )
}
