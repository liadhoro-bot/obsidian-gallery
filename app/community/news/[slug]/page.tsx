import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { NewsArticleView, NewsPageHeader, NewsPageShell } from '../news-components'
import { newsArticleHref } from '../news-data'
import { getPublishedNewsArticle } from '../news-queries'

type PageProps = { params: Promise<{ slug: string }> }

const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const article = await getPublishedNewsArticle(slug)
  if (!article) return { title: 'News | Obsidian Gallery' }

  return {
    metadataBase: productionHost ? new URL(`https://${productionHost}`) : undefined,
    title: `${article.headline} | Obsidian Gallery`,
    description: article.summary.slice(0, 160),
    alternates: { canonical: newsArticleHref(article.slug) },
    openGraph: {
      type: 'article',
      title: article.headline,
      description: article.summary.slice(0, 200),
      url: newsArticleHref(article.slug),
      publishedTime: article.publishedAt ?? undefined,
      images: article.imageUrl ? [article.imageUrl] : undefined,
    },
  }
}

export default async function NewsArticlePage({ params }: PageProps) {
  const { slug } = await params
  const article = await getPublishedNewsArticle(slug)
  if (!article) notFound()

  return (
    <NewsPageShell>
      <NewsPageHeader backHref="/community/news" backLabel="Back to news" title="News" />
      <NewsArticleView article={article} />
    </NewsPageShell>
  )
}
