import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import ContestAdminForm from '../../../../components/contests/contest-admin-form'
import ContestAllowlistManager from '../../../../components/contests/contest-allowlist-manager'
import ContestModerationList from '../../../../components/contests/contest-moderation-list'
import PendingNavButton from '../../../../components/contests/pending-nav-button'
import PendingSubmitButton from '../../../../components/contests/pending-submit-button'
import {
  finalizeContestResultsAction,
  publishContestResultsAction,
} from '../../../../lib/contests/actions'
import { canManageContest } from '../../../../lib/contests/permissions'
import {
  DEMO_CONTEST_ID,
  getContestById,
  getContestAllowlist,
  getContestNominations,
  getContestParticipants,
  getContestResults,
} from '../../../../lib/contests/queries'
import { createClient, getSessionUser } from '../../../../utils/supabase/server'

function getRequestOrigin(requestHeaders: Headers) {
  const explicitOrigin = requestHeaders.get('origin')
  if (explicitOrigin) return explicitOrigin

  const host = requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host')
  if (!host) return ''

  const proto = requestHeaders.get('x-forwarded-proto') ?? 'https'
  return `${proto}://${host}`
}

export default async function ManageContestPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const supabase = await createClient()
  const user = await getSessionUser(supabase)
  if (!user) redirect('/login')

  const { id } = await params
  const isDemoContest = id === DEMO_CONTEST_ID
  if (!isDemoContest && !(await canManageContest(user.id, id))) redirect('/contests')

  const contest = await getContestById(id)
  if (!contest) notFound()
  const nominations = isDemoContest ? [] : await getContestNominations(id, true)
  const results = isDemoContest ? [] : await getContestResults(id)
  const allowlist = isDemoContest ? [] : await getContestAllowlist(id)
  const participants = isDemoContest ? [] : await getContestParticipants(id)
  const shareOrigin = getRequestOrigin(await headers())

  return (
    <main className="min-h-screen bg-[#081018] text-white">
      <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 pb-24 pt-6 sm:max-w-4xl">
        <header className="flex items-center justify-between gap-3">
          <h1 className="text-3xl font-black">{contest.title}</h1>
          <PendingNavButton
            href={`/contests/manage/${contest.id}/preview`}
            pendingLabel="Loading..."
            className="rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-4 py-3 text-sm font-black text-cyan-100"
          >
            Preview
          </PendingNavButton>
        </header>
        <ContestAdminForm
          contest={contest}
          isReadOnly={isDemoContest}
          shareOrigin={shareOrigin}
        />
        {isDemoContest ? null : (
          <>
            <ContestModerationList contestId={contest.id} nominations={nominations} />
            <ContestAllowlistManager
              contestId={contest.id}
              allowlist={allowlist}
              participants={participants}
            />
            <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <h2 className="text-xl font-black">Results</h2>
              <p className="mt-2 text-sm text-white/55">
                {results.length} finalized result rows.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <form action={finalizeContestResultsAction}>
                  <input type="hidden" name="contestId" value={contest.id} />
                  <PendingSubmitButton
                    pendingLabel="Finalizing..."
                    className="rounded-xl border border-white/10 px-4 py-2 font-black text-white"
                  >
                    Finalize
                  </PendingSubmitButton>
                </form>
                <form action={publishContestResultsAction}>
                  <input type="hidden" name="contestId" value={contest.id} />
                  <input type="hidden" name="slug" value={contest.slug} />
                  <PendingSubmitButton
                    pendingLabel="Publishing..."
                    className="rounded-xl bg-cyan-400 px-4 py-2 font-black text-black"
                  >
                    Publish Results
                  </PendingSubmitButton>
                </form>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  )
}
