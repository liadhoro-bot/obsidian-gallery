import { redirect } from 'next/navigation'
import GuidesV3Preview from './guides-v3-preview'

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

  return <GuidesV3Preview />
}
