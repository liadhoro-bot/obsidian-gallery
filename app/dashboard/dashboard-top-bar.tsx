import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '../../utils/supabase/server'

export default async function DashboardTopBar() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('avatar_url')
    .eq('id', user.id)
    .single()

  const avatarUrl = profile?.avatar_url || null

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
          <p className="text-sm font-medium text-white/90">Lv. 7</p>
        </div>
      </div>

      <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
        Studio Active
      </div>
    </div>
  )
}