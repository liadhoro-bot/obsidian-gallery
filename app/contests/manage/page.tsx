import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient, getSessionUser } from '../../../utils/supabase/server'
import ContestPhaseBadge from '../../../components/contests/contest-phase-badge'
import { createMvpContestsAction } from '../../../lib/contests/actions'
import { isCurrentUserAdmin } from '../../../lib/admin'
import { getContestPhase } from '../../../lib/contests/phases'
import { getManageContests } from '../../../lib/contests/queries'

export default async function ContestManagePage() {
  const supabase = await createClient()
  const user = await getSessionUser(supabase)
  if (!user) redirect('/login')
  const canCreateContests = await isCurrentUserAdmin(user.id)

  const contests = await getManageContests(user.id, canCreateContests)

  return (
    <main className="min-h-screen bg-[#081018] text-white">
      <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 pb-24 pt-6 sm:max-w-5xl">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-3xl font-black">Manage Contests</h1>
          <div className="flex flex-wrap justify-end gap-2">
            <Link
              href="/contests/manage/preview"
              className="rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-4 py-3 text-sm font-black text-cyan-100"
            >
              Preview
            </Link>
            {canCreateContests ? (
              <Link href="/contests/manage/new" className="rounded-xl bg-cyan-400 px-4 py-3 font-black text-black">
                New
              </Link>
            ) : null}
          </div>
        </div>
        {canCreateContests ? (
          <form
            action={createMvpContestsAction}
            className="rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.06] p-4"
          >
            <h2 className="text-lg font-black text-cyan-50">MVP Contest Presets</h2>
            <p className="mt-2 text-sm leading-6 text-cyan-50/70">
              Create or refresh the Path to Glory Coolest Army and Best Painting
              Guide contests with the MVP rules.
            </p>
            <button className="mt-3 rounded-xl bg-cyan-400 px-4 py-3 text-sm font-black text-black">
              Create / Refresh MVP Contests
            </button>
          </form>
        ) : null}
        <div className="space-y-3">
          {contests.length === 0 ? (
            <p className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-white/55">
              No contests are available to manage.
            </p>
          ) : contests.map((contest) => (
            <Link
              key={contest.id}
              href={`/contests/manage/${contest.id}`}
              className="block rounded-2xl border border-white/10 bg-white/[0.04] p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-black">{contest.title}</div>
                  <div className="text-sm text-white/45">
                    {contest.nominations?.length ?? 0} submissions ·{' '}
                    {contest.nominations?.filter((row) => row.status === 'approved').length ?? 0} approved ·{' '}
                    {contest.ballots?.length ?? 0} ballots
                  </div>
                </div>
                <ContestPhaseBadge phase={getContestPhase(contest)} />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  )
}
