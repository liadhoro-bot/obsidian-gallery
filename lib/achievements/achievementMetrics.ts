import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

export type AchievementMetricSnapshot = {
  metrics: Record<string, number>
  unsupportedTriggers: Set<string>
  sessions: Array<{
    created_at: string | null
    duration_seconds: number | null
    unit_id: string | null
  }>
}

const TIME_ZONE = 'Asia/Jerusalem'

type CountQuery = PromiseLike<{ count: number | null; error: unknown }> & {
  eq(column: string, value: unknown): CountQuery
  in(column: string, values: readonly unknown[]): CountQuery
  neq(column: string, value: unknown): CountQuery
}

async function safeCount(
  supabase: SupabaseClient,
  table: string,
  apply: (query: CountQuery) => PromiseLike<{ count: number | null; error: unknown }>
) {
  try {
    const query = supabase
      .from(table)
      .select('id', { count: 'exact', head: true }) as unknown as CountQuery
    const result = await apply(query)
    if (result.error) return null
    return result.count ?? 0
  } catch (error) {
    console.error(`[achievements] Could not count ${table}`, error)
    return null
  }
}

function getDateKeyInTimezone(value: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value))

  return `${parts.find((part) => part.type === 'year')?.value}-${parts.find((part) => part.type === 'month')?.value}-${parts.find((part) => part.type === 'day')?.value}`
}

function countCurrentConsecutiveDays(dayKeys: Set<string>) {
  let streak = 0
  const cursor = new Date()

  while (true) {
    const key = getDateKeyInTimezone(cursor.toISOString())
    if (!dayKeys.has(key)) break
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }

  return streak
}

function countPaintingDaysInWindow(dayKeys: Set<string>, windowDays: number) {
  const cursor = new Date()
  let count = 0

  for (let index = 0; index < windowDays; index += 1) {
    if (dayKeys.has(getDateKeyInTimezone(cursor.toISOString()))) {
      count += 1
    }
    cursor.setDate(cursor.getDate() - 1)
  }

  return count
}

function countWeeklyPaintingStreak(dayKeys: Set<string>) {
  let streak = 0
  const cursor = new Date()

  while (true) {
    const weekEnd = new Date(cursor)
    const weekStart = new Date(cursor)
    weekStart.setDate(weekStart.getDate() - 6)

    let weekHasSession = false
    const weekCursor = new Date(weekEnd)
    for (let index = 0; index < 7; index += 1) {
      if (dayKeys.has(getDateKeyInTimezone(weekCursor.toISOString()))) {
        weekHasSession = true
        break
      }
      weekCursor.setDate(weekCursor.getDate() - 1)
    }

    if (!weekHasSession) break
    streak += 1
    cursor.setDate(weekStart.getDate() - 1)
  }

  return streak
}

export function getSessionDerivedMetrics(
  sessions: AchievementMetricSnapshot['sessions']
) {
  const qualifyingDayKeys = new Set(
    sessions
      .filter((session) => (session.duration_seconds ?? 0) >= 60)
      .map((session) =>
        session.created_at ? getDateKeyInTimezone(session.created_at) : null
      )
      .filter((key): key is string => Boolean(key))
  )

  return {
    paintingMinutesTotal: Math.floor(
      sessions.reduce(
        (total, session) => total + (session.duration_seconds ?? 0),
        0
      ) / 60
    ),
    consecutivePaintingDays: countCurrentConsecutiveDays(qualifyingDayKeys),
    paintingDaysInWindow: (windowDays: number) =>
      countPaintingDaysInWindow(qualifyingDayKeys, windowDays),
    weeklyPaintingStreak: countWeeklyPaintingStreak(qualifyingDayKeys),
  }
}

export async function calculateAchievementMetrics(
  supabase: SupabaseClient,
  userId: string
): Promise<AchievementMetricSnapshot> {
  const unsupportedTriggers = new Set<string>()

  const [
    unitsCreated,
    unitsCompleted,
    sessionsResult,
    progressPhotos,
    ownedPaints,
    customPaints,
    guidesCreated,
    guidesPublished,
    contestParticipations,
    contestVotes,
  ] = await Promise.all([
    safeCount(supabase, 'units', (query) => query.eq('user_id', userId)),
    safeCount(supabase, 'units', (query) =>
      query.eq('user_id', userId).eq('status', 'complete')
    ),
    supabase
      .from('unit_sessions')
      .select('unit_id, created_at, duration_seconds')
      .eq('user_id', userId),
    safeCount(supabase, 'image_assets', (query) =>
      query.eq('user_id', userId).eq('entity_type', 'unit')
    ),
    safeCount(supabase, 'user_paint_ownership', (query) =>
      query.eq('user_id', userId).eq('is_owned', true)
    ),
    safeCount(supabase, 'paints', (query) => query.eq('user_id', userId)),
    safeCount(supabase, 'recipes', (query) => query.eq('user_id', userId)),
    safeCount(supabase, 'recipes', (query) =>
      query.eq('user_id', userId).eq('is_public', true)
    ),
    safeCount(supabase, 'contest_nominations', (query) =>
      query.eq('owner_user_id', userId).in('status', ['pending', 'approved'])
    ),
    safeCount(supabase, 'contest_ballots', (query) =>
      query.eq('voter_user_id', userId).eq('status', 'submitted')
    ),
  ])

  const sessions = sessionsResult.error
    ? []
    : ((sessionsResult.data ?? []) as AchievementMetricSnapshot['sessions'])
  if (sessionsResult.error) {
    console.error('[achievements] Could not load unit_sessions', sessionsResult.error)
  }

  const unitIdsResult = await supabase
    .from('units')
    .select('id')
    .eq('user_id', userId)
  const unitIds =
    unitIdsResult.error || !unitIdsResult.data
      ? []
      : unitIdsResult.data.map((unit: { id: string }) => unit.id)

  const recipeIdsResult = await supabase
    .from('recipes')
    .select('id')
    .eq('user_id', userId)
  const recipeIds =
    recipeIdsResult.error || !recipeIdsResult.data
      ? []
      : recipeIdsResult.data.map((recipe: { id: string }) => recipe.id)

  const nominationIdsResult = await supabase
    .from('contest_nominations')
    .select('id')
    .eq('owner_user_id', userId)
    .eq('status', 'approved')
  const nominationIds =
    nominationIdsResult.error || !nominationIdsResult.data
      ? []
      : nominationIdsResult.data.map((nomination: { id: string }) => nomination.id)

  const [progressMarks, uniquePaintRows, guideSavesReceived, contestWins] =
    await Promise.all([
      unitIds.length
        ? safeCount(supabase, 'unit_progress_steps', (query) =>
            query.in('unit_id', unitIds).eq('status', 'done')
          )
        : 0,
      supabase
        .from('unit_stage_paints')
        .select('paint_catalog_id, custom_paint_id')
        .eq('user_id', userId),
      recipeIds.length
        ? safeCount(supabase, 'saved_recipes', (query) =>
            query.in('recipe_id', recipeIds).neq('user_id', userId)
          )
        : 0,
      nominationIds.length
        ? safeCount(supabase, 'contest_results', (query) =>
            query.in('nomination_id', nominationIds).eq('final_rank', 1)
          )
        : 0,
    ])

  const uniquePaints = new Set<string>()
  if (!uniquePaintRows.error) {
    for (const paint of (uniquePaintRows.data ?? []) as Array<{
      paint_catalog_id: string | null
      custom_paint_id: string | null
    }>) {
      const key = paint.paint_catalog_id
        ? `catalog:${paint.paint_catalog_id}`
        : paint.custom_paint_id
          ? `custom:${paint.custom_paint_id}`
          : null
      if (key) uniquePaints.add(key)
    }
  }

  const sessionMetrics = getSessionDerivedMetrics(sessions)
  const metrics: Record<string, number> = {
    units_created_total: unitsCreated ?? 0,
    progress_marks_total: progressMarks ?? 0,
    painting_sessions_total: sessions.filter(
      (session) => (session.duration_seconds ?? 0) > 0
    ).length,
    progress_photos_total: progressPhotos ?? 0,
    paints_catalogued_total: (ownedPaints ?? 0) + (customPaints ?? 0),
    units_completed_total: unitsCompleted ?? 0,
    guides_created_total: guidesCreated ?? 0,
    guides_published_total: guidesPublished ?? 0,
    painting_minutes_total: sessionMetrics.paintingMinutesTotal,
    models_completed_total: unitsCompleted ?? 0,
    unique_paints_used_in_progress_total: uniquePaints.size,
    contest_participations_total: contestParticipations ?? 0,
    contest_votes_total: contestVotes ?? 0,
    consecutive_painting_days: sessionMetrics.consecutivePaintingDays,
    weekly_painting_streak: sessionMetrics.weeklyPaintingStreak,
    guide_saves_received_total: guideSavesReceived ?? 0,
    contest_wins_total: contestWins ?? 0,
  }

  unsupportedTriggers.add('confirmed_bug_reports_total')
  unsupportedTriggers.add('return_after_inactivity')
  unsupportedTriggers.add('same_paint_sessions_max')
  unsupportedTriggers.add('manual_beta_award')
  unsupportedTriggers.add('special_event_wins_total')

  return {
    metrics,
    sessions,
    unsupportedTriggers,
  }
}
