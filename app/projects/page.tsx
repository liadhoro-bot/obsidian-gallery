import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import DashboardTopBar from '../dashboard/dashboard-top-bar'
import { createClient } from '../../utils/supabase/server'
import ProjectsTabs from './projects-tabs'
import { addProject } from './actions'
import { ProjectWithImage } from './project-library'
import { createPerfTimer } from '../../utils/perf/server'
import { getDashboardProfile } from '../dashboard/dashboard-data'

type ProjectsPageProps = {
  searchParams: Promise<{
    tab?: string
  }>
}

async function ProjectsTabsContent({
  userId,
  activeTab,
}: {
  userId: string
  activeTab: 'mine' | 'create'
}) {
  const perf = createPerfTimer('/projects:content')
  const supabase = await createClient()
  let projectsWithImages: ProjectWithImage[] = []

  if (activeTab === 'mine') {
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select(`
        id,
        name,
        description,
        created_at
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (projectsError) {
      throw new Error(projectsError.message)
    }
    perf.mark('main Supabase query')

    const projectIds = (projects ?? []).map((project) => project.id)
    const featuredImagesByProjectId: Record<
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
        .eq('user_id', userId)
        .in('entity_id', projectIds)
        .order('created_at', { ascending: true })

      if (imagesError) {
        throw new Error(imagesError.message)
      }

      const featuredProjectIds = new Set<string>()

      for (const image of images ?? []) {
        const existingImage = featuredImagesByProjectId[image.entity_id]
        if (
          existingImage &&
          (!image.is_featured || featuredProjectIds.has(image.entity_id))
        ) {
          continue
        }

        if (image.is_featured) {
          featuredProjectIds.add(image.entity_id)
        }

        featuredImagesByProjectId[image.entity_id] = {
          image_url: image.image_url,
          alt_text: image.alt_text,
        }
      }
    }
    perf.mark('image/gallery queries')

    projectsWithImages = (projects ?? []).map((project) => ({
      ...project,
      primaryImage: featuredImagesByProjectId[project.id] || null,
    }))
  }

  perf.total()

  return (
    <ProjectsTabs
      activeTab={activeTab}
      projects={projectsWithImages}
      addProjectAction={addProject}
    />
  )
}

function ProjectsTabsSkeleton() {
  return (
    <div className="grid gap-5 animate-pulse">
      <div className="grid grid-cols-2 rounded-2xl border border-white/10 bg-slate-950/70 p-1">
        <div className="h-10 rounded-xl bg-white/10" />
        <div className="h-10 rounded-xl bg-white/10" />
      </div>

      <section className="rounded-2xl border border-neutral-800 bg-gradient-to-br from-neutral-900 to-neutral-950 p-5">
        <div className="h-4 w-32 rounded bg-neutral-800" />
        <div className="mt-3 h-6 w-36 rounded bg-neutral-800" />
        <div className="mt-5 grid gap-4">
          {Array.from({ length: 2 }).map((_, index) => (
            <div
              key={index}
              className="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/80"
            >
              <div className="h-40 bg-neutral-800" />
              <div className="p-4">
                <div className="h-5 w-32 rounded bg-neutral-800" />
                <div className="mt-3 h-4 w-full rounded bg-neutral-800" />
                <div className="mt-2 h-4 w-4/5 rounded bg-neutral-800" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

export default async function ProjectsPage({ searchParams }: ProjectsPageProps) {
  const perf = createPerfTimer('/projects')
  const supabase = await createClient()
  const resolvedSearchParams = await searchParams
  const activeTab = resolvedSearchParams.tab === 'create' ? 'create' : 'mine'

  const {
    data: { user },
  } = await supabase.auth.getUser()
  perf.mark('auth/session fetch')

  if (!user) {
    redirect('/login')
  }

  const profilePromise = (async () => ({
    data: await getDashboardProfile(user.id),
  }))()
  perf.total()

  return (
    <main className="min-h-screen bg-[#081018] text-white">
      <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 pb-24 pt-5">
        <Suspense fallback={null}>
          <DashboardTopBar userId={user.id} profilePromise={profilePromise} />
        </Suspense>

        <header>
          <h1 className="text-3xl font-bold">Projects</h1>
          <p className="mt-2 text-sm font-medium text-neutral-200">
            Plan and organize your painting campaigns
          </p>
          <p className="mt-2 text-sm leading-6 text-neutral-400">
            Projects group related units into a single collection - whether
            it&apos;s an army, warband, or display force. Use Projects to organize
            your units, track deadlines, manage palettes, organize your units,
            and collect inspiration, reference images, and showcase photos.
          </p>
        </header>

        <Suspense fallback={<ProjectsTabsSkeleton />}>
          <ProjectsTabsContent userId={user.id} activeTab={activeTab} />
        </Suspense>
      </div>
    </main>
  )
}
