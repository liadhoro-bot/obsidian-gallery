import { redirect } from 'next/navigation'
import V3PreviewPage from '../components/v3-preview-page'

type GuidesPageProps = {
  searchParams?: Promise<{
    preview?: string
  }>
}

export default async function GuidesPage({ searchParams }: GuidesPageProps) {
  const params = searchParams ? await searchParams : undefined
  const isPreview = ['1', 'true'].includes(params?.preview ?? '')

  if (!isPreview) {
    redirect('/recipes')
  }

  return (
    <V3PreviewPage
      active="guides"
      eyebrow="Guides"
      title="Painting knowledge as reusable guides."
      text="Guides is the v3 home for creation, discovery, and a personal library of painting processes."
      primary={{
        href: '/paints?preview=1',
        label: 'Open Paints',
        text: 'Reference colors while building guide steps.',
      }}
      panels={[
        {
          href: '/guides?preview=1',
          label: 'My guides',
          text: 'Draft, private, and published painting processes.',
        },
        {
          href: '/guides?preview=1',
          label: 'Discover',
          text: 'Community guides for techniques, schemes, and model types.',
        },
        {
          href: '/projects?preview=1',
          label: 'Assign to projects',
          text: 'Use a guide as the working plan for a unit or project.',
        },
      ]}
    />
  )
}
