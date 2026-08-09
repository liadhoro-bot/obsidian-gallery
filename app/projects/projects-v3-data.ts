import { cache } from 'react'
import { createClient } from '../../utils/supabase/server'
import {
  getDashboardPaintingTableFeed,
  type DashboardFeedUnit,
} from '../dashboard/dashboard-data'

export type ProjectsV3Project = {
  id: string
  name: string
  description: string
  type: string
  due?: string
  image: string
  palette: string[]
}

export type ProjectsV3Unit = {
  id: string
  name: string
  projectId: string
  image: string
  status: string
  progress: number
  stage: string
  deadline: string
  logged: string
  updatedAt: string
  modelCount: number
  palette: string[]
}

export type ProjectsV3Payload = {
  projects: ProjectsV3Project[]
  units: ProjectsV3Unit[]
}

type ProjectRow = {
  id: string
  name: string | null
  description: string | null
  created_at: string
}

type ProjectImageRow = {
  entity_id: string
  image_url: string
  is_featured: boolean | null
  created_at: string
}

type UnitProjectRow = {
  unit_id: string
  project_id: string
}

type UnitProjectIdRow = {
  id: string
  project_id: string | null
}

const fallbackProjectImage = '/onboarding/pains/fragmentation.jpeg'
const fallbackUnitImage = '/onboarding/first-project-bg.jpeg'
const unfiledProjectId = 'unfiled'

const projectPalettes = [
  ['#173235', '#264a56', '#d7c399', '#8f9fd9', '#111417'],
  ['#37665b', '#d6a73a', '#e1c58d', '#7a5d37', '#171815'],
  ['#8f9fd9', '#17b9c2', '#a92322', '#d8bd83', '#111417'],
  ['#d6a73a', '#d29631', '#243447', '#17b9c2', '#111417'],
]

const unitPalette = ['#a92322', '#d6b84d', '#171821', '#e1c58d', '#72c888']

function getPalette(seed: string) {
  const total = seed.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)
  return projectPalettes[total % projectPalettes.length] ?? projectPalettes[0]
}

function formatStatus(status: DashboardFeedUnit['status']) {
  if (status === 'complete') return 'Complete'
  if (status === 'bench') return 'Bench'
  if (status === 'pile') return 'Pile'
  if (status === 'other') return 'Other'
  return 'Active'
}

function formatStage(progress: number, status: DashboardFeedUnit['status']) {
  if (status === 'complete' || progress >= 100) return 'Done'
  if (progress <= 0) return 'Planning'
  return `Stage ${Math.max(1, Math.ceil(progress / 20))}/5`
}

function formatDeadline(value: string | null | undefined) {
  if (!value) return 'No deadline'
  return value
}

function formatLogged() {
  return 'Open'
}

export const getProjectsV3Payload = cache(async (userId: string) => {
  const supabase = await createClient()
  const [projectsResult, feed, directUnitProjectsResult, linkedUnitProjectsResult] =
    await Promise.all([
      supabase
        .from('projects')
        .select('id, name, description, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
      getDashboardPaintingTableFeed(userId),
      supabase
        .from('units')
        .select('id, project_id')
        .eq('user_id', userId),
      supabase
        .from('unit_projects')
        .select('unit_id, project_id')
        .eq('user_id', userId),
    ])

  if (projectsResult.error) {
    throw new Error(projectsResult.error.message)
  }

  const projectRows = (projectsResult.data ?? []) as ProjectRow[]
  const projectIds = projectRows.map((project) => project.id)
  const projectImageMap = new Map<string, string>()

  if (projectIds.length > 0) {
    const { data, error } = await supabase
      .from('image_assets')
      .select('entity_id, image_url, is_featured, created_at')
      .eq('entity_type', 'project')
      .eq('user_id', userId)
      .in('entity_id', projectIds)
      .order('created_at', { ascending: true })

    if (error) {
      throw new Error(error.message)
    }

    const featuredProjectIds = new Set<string>()

    for (const image of (data ?? []) as ProjectImageRow[]) {
      const hasImage = projectImageMap.has(image.entity_id)
      if (hasImage && (!image.is_featured || featuredProjectIds.has(image.entity_id))) {
        continue
      }

      if (image.is_featured) {
        featuredProjectIds.add(image.entity_id)
      }

      projectImageMap.set(image.entity_id, image.image_url)
    }
  }

  const unitProjectIds = new Map<string, string[]>()

  for (const row of (directUnitProjectsResult.data ?? []) as UnitProjectIdRow[]) {
    if (!row.project_id) continue
    unitProjectIds.set(row.id, [row.project_id])
  }

  for (const row of (linkedUnitProjectsResult.data ?? []) as UnitProjectRow[]) {
    unitProjectIds.set(row.unit_id, [
      ...(unitProjectIds.get(row.unit_id) ?? []),
      row.project_id,
    ])
  }

  for (const [unitId, ids] of unitProjectIds.entries()) {
    unitProjectIds.set(unitId, Array.from(new Set(ids)))
  }

  const units = feed.units.map((unit) => {
    const linkedProjectIds = unitProjectIds.get(unit.unit_id) ?? []
    const projectId = linkedProjectIds[0] ?? unfiledProjectId
    const progress = Math.max(0, Math.min(100, unit.progress_percent ?? 0))

    return {
      id: unit.unit_id,
      name: unit.name || 'Untitled Unit',
      projectId,
      image: unit.primary_image_url || fallbackUnitImage,
      status: formatStatus(unit.status),
      progress,
      stage: formatStage(progress, unit.status),
      deadline: formatDeadline(unit.deadline),
      logged: formatLogged(),
      updatedAt: unit.updated_at,
      modelCount: 1,
      palette: unitPalette,
    } satisfies ProjectsV3Unit
  })

  const projects = projectRows.map((project) => {
    const projectUnits = units.filter((unit) => unit.projectId === project.id)
    const nearestDeadline = projectUnits
      .map((unit) => unit.deadline)
      .filter((deadline) => deadline !== 'No deadline')
      .sort((first, second) => new Date(first).getTime() - new Date(second).getTime())[0]

    return {
      id: project.id,
      name: project.name || 'Untitled Project',
      description: project.description || 'No description yet.',
      type: 'Project',
      ...(nearestDeadline ? { due: nearestDeadline } : {}),
      image: projectImageMap.get(project.id) || fallbackProjectImage,
      palette: getPalette(project.id),
    } satisfies ProjectsV3Project
  })

  if (units.some((unit) => unit.projectId === unfiledProjectId)) {
    projects.push({
      id: unfiledProjectId,
      name: 'Unfiled Units',
      description: 'Units that are not assigned to a project yet.',
      type: 'Collection',
      image: fallbackProjectImage,
      palette: getPalette(unfiledProjectId),
    })
  }

  return {
    projects,
    units,
  } satisfies ProjectsV3Payload
})
