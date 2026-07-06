import { notFound } from 'next/navigation'
import Link from 'next/link'
import ContestHeader from '../../../components/contests/contest-header'
import ContestNomineeGallery from '../../../components/contests/contest-nominee-gallery'
import { getContestPhase } from '../../../lib/contests/phases'
import {
  DEMO_CONTEST_ID,
  getContestBySlug,
  getContestNominations,
  getNominationPickerSources,
} from '../../../lib/contests/queries'
import { createClient, getSessionUser } from '../../../utils/supabase/server'
import { canManageContest } from '../../../lib/contests/permissions'
import type { ContestNomination } from '../../../lib/contests/types'

export default async function ContestDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = await createClient()
  const user = await getSessionUser(supabase)
  const contest = await getContestBySlug(slug)
  if (!contest) notFound()

  const isDemoContest = contest.id === DEMO_CONTEST_ID
  const canManage =
    Boolean(user) && (isDemoContest || (await canManageContest(user!.id, contest.id)))

  if (contest.visibility === 'private' && !canManage) {
    notFound()
  }

  const phase = getContestPhase(contest)
  const allowedTypes =
    contest.allowed_nominee_types?.map((row) => row.nominee_type) ?? []
  const nominations = isDemoContest && user
    ? await getDemoNominations(user.id, contest.id, allowedTypes)
    : await getContestNominations(contest.id)
  const hideIdentity =
    contest.hide_nominee_identity_during_voting && phase === 'voting_open'

  return (
    <main className="min-h-screen bg-[#081018] text-white">
      <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 pb-24 pt-6 sm:max-w-5xl">
        <ContestHeader
          contest={contest}
          manageHref={canManage ? `/contests/manage/${contest.id}` : undefined}
        />

        <section className="grid gap-4 md:grid-cols-[1fr_320px]">
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
              <Link
                href={`/contests/${contest.slug}/submit`}
                className="mt-4 inline-flex w-full justify-center rounded-xl bg-cyan-400 px-4 py-3 text-sm font-black text-black"
              >
                Submit a Nomination
              </Link>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-300">
                Voting
              </p>
              <h2 className="mt-1 text-xl font-black capitalize">
                {contest.voting_method}
              </h2>
              <p className="mt-3 text-sm leading-6 text-white/60">
                {contest.voting_method === 'ranked'
                  ? `Rank up to ${contest.maximum_selections_per_ballot} nominees.`
                  : `Choose ${
                      contest.require_exact_selection_count ? 'exactly' : 'up to'
                    } ${contest.maximum_selections_per_ballot}.`}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="text-2xl font-black">{nominations.length}</div>
                <div className="text-xs font-bold uppercase tracking-[0.14em] text-white/40">
                  Nominees
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="text-2xl font-black">{allowedTypes.length}</div>
                <div className="text-xs font-bold uppercase tracking-[0.14em] text-white/40">
                  Object Types
                </div>
              </div>
            </div>
          </aside>
        </section>

        <ContestNomineeGallery
          nominations={nominations}
          hideIdentity={hideIdentity}
        />
      </div>
    </main>
  )
}

async function getDemoNominations(
  userId: string,
  contestId: string,
  allowedTypes: Array<'project' | 'unit' | 'guide'>
) {
  const sources = await getNominationPickerSources(userId, allowedTypes)

  return sources.slice(0, 8).map((source, index) => ({
    id: `demo-nomination-${source.sourceType}-${source.id}`,
    contest_id: contestId,
    submitted_by_user_id: userId,
    owner_user_id: userId,
    source_type: source.sourceType,
    source_project_id: source.sourceType === 'project' ? source.id : null,
    source_unit_id: source.sourceType === 'unit' ? source.id : null,
    source_guide_id: source.sourceType === 'guide' ? source.id : null,
    snapshot_title: source.title,
    snapshot_description: source.description,
    snapshot_image_url: source.imageUrl || '/onboarding/welcome-hero.jpeg',
    snapshot_owner_display_name: 'You',
    snapshot_metadata: { demo: true },
    status: 'approved',
    submitted_at: new Date(Date.now() - index * 3600000).toISOString(),
    reviewed_at: null,
    reviewed_by: null,
    rejection_reason: null,
    withdrawn_at: null,
    disqualified_at: null,
    disqualification_reason: null,
  })) satisfies ContestNomination[]
}
