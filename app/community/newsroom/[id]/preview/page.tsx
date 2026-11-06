import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { NewsArticleView, NewsPageHeader, NewsPageShell } from '../../../news/news-components'
import { getNewsroomArticle } from '../../../news/news-queries'
import styles from '../../../news/news.module.css'
import { requireNewsroomAccess } from '../../guard'

export const metadata: Metadata = { title: 'Preview | Obsidian Gallery', robots: { index: false } }

export default async function NewsArticlePreviewPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireNewsroomAccess()
  const { id } = await params
  const article = await getNewsroomArticle(id)
  if (!article) notFound()

  return (
    <NewsPageShell>
      <NewsPageHeader
        backHref={`/community/newsroom/${article.id}`}
        backLabel="Back to editor"
        title="Preview"
      />
      <p className={styles.previewNotice}>Preview of the last saved version.</p>
      <NewsArticleView article={article} preview />
    </NewsPageShell>
  )
}
