import ProjectGalleryClient from './project-gallery-client'
import { createClient } from '../../../utils/supabase/server'

type Props = {
  projectId: string
  userId: string
}

export default async function ProjectGallerySection({ projectId, userId }: Props) {
  const supabase = await createClient()

  const { data: projectImages, error: projectImagesError } = await supabase
    .from('image_assets')
    .select('id, image_url, alt_text, is_featured')
    .eq('entity_type', 'project')
    .eq('entity_id', projectId)
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  return (
    <ProjectGalleryClient
      projectId={projectId}
      projectImages={projectImages ?? []}
      projectImagesError={projectImagesError}
    />
  )
}