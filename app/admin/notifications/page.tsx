import { redirect } from 'next/navigation'
import { createClient, getSessionUser } from '../../../utils/supabase/server'
import { createServiceRoleClient } from '../../../utils/supabase/service-role'
import { isCurrentUserAdmin } from '../../../lib/admin'
import { getPushAudience, isPushConfigured } from '../../../lib/push/send'
import BroadcastForm from './broadcast-form'

// Broadcast sends run inside this page's server action.
export const maxDuration = 60

export default async function AdminNotificationsPage() {
  const supabase = await createClient()
  const user = await getSessionUser(supabase)
  if (!user) redirect('/login?next=%2Fadmin%2Fnotifications')
  if (!(await isCurrentUserAdmin(user.id))) redirect('/dashboard')

  const [audience, history] = await Promise.all([
    getPushAudience(),
    createServiceRoleClient()
      .from('push_broadcasts')
      .select('id, title, body, url, devices, sent, failed, removed, created_at')
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  return (
    <main className="min-h-screen bg-[#081018] text-white">
      <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 pb-28 pt-6 sm:max-w-2xl">
        <div>
          <h1 className="text-3xl font-black">Push Notifications</h1>
          <p className="mt-2 text-sm text-white/60">
            Send one notification to everyone who has turned notifications on.
          </p>
        </div>

        <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.06] p-4">
          <div className="text-xs font-bold uppercase tracking-wide text-cyan-100/70">
            Audience right now
          </div>
          <div className="mt-1 text-2xl font-black text-cyan-50">
            {audience.people} {audience.people === 1 ? 'person' : 'people'}
            <span className="ml-2 text-base font-bold text-cyan-50/60">
              on {audience.devices} {audience.devices === 1 ? 'device' : 'devices'}
            </span>
          </div>
        </div>

        {isPushConfigured() ? (
          <BroadcastForm audienceDevices={audience.devices} audiencePeople={audience.people} />
        ) : (
          <p className="rounded-2xl border border-red-300/30 bg-red-400/10 p-4 text-sm text-red-100">
            Push isn&apos;t configured on the server (VAPID keys missing).
          </p>
        )}

        <section className="space-y-3">
          <h2 className="text-lg font-black">Sent before</h2>
          {(history.data ?? []).length === 0 ? (
            <p className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-white/55">
              No broadcasts yet.
            </p>
          ) : (
            (history.data ?? []).map((row) => (
              <div key={row.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="font-black">{row.title}</div>
                  <time className="shrink-0 text-xs text-white/50" dateTime={row.created_at}>
                    {new Date(row.created_at).toLocaleString('en-GB', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                      timeZone: 'UTC',
                    })}{' '}
                    UTC
                  </time>
                </div>
                <p className="mt-1 text-sm text-white/75">{row.body}</p>
                <p className="mt-2 text-xs text-white/50">
                  Opens {row.url} · delivered {row.sent}/{row.devices}
                  {row.failed ? ` · ${row.failed} failed` : ''}
                  {row.removed ? ` · ${row.removed} old devices removed` : ''}
                </p>
              </div>
            ))
          )}
        </section>
      </div>
    </main>
  )
}
