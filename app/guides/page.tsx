import { redirect } from 'next/navigation'
import GuidesV3Preview from './guides-v3-preview'
import { hasV3PreviewSession } from '../../lib/v3-preview-server'

type GuidesPageProps = {
  searchParams?: Promise<{
    preview?: string
  }>
}

export default async function GuidesPage({ searchParams }: GuidesPageProps) {
  const params = searchParams ? await searchParams : undefined
  const isPreview = await hasV3PreviewSession(params?.preview)

  if (!isPreview) {
    redirect('/recipes')
  }

  return <GuidesV3Preview />
}
