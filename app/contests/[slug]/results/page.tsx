import { notFound } from 'next/navigation'
import ContestResultsTable from '../../../../components/contests/contest-results-table'
import ResultsPodium from '../../../../components/contests/results-podium'
import { getContestBySlug, getContestResults } from '../../../../lib/contests/queries'
import { canManageContest } from '../../../../lib/contests/permissions'
import { createClient, getSessionUser } from '../../../../utils/supabase/server'

export default async function ContestResultsPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = await createClient()
  const user = await getSessionUser(supabase)
  const contest = await getContestBySlug(slug)
  if (!contest) notFound()

  if (
    contest.visibility === 'private' &&
    (!user || !(await canManageContest(user.id, contest.id)))
  ) {
    notFound()
  }

  const results = await getContestResults(contest.id)

  return (
    <main className="min-h-screen bg-[#081018] text-white">
      <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 pb-24 pt-6 sm:max-w-5xl">
        <header>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">
            Results
          </p>
          <h1 className="mt-2 text-3xl font-black">{contest.title}</h1>
        </header>

        {!contest.results_published_at ? (
          <p className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-white/60">
            Voting has closed. Results are being prepared.
          </p>
        ) : (
          <>
            <ResultsPodium results={results} />
            <ContestResultsTable contest={contest} results={results} />
          </>
        )}
      </div>
    </main>
  )
}
