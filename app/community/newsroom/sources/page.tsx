import type { Metadata } from 'next'
import { NewsPageHeader, NewsPageShell } from '../../news/news-components'
import { formatNewsAge } from '../../news/news-data'
import styles from '../../news/news.module.css'
import { requireNewsroomAccess } from '../guard'
import { getNewsSources } from '../inbox-queries'
import { NewsroomTabs } from '../newsroom-tabs'
import SourceActions from '../source-actions'

export const metadata: Metadata = { title: 'News sources | Obsidian Gallery', robots: { index: false } }

// "Collect now" runs a whole collection inside a Server Action.
export const maxDuration = 60

const methodLabels: Record<string, string> = {
  feed: 'RSS/Atom feed',
  sitemap: 'Sitemap and page metadata',
  html_listing: 'Listing page',
  release_page: 'Release page',
}

const permissionLabels: Record<string, string> = {
  unverified: 'Not checked yet',
  terms_allow: 'Allowed by their terms',
  written_permission: 'Written permission',
  denied: 'Not allowed',
}

function hours(minutes: number) {
  return minutes % 60 === 0 ? `${minutes / 60}h` : `${minutes} min`
}

export default async function NewsSourcesPage() {
  await requireNewsroomAccess()
  const sources = await getNewsSources()

  return (
    <NewsPageShell>
      <NewsPageHeader backHref="/community?tab=news" backLabel="Back to community" title="Newsroom" />
      <NewsroomTabs active="sources" />

      {sources.length === 0 ? (
        <p data-v3-community-indicator="events-empty">The sources couldn&apos;t be loaded. Try again.</p>
      ) : null}

      {sources.map((source) => (
        <section key={source.id} data-v3-community-indicator="section-card" className={styles.sourceCard}>
          <span className={styles.newsroomRowTop}>
            <span className={styles.rowHeadline}>{source.name}</span>
            <span className={styles.statusPill} data-status={source.enabled ? 'on' : 'off'}>
              {source.enabled ? 'On' : 'Off'}
            </span>
          </span>

          <dl className={styles.sourceFacts}>
            <dt>Covers</dt>
            <dd>{source.coverage ?? '—'}</dd>
            <dt>Method</dt>
            <dd>
              {methodLabels[source.discoveryMethod] ?? source.discoveryMethod}, every{' '}
              {hours(source.pollIntervalMinutes)}
            </dd>
            <dt>Address</dt>
            <dd>
              <a href={source.listingUrl} target="_blank" rel="noopener noreferrer">
                {source.listingUrl}
              </a>
            </dd>
            <dt>Collection</dt>
            <dd>{permissionLabels[source.collectionPermission] ?? source.collectionPermission}</dd>
            <dt>Last success</dt>
            <dd>{source.lastSuccessAt ? formatNewsAge(source.lastSuccessAt) : 'Never'}</dd>
            {source.failureCount > 0 ? (
              <>
                <dt>Failures</dt>
                <dd>
                  {source.consecutiveFailures} in a row, {source.failureCount} in total
                </dd>
              </>
            ) : null}
          </dl>

          {source.permissionNotes ? <p className={styles.inboxNote}>{source.permissionNotes}</p> : null}
          {source.lastError && source.consecutiveFailures > 0 ? (
            <p className={styles.sourceError}>Last error: {source.lastError}</p>
          ) : null}

          {source.recentRuns.length > 0 ? (
            <ul className={styles.runList} aria-label={`Recent runs for ${source.name}`}>
              {source.recentRuns.map((run) => (
                <li key={run.id}>
                  <span className={styles.statusPill} data-status={run.status}>
                    {run.status}
                  </span>
                  <span>
                    {formatNewsAge(run.startedAt)} · {run.trigger === 'manual' ? 'by hand' : 'scheduled'}
                    {run.status === 'succeeded' ? ` · ${run.itemsNew} new, ${run.itemsDuplicate} known` : ''}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}

          <SourceActions sourceId={source.id} enabled={source.enabled} />
        </section>
      ))}
    </NewsPageShell>
  )
}
