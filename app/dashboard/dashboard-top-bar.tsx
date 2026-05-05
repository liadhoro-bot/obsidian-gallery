import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '../../utils/supabase/server'
import SupportButton from '../components/SupportButton'

export default async function DashboardTopBar({
  userId,
}: {
  userId?: string
}) {
  const supabase = await createClient()

  let resolvedUserId = userId

  if (!resolvedUserId) {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return null

    resolvedUserId = user.id
  }

  const { data: profile } = await supabase
  .from('profiles')
  .select('avatar_url, level')
  .eq('id', resolvedUserId)
  .single()

  const avatarUrl = profile?.avatar_url || null
  const level = profile?.level ?? 0

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Link
          href="/settings"
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
              />
            </div>
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-cyan-400/30 bg-white/5 text-sm font-semibold text-cyan-300">
              LV
            </div>
          )}
        </Link>

        <div>
  <p className="text-xs uppercase tracking-[0.2em] text-white/50">
    Obsidian Gallery
  </p>
  <p className="text-sm font-medium text-white/90">
    Lv. {level} Painter
  </p>
</div>
      </div>

      {/* 🔥 REPLACEMENT HERE */}
      <SupportButton />
    </div>
  )
}