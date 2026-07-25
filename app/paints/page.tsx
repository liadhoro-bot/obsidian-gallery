import { redirect } from 'next/navigation'
import V3PreviewPage from '../components/v3-preview-page'

type PaintsPageProps = {
  searchParams?: Promise<{
    preview?: string
  }>
}

export default async function PaintsPage({ searchParams }: PaintsPageProps) {
  const params = searchParams ? await searchParams : undefined
  const isPreview = ['1', 'true'].includes(params?.preview ?? '')

  if (!isPreview) {
    redirect('/vault')
  }

  return (
    <V3PreviewPage
      active="paints"
      eyebrow="Paints"
      title="Your color collection, named like painters actually use it."
      text="Paints is the v3 home for owned colors, wishlists, substitutes, and the supplies needed for the next model."
      primary={{
        href: '/guides?preview=1',
        label: 'Open Guides',
        text: 'Use colors inside repeatable painting processes.',
      }}
      panels={[
        {
          href: '/paints?preview=1',
          label: 'Owned paints',
          text: 'A scan-friendly shelf of every color currently available.',
        },
        {
          href: '/paints?preview=1',
          label: 'Wishlist',
          text: 'Colors to buy, compare, or substitute before a project starts.',
        },
        {
          href: '/themes?preview=1',
          label: 'Theme links',
          text: 'Connect paints to palettes, armies, and visual concepts.',
        },
      ]}
    />
  )
}
