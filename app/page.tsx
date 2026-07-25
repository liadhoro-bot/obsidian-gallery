import { redirect } from 'next/navigation'

type HomePageProps = {
  searchParams?: Promise<{
    preview?: string
  }>
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = searchParams ? await searchParams : undefined
  const isPreview = ['1', 'true'].includes(params?.preview ?? '')

  if (isPreview) {
    redirect('/login?preview=1')
  }

  redirect('/dashboard')
}
