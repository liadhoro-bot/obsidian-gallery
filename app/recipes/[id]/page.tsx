import { redirect } from 'next/navigation'

export default async function RecipeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/guides/decks/${id}`)
}
