import { NewsPageHeader, NewsPageShell } from './news-components'

export default function NewsLoading() {
  return (
    <NewsPageShell>
      <NewsPageHeader backHref="/community/news" backLabel="Back to news" title="News" />
      <p data-v3-community-indicator="events-empty" role="status">
        Loading news…
      </p>
    </NewsPageShell>
  )
}
