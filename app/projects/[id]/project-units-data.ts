import type { SupabaseClient } from '@supabase/supabase-js'
import type { ProjectUnit } from './types'

type ProjectSupabaseClient = SupabaseClient
type ProjectDetailTab = 'details' | 'units'

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))))
}

export async function getProjectUnits(
  supabase: ProjectSupabaseClient,
  projectId: string,
  userId: string,
  activeTab: ProjectDetailTab
) {
  const [directUnitsResult, linkedUnitsResult] = await Promise.all([
    supabase
      .from('units')
      .select('id')
      .eq('project_id', projectId)
      .eq('user_id', userId),
    supabase
      .from('unit_projects')
      .select('unit_id')
      .eq('project_id', projectId)
      .eq('user_id', userId),
  ])

  const lookupError = directUnitsResult.error || linkedUnitsResult.error
  if (lookupError) {
    return {
      ids: [],
      units: [] as ProjectUnit[],
      error: lookupError,
    }
  }

  const candidateUnitIds = uniqueStrings([
    ...((directUnitsResult.data ?? []) as Array<{ id: string | null }>).map(
      (unit) => unit.id
    ),
    ...((linkedUnitsResult.data ?? []) as Array<{ unit_id: string | null }>).map(
      (link) => link.unit_id
    ),
  ])

  if (candidateUnitIds.length === 0) {
    return {
      ids: [],
      units: [] as ProjectUnit[],
      error: null,
    }
  }

  // Fetch the displayed rows during the ownership/active check instead of
  // repeating the same units lookup later. Details only needs the IDs/count.
  const query = activeTab === 'units'
    ? supabase.from('units').select('id, name, notes, created_at, updated_at, project_id, status, is_active')
    : supabase.from('units').select('id')
  const { data, error } = await query
    .eq('user_id', userId)
    .eq('is_active', true)
    .in('id', candidateUnitIds)

  return {
    ids: (data ?? []).map((unit) => unit.id).filter((id): id is string => Boolean(id)),
    units: activeTab === 'units'
      ? ([...(data ?? [])] as Array<ProjectUnit & { created_at: string | null }>).sort((a, b) => {
          // Match the former display query without changing which IDs the
          // ownership lookup returns when PostgREST applies its row limit.
          if (a.created_at === b.created_at) return 0
          if (a.created_at === null) return -1
          if (b.created_at === null) return 1
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        })
      : [],
    error,
  }
}
