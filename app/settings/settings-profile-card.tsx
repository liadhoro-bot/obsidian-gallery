import Image from 'next/image'
import { createClient } from '../../utils/supabase/server'
import { updateAvatar } from './settings-actions'
import AvatarUploadInput from './avatar-upload-input'

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
    <section className="rounded-3xl border border-white/5 bg-white/[0.04] p-6 shadow-lg">
      <div className="flex flex-col items-center text-center">
        <form action={updateAvatar}>
          <label className="relative block h-28 w-28 cursor-pointer overflow-hidden rounded-3xl border border-cyan-400/30 bg-slate-900">
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt={displayName}
                fill
                className="object-cover"
                sizes="112px"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-4xl">
                🎨
              </div>
            )}

            <span className="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-400 text-xs text-slate-950">
              📷
            </span>

            <AvatarUploadInput />
          </label>
        </form>

        <p className="mt-3 text-xs text-slate-500">
          Tap image to replace avatar
        </p>

        <h1 className="mt-4 text-2xl font-bold leading-tight">{displayName}</h1>
        <p className="mt-1 text-sm text-slate-400">{user.email}</p>
        <p className="mt-1 text-sm text-slate-500">@{username}</p>

        <div className="mt-4 flex gap-2">
          <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-cyan-300">
            Painter
          </span>
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-slate-400">
            Member
          </span>
        </div>

        <button
          type="button"
          className="mt-5 rounded-xl bg-white/10 px-5 py-3 text-sm font-semibold text-slate-100"
        >
          Edit Profile
        </button>
      </div>
    </section>
  )
}