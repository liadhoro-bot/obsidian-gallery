import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import DashboardTopBar from '../dashboard/dashboard-top-bar'
import { createClient, getSessionUser } from '../../utils/supabase/server'
import ProjectsTabs from './projects-tabs'
import { addProject } from './actions'
import { ProjectWithImage } from './project-library'
import { createPerfTimer } from '../../utils/perf/server'
import { getDashboardProfile } from '../dashboard/dashboard-data'
import ProjectsV3Preview from './projects-v3-preview'
import { hasV3PreviewSession } from '../../lib/v3-preview-server'
import { getProjectsV3Payload } from './projects-v3-data'
import { getFeatureGuidesForPage } from '../components/feature-guide-data'
import { projectsFeatureGuides } from '../components/feature-guide-presets'

type ProjectsPageProps = {
  searchParams: Promise<{
    preview?: string
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
    <div className="grid gap-3 animate-pulse">
      <div className="grid grid-cols-2 rounded-[8px] border border-white/[0.04] bg-white/[0.055] p-0.5">
        <div className="h-9 rounded-[6px] bg-[#101822]" />
        <div className="h-9 rounded-[6px] bg-white/[0.045]" />
      </div>

      <div className="grid gap-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <section
            key={index}
            className="overflow-hidden rounded-[8px] border border-white/[0.055] bg-[#111821]"
          >
            <div className="relative h-[112px] bg-white/[0.055]">
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                <div className="h-4 w-40 rounded bg-white/16" />
              </div>
            </div>
            <div className="px-3 py-2.5">
              <div className="h-1 rounded-full bg-white/[0.08]">
                <div className="h-full w-1/3 rounded-full bg-cyan-300/75" />
              </div>
              <div className="mt-2 flex items-center justify-between">
                <div className="h-4 w-16 rounded-full bg-white/10" />
                <div className="h-3 w-12 rounded bg-white/10" />
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

export default async function ProjectsPage({ searchParams }: ProjectsPageProps) {
  const perf = createPerfTimer('/projects')
  const resolvedSearchParams = await searchParams
  const isPreview = await hasV3PreviewSession(resolvedSearchParams.preview)

  const supabase = await createClient()
  const activeTab = resolvedSearchParams.tab === 'create' ? 'create' : 'mine'

  const user = await getSessionUser(supabase)
  perf.mark('auth/session fetch')

  if (!user) {
    redirect(
      isPreview
        ? '/login?next=%2Fprojects%3Fpreview%3D1&preview=1'
        : '/login'
    )
  }

  if (isPreview) {
    const [payload, featureGuides] = await perf.measure('v3 projects data', () =>
      Promise.all([
        getProjectsV3Payload(user.id),
        getFeatureGuidesForPage('/projects', projectsFeatureGuides),
      ])
    )

    perf.total()
    return (
      <ProjectsV3Preview
        featureGuides={featureGuides}
        initialProjects={payload.projects}
        initialUnits={payload.units}
      />
    )
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
