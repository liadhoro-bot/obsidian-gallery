import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import DashboardTopBar from '../dashboard/dashboard-top-bar'
import MobileNav from '../components/MobileNav'
import { createClient } from '../../utils/supabase/server'
import ProjectsTabs from './projects-tabs'
import { addProject } from './actions'
import { ProjectWithImage } from './project-library'

export default async function ProjectsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: projects, error: projectsError } = await supabase
    .from('projects')
    .select(`
      id,
      name,
      description,
      created_at
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (projectsError) {
    throw new Error(projectsError.message)
  }

  const projectIds = (projects ?? []).map((project) => project.id)

  let featuredImagesByProjectId: Record<
    string,
    {
      image_url: string
      alt_text: string | null
    }
  > = {}

  if (projectIds.length > 0) {
    const { data: images, error: imagesError } = await supabase
      .from('image_assets')
      .select(`
        entity_id,
        image_url,
        alt_text,
        is_featured,
        created_at
      `)
      .eq('entity_type', 'project')
      .eq('user_id', user.id)
      .in('entity_id', projectIds)
      .order('created_at', { ascending: true })

    if (imagesError) {
      throw new Error(imagesError.message)
    }

    for (const projectId of projectIds) {
      const projectImages = (images ?? []).filter(
        (image) => image.entity_id === projectId
      )

      const primaryImage =
        projectImages.find((image) => image.is_featured) ||
        projectImages[0] ||
        null

      if (primaryImage) {
        featuredImagesByProjectId[projectId] = {
          image_url: primaryImage.image_url,
          alt_text: primaryImage.alt_text,
        }
      }
    }
  }

  const projectsWithImages: ProjectWithImage[] = (projects ?? []).map(
    (project) => ({
      ...project,
      primaryImage: featuredImagesByProjectId[project.id] || null,
    })
  )

  return (
    <main className="min-h-screen bg-[#081018] text-white">
      <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 pb-24 pt-5">
        <Suspense fallback={null}>
          <DashboardTopBar />
        </Suspense>

        <header>
          <p className="text-sm uppercase tracking-[0.2em] text-cyan-400">
            Obsidian Gallery
          </p>
          <h1 className="mt-2 text-3xl font-bold">Projects</h1>
          <p className="mt-2 text-sm text-neutral-400">
            Track armies, units, and painting progress across your collection.
          </p>
        </header>

        <ProjectsTabs
          projects={projectsWithImages}
          addProjectAction={addProject}
        />
      </div>

      <MobileNav />
    </main>
  )
}