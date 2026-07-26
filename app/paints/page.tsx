import { redirect } from 'next/navigation'
import PaintsV3Preview from './paints-v3-preview'
import { hasV3PreviewSession } from '../../lib/v3-preview-server'

type PaintsPageProps = {
  searchParams?: Promise<{
    preview?: string
  }>
}

export default async function PaintsPage({ searchParams }: PaintsPageProps) {
  const params = searchParams ? await searchParams : undefined
  const isPreview = await hasV3PreviewSession(params?.preview)

  if (!isPreview) {
    redirect('/vault')
  }

  return <PaintsV3Preview />
}
