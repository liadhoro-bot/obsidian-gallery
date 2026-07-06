import Link from 'next/link'
import { redirect } from 'next/navigation'
import ContestHeader from '../../../../components/contests/contest-header'
import ContestNomineeGallery from '../../../../components/contests/contest-nominee-gallery'
import { isCurrentUserAdmin } from '../../../../lib/admin'
import { getContestPhase } from '../../../../lib/contests/phases'
import {
  getContestNominations,
  getManageContests,
} from '../../../../lib/contests/queries'
import { createClient, getSessionUser } from '../../../../utils/supabase/server'

export default async function ContestNonOwnerPreviewPage() {
  const supabase = await createClient()
  const user = await getSessionUser(supabase)
  if (!user) redirect('/login')

  const canCreateContests = await isCurrentUserAdmin(user.id)
  const contests = await getManageContests(user.id, canCreateContests)
  const previewContests = await Promise.all(
    contests.map(async (contest) => ({
      contest,
      nominations: await getContestNominations(contest.id),
    }))
  )

  return (
    <main className="min-h-screen bg-[#081018] text-white">
      <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 pb-24 pt-6 sm:max-w-5xl">
        <header className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">
              Preview
            </p>
            <h1 className="mt-2 text-3xl font-black">Non-owner Contest View</h1>
          </div>
          <Link
            href="/contests/manage"
            className="rounded-xl border border-white/10 px-4 py-3 text-sm font-black text-white/75"
          >
            Manage
          </Link>
        </header>

        {contests.length === 0 ? (
          <p className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-white/55">
            No contests are available to preview.
          </p>
        ) : (
          previewContests.map(({ contest, nominations }) => {
            const allowedTypes =
              contest.allowed_nominee_types?.map((row) => row.nominee_type) ?? []
            const phase = getContestPhase(contest)

            return (
              <section key={contest.id} className="space-y-4">
                <ContestHeader contest={contest} />
                <div className="grid gap-4 md:grid-cols-[1fr_320px]">
                  <div className="grid gap-4">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-300">
                        Details
                      </p>
                      <h2 className="mt-1 text-xl font-black">Description</h2>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-white/65">
                        {contest.description ||
                          contest.short_description ||
                          'Contest details will be posted soon.'}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-300">
                        Rules
                      </p>
                      <h2 className="mt-1 text-xl font-black">How to Enter</h2>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-white/65">
                        {contest.rules_markdown}
                      </p>
                    </div>
                  </div>

                  <aside className="grid content-start gap-4">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-300">
                        Nominations
                      </p>
                      <h2 className="mt-1 text-xl font-black">Accepted Objects</h2>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {allowedTypes.map((type) => (
                          <span
                            key={type}
                            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-black uppercase text-white/70"
                          >
                            {type === 'guide' ? 'Guides' : `${type}s`}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-300">
                        Ballot
                      </p>
                      <h2 className="mt-1 text-xl font-black">
                        {contest.maximum_selections_per_ballot} ranked picks
                      </h2>
                      <p className="mt-3 text-sm leading-6 text-white/60">
                        {phase === 'voting_open'
                          ? 'Users will vote from the contest voting page.'
                          : 'Voting opens after nominations close.'}
                      </p>
                    </div>
                  </aside>
                </div>
                <ContestNomineeGallery nominations={nominations} />
              </section>
            )
          })
        )}
      </div>
    </main>
  )
}
