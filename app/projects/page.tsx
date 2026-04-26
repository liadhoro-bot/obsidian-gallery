import { Suspense } from 'react'
import DashboardTopBar from '../dashboard/dashboard-top-bar'
import MobileNav from '../components/MobileNav'
import { createClient } from '../../utils/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import ProjectsPageClient from '../projects-page-client'

type ProjectWithImage = {
  id: string
  name: string
  description: string | null
  created_at: string
  primaryImage: {
    image_url: string
    alt_text: string | null
  } | null
}

export default async function ProjectsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  async function addProject(formData: FormData) {
    'use server'

    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect('/login')
    }

    const name = formData.get('name')?.toString().trim()
    const descriptionRaw = formData.get('description')?.toString().trim()

    if (!name) {
      throw new Error('Project name is required')
    }

const { error } = await supabase.from('projects').insert([
  {
    user_id: user.id,
    name,
    description: descriptionRaw || null,
  },
])

    if (error) {
      throw new Error(error.message || 'Failed to create project')
    }

    revalidatePath('/')
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

  const projectsWithImages: ProjectWithImage[] = (projects ?? []).map((project) => ({
    ...project,
    primaryImage: featuredImagesByProjectId[project.id] || null,
  }))

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

        <div className="mt-4">
          <ProjectsPageClient addProjectAction={addProject} />
        </div>
      </header>

      <section className="rounded-2xl border border-neutral-800 bg-gradient-to-br from-neutral-900 to-neutral-950 p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-wider text-cyan-400">
              Project Library
            </p>
            <h2 className="mt-1 text-xl font-semibold">All Projects</h2>
          </div>
        </div>

        {projectsWithImages.length > 0 ? (
          <div className="mt-5 grid gap-4">
            {projectsWithImages.map((project) => (
              <a
                key={project.id}
                href={`/projects/${project.id}`}
                className="block overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/80 transition hover:border-cyan-500"
              >
                {project.primaryImage ? (
                  <div className="overflow-hidden border-b border-neutral-800">
                    <img
                      src={project.primaryImage.image_url}
                      alt={project.primaryImage.alt_text || project.name}
                      className="h-40 w-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="flex h-40 w-full items-center justify-center border-b border-neutral-800 bg-neutral-950 text-sm text-neutral-500">
                    No featured image
                  </div>
                )}

                <div className="p-4">
                  <h3 className="text-lg font-semibold text-cyan-400">
                    {project.name}
                  </h3>

                  <p className="mt-3 line-clamp-3 text-sm text-neutral-400">
                    {project.description || 'No description'}
                  </p>
                </div>
              </a>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-neutral-400">
            No projects yet. Create your first project to get started.
          </p>
        )}
      </section>
    </div>

    <MobileNav />
  </main>
)
}