import { redirect } from 'next/navigation'
import PaintsV3Preview from './paints-v3-preview'

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

  return <PaintsV3Preview />
}
