import type { SupabaseClient } from '@supabase/supabase-js'

type GalleryAccess = {
  viewer: SupabaseClient
  viewerId: string | null
  canViewContest: () => Promise<boolean>
  createService: () => SupabaseClient
}

// Call only on the server. Privileged reads are scoped to a visible nomination,
// its current source owner, and that source's image assets.
export async function loadNominationGallery(
  contestId: string,
  nominationId: string,
  access: GalleryAccess
) {
  if (!(await access.canViewContest())) return []

  const { data: nomination, error } = await access.viewer
    .from('contest_nominations')
    .select('status, owner_user_id, source_type, source_project_id, source_unit_id')
    .eq('contest_id', contestId)
    .eq('id', nominationId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!nomination) return []
  if (nomination.status !== 'approved' && nomination.owner_user_id !== access.viewerId) return []

  const type = nomination.source_type
  if (type !== 'project' && type !== 'unit') return []
  const sourceId = type === 'project' ? nomination.source_project_id : nomination.source_unit_id
  if (!sourceId) return []

  const service = access.createService()
  const { data: source, error: sourceError } = await service
    .from(type === 'project' ? 'projects' : 'units')
    .select('id')
    .eq('id', sourceId)
    .eq('user_id', nomination.owner_user_id)
    .maybeSingle()
  if (sourceError) throw new Error(sourceError.message)
  if (!source) return []

  const { data: images, error: imageError } = await service
    .from('image_assets')
    .select('id, image_url, alt_text, is_featured, created_at')
    .eq('entity_type', type)
    .eq('entity_id', sourceId)
    .eq('user_id', nomination.owner_user_id)
    .order('is_featured', { ascending: false })
    .order('created_at', { ascending: true })
  if (imageError) throw new Error(imageError.message)
  return (images ?? []) as Array<{
    id: string
    image_url: string
    alt_text: string | null
    is_featured: boolean
    created_at: string
  }>
}
