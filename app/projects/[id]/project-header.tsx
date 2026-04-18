import { createClient } from '../../../utils/supabase/server'

type Props = {
  projectId: string
  userId: string
}

export default async function ProjectHeader({ projectId, userId }: Props) {
  const supabase = await createClient()

  const [{ data: project, error: projectError }, { data: projectImages }] =
    await Promise.all([
      supabase
        .from('projects')
        .select('id, name, description')
        .eq('id', projectId)
        .eq('user_id', userId)
        .single(),
      supabase
        .from('image_assets')
        .select('id, image_url, alt_text, is_featured')
        .eq('entity_type', 'project')
        .eq('entity_id', projectId)
        .eq('user_id', userId)
        .order('created_at', { ascending: true }),
    ])

  const featuredProjectImage =
    (projectImages ?? []).find((image) => image.is_featured) ||
    (projectImages ?? [])[0] ||
    null

  if (projectError) {
    return (
      <pre className="mt-4 whitespace-pre-wrap rounded bg-red-100 p-4 text-sm text-black">
        {JSON.stringify(projectError, null, 2)}
      </pre>
    )
  }

  return (
    <>
      {featuredProjectImage ? (
        <div className="mt-4 overflow-hidden rounded-3xl border border-neutral-800 bg-neutral-900">
          <img
            src={featuredProjectImage.image_url}
            alt={featuredProjectImage.alt_text || project?.name || 'Project image'}
            className="h-64 w-full object-cover"
          />
        </div>
      ) : (
        <div className="mt-4 flex h-64 items-center justify-center rounded-3xl border border-dashed border-neutral-800 bg-neutral-900 text-sm text-neutral-500">
          No featured image yet
        </div>
      )}

      <div className="mt-4 rounded-2xl border border-neutral-800 bg-neutral-900 p-5 shadow-sm">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-400">
          Project Detail
        </p>

        <h1 className="mt-2 text-3xl font-bold text-white">{project?.name}</h1>

        <p className="mt-3 text-sm text-neutral-400">
          {project?.description || 'No description'}
        </p>
      </div>
    </>
  )
}