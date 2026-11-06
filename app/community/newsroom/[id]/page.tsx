import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { NewsPageHeader, NewsPageShell } from '../../news/news-components'
import { getNewsroomArticle } from '../../news/news-queries'
import { requireNewsroomAccess } from '../guard'
import NewsEditor from '../news-editor'

export const metadata: Metadata = { title: 'Edit article | Obsidian Gallery', robots: { index: false } }

export default async function EditNewsArticlePage({
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
      <NewsPageHeader backHref="/community/newsroom" backLabel="Back to Newsroom" title="Edit Article" />
      <NewsEditor article={article} />
    </NewsPageShell>
  )
}
