import type { Metadata } from 'next'
import { NewsPageHeader, NewsPageShell } from '../../news/news-components'
import { requireNewsroomAccess } from '../guard'
import NewsEditor from '../news-editor'

export const metadata: Metadata = { title: 'New article | Obsidian Gallery', robots: { index: false } }

export default async function NewNewsArticlePage() {
  await requireNewsroomAccess()

  return (
    <NewsPageShell>
      <NewsPageHeader backHref="/community/newsroom" backLabel="Back to Newsroom" title="New Article" />
      <NewsEditor article={null} />
    </NewsPageShell>
  )
}
