import Link from 'next/link'
import { notFound } from 'next/navigation'
import { DEMO_CONTEST_ID, getContestBySlug } from '../../../../lib/contests/queries'
import { canViewContest } from '../../../../lib/contests/permissions'
import { getNomineeCopy } from '../../../../lib/contests/nominee-copy'
import { createClient, getSessionUser } from '../../../../utils/supabase/server'
import styles from '../../../../components/contests/contest-v3-silver.module.css'

function formatDate(value: string | null) {
  if (!value) return 'Not set'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value))
}

export default async function ContestFullDetailsPage({
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
  if (!isDemoContest && !(await canViewContest(user?.id, contest.id))) {
    notFound()
  }

  const nomineeCopy = getNomineeCopy(contest)

  return (
    <main className={styles.contestSilver}>
      <div className={styles.pageRail}>
        <header className={styles.detailsHeader}>
          <Link href={`/contests/${contest.slug}`} className={styles.heroBackLink}>
            Back
          </Link>
          <h1>Contest Details</h1>
          <span aria-hidden="true" />
        </header>

        <article className={`${styles.paperPanel} ${styles.fullDetailsCard}`}>
          <section>
            <p className={styles.eyebrow}>About The Contest</p>
            <p className={styles.bodyText}>
              {contest.description ||
                contest.short_description ||
                'Complete contest details will be posted here soon.'}
            </p>
          </section>

          <section>
            <p className={styles.eyebrow}>Prizes</p>
            <dl className={styles.rulesList}>
              <div><dt>1st Place</dt><dd>{contest.prize_first_place || 'To be announced'}</dd></div>
              {contest.prize_second_place ? (
                <div><dt>2nd Place</dt><dd>{contest.prize_second_place}</dd></div>
              ) : null}
            </dl>
          </section>

          {contest.how_it_works?.length ? (
            <section>
              <p className={styles.eyebrow}>How Voting Works</p>
              <ul className={styles.rulesBullets}>
                {contest.how_it_works.map((step, index) => (
                  <li key={`${step.title}-${index}`}>{step.title}: {step.body}</li>
                ))}
              </ul>
            </section>
          ) : null}

          <section>
            <p className={styles.eyebrow}>Key Dates</p>
            <dl className={styles.rulesList}>
              <div>
                <dt>{nomineeCopy.periodLabel}</dt>
                <dd>{formatDate(contest.submissions_open_at)} - {formatDate(contest.submissions_close_at)}</dd>
              </div>
              <div>
                <dt>Community Voting</dt>
                <dd>{formatDate(contest.voting_open_at)} - {formatDate(contest.voting_close_at)}</dd>
              </div>
              <div>
                <dt>Winners Announced</dt>
                <dd>{formatDate(contest.results_published_at || contest.results_target_at || contest.voting_close_at)}</dd>
              </div>
            </dl>
          </section>

          <section>
            <p className={styles.eyebrow}>Additional Rules</p>
            <p className={styles.bodyText}>
              {contest.rules_markdown || 'Complete contest rules will be posted here before voting opens.'}
            </p>
          </section>
        </article>
      </div>
    </main>
  )
}
