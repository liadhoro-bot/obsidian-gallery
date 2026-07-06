import { notFound, redirect } from 'next/navigation'
import { createClient, getSessionUser } from '../../../../utils/supabase/server'
import { submitNominationAction } from '../../../../lib/contests/actions'
import { getContestPhase } from '../../../../lib/contests/phases'
import {
  DEMO_CONTEST_ID,
  getContestBySlug,
  getNominationPickerSources,
} from '../../../../lib/contests/queries'
import NominationSourcePicker from '../../../../components/contests/nomination-source-picker'
import { canManageContest } from '../../../../lib/contests/permissions'

export default async function ContestSubmitPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ sourceType?: string; sourceId?: string }>
}) {
  const supabase = await createClient()
  const user = await getSessionUser(supabase)
  if (!user) redirect('/login')

  const [{ slug }, query] = await Promise.all([params, searchParams])
  const contest = await getContestBySlug(slug)
  if (!contest) notFound()

  const phase = getContestPhase(contest)
  const allowedTypes = contest.allowed_nominee_types?.map((row) => row.nominee_type) ?? []
  const isDemoContest = contest.id === DEMO_CONTEST_ID
  const canManage = isDemoContest || (await canManageContest(user.id, contest.id))
  if (contest.visibility === 'private' && !canManage) {
    notFound()
  }

  const sources = await getNominationPickerSources(user.id, allowedTypes)

  return (
    <main className="min-h-screen bg-[#081018] text-white">
      <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 pb-24 pt-6 sm:max-w-5xl">
        <header>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">
            Nomination
          </p>
          <h1 className="mt-2 text-3xl font-black">{contest.title}</h1>
        </header>

        {phase !== 'submissions_open' ? (
          <p className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-white/60">
            Submission period is closed.
          </p>
        ) : (
          <NominationSourcePicker
            contest={contest}
            sources={sources}
            selectedSourceType={query.sourceType}
            selectedSourceId={query.sourceId}
            action={submitNominationAction}
            isDemoContest={isDemoContest}
          />
        )}
      </div>
    </main>
  )
}
