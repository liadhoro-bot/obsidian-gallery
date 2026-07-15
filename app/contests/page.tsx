import { Suspense } from 'react'
import Link from 'next/link'
import { createClient, getSessionUser } from '../../utils/supabase/server'
import ContestCard from '../../components/contests/contest-card'
import { getContestDirectory } from '../../lib/contests/queries'
import { isCurrentUserAdmin } from '../../lib/admin'

export default async function ContestsPage() {
  const supabase = await createClient()
  const user = await getSessionUser(supabase)
  const canManageContests = user ? await isCurrentUserAdmin(user.id) : false
  const directory = await getContestDirectory(user?.id)

  return (
    <main className="min-h-screen bg-[#081018] text-white">
      <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 pb-24 pt-6 sm:max-w-5xl">
        <header className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">
              Community
            </p>
            <h1 className="mt-2 text-4xl font-black">Contests</h1>
          </div>
          {canManageContests ? (
            <Link
              href="/contests/manage"
              className="rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-4 py-3 text-sm font-black text-cyan-100"
            >
              Manage
            </Link>
          ) : null}
        </header>

        <Link
          href="/contests/dice-roll"
          className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-4 transition hover:border-cyan-200/40 hover:bg-cyan-300/15"
        >
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">
            Direct campaign link
          </p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black">2d6 Remote Roll</h2>
              <p className="mt-1 text-sm text-white/55">
                Let campaign players roll once, record the result, and notify the organizer.
              </p>
            </div>
            <span className="shrink-0 text-2xl font-black text-cyan-100">2d6</span>
          </div>
        </Link>

        <Suspense fallback={null}>
          <ContestSection title="Active" contests={directory.active} empty="No active contests right now." />
          <ContestSection title="Upcoming" contests={directory.upcoming} empty="No upcoming contests yet." />
          <ContestSection title="Past" contests={directory.past} empty="No past contests yet." />

          {user ? (
            <section>
              <h2 className="mb-3 text-2xl font-black">My Nominations</h2>
              {directory.myNominations.length === 0 ? (
                <p className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-white/55">
                  You have no contest nominations yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {directory.myNominations.map((nomination) => (
                    <div
                      key={nomination.id}
                      className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"
                    >
                      <div className="font-bold">{nomination.snapshot_title}</div>
                      <div className="text-sm text-white/45">
                        {nomination.contest?.title} · {nomination.status}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          ) : null}
        </Suspense>
      </div>
    </main>
  )
}

function ContestSection({
  title,
  contests,
  empty,
}: {
  title: string
  contests: Awaited<ReturnType<typeof getContestDirectory>>['active']
  empty: string
}) {
  return (
    <section>
      <h2 className="mb-3 text-2xl font-black">{title}</h2>
      {contests.length === 0 ? (
        <p className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-white/55">
          {empty}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {contests.map((contest) => (
            <ContestCard key={contest.id} contest={contest} />
          ))}
        </div>
      )}
    </section>
  )
}
