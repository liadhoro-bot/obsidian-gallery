import { createClient } from '../supabase/server'
import type { DashboardCuratorPrompt, DashboardCuratorState } from './types'

type RuleConditionValue = number | string | boolean | null
type RuleCondition = Record<string, Partial<Record<'eq' | 'gt' | 'gte' | 'lt' | 'lte', RuleConditionValue>>>

type CuratorRule = {
  key: string
  surface: string
  category: string
  priority: number
  conditions: RuleCondition
  cooldown_hours: number
  auto_open: boolean
  cta_label: string | null
  cta_href: string | null
  max_shows_per_week: number | null
}

type CuratorTemplate = {
  id: string
  key: string | null
  title: string | null
  body: string | null
  body_lines: string[] | null
  primary_cta_href: string | null
  weight: number | null
}

function compare(value: unknown, operator: string, target: RuleConditionValue) {
  if (operator === 'eq') return value === target

  const numericValue = Number(value)
  const numericTarget = Number(target)

  if (Number.isNaN(numericValue) || Number.isNaN(numericTarget)) return false
  if (operator === 'gt') return numericValue > numericTarget
  if (operator === 'gte') return numericValue >= numericTarget
  if (operator === 'lt') return numericValue < numericTarget
  if (operator === 'lte') return numericValue <= numericTarget

  return false
}

function matchesConditions(state: DashboardCuratorState, conditions: RuleCondition | null) {
  return Object.entries(conditions || {}).every(([field, checks]) => {
    return Object.entries(checks).every(([operator, target]) => {
      return compare(state[field as keyof DashboardCuratorState], operator, target)
    })
  })
}

function weightedPick<T extends { weight: number | null }>(items: T[]) {
  const total = items.reduce((sum, item) => sum + Math.max(item.weight ?? 0, 0), 0)

  if (total <= 0) {
    return items[Math.floor(Math.random() * items.length)]
  }

  let roll = Math.random() * total

  for (const item of items) {
    roll -= Math.max(item.weight ?? 0, 0)
    if (roll <= 0) return item
  }

  return items[0]
}

function getFallbackCtaHref(rule: CuratorRule, template: CuratorTemplate) {
  if (rule.cta_href) return rule.cta_href
  if (template.primary_cta_href) return template.primary_cta_href

  const keyAndCategory = `${rule.key} ${rule.category}`.toLowerCase()

  if (keyAndCategory.includes('project')) return '/projects'
  if (keyAndCategory.includes('unit')) return '/projects'
  if (keyAndCategory.includes('recipe')) return '/recipes'
  if (keyAndCategory.includes('theme')) return '/themes'
  if (keyAndCategory.includes('vault') || keyAndCategory.includes('paint')) return '/vault'

  return '/dashboard'
}

export async function getDashboardCuratorPrompt(): Promise<DashboardCuratorPrompt | null> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const userId = user.id

  const [{ count: projectsCount }, { count: unitsCount }, { count: sessionsCount }] =
    await Promise.all([
      supabase.from('projects').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('units').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('unit_sessions').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    ])

  const startOfWeek = new Date()
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay())
  startOfWeek.setHours(0, 0, 0, 0)

  const { count: sessionsThisWeek } = await supabase
    .from('unit_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', startOfWeek.toISOString())

  const { data: lastSession } = await supabase
    .from('unit_sessions')
    .select('created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const daysSinceLastSession = lastSession?.created_at
    ? Math.floor((Date.now() - new Date(lastSession.created_at).getTime()) / 86400000)
    : null

  const { data: deadlineUnit } = await supabase
    .from('units')
    .select('id, deadline')
    .eq('user_id', userId)
    .not('deadline', 'is', null)
    .gte('deadline', new Date().toISOString().slice(0, 10))
    .order('deadline', { ascending: true })
    .limit(1)
    .maybeSingle()

  const deadlineWithinDays = deadlineUnit?.deadline
    ? Math.ceil(
        (new Date(deadlineUnit.deadline).getTime() - Date.now()) / 86400000
      )
    : null

  // Temporary V1 placeholder.
  // Later replace with real unit progress calculation.
  const unitProgress = deadlineUnit ? 0 : null

  const state: DashboardCuratorState = {
    projectsCount: projectsCount ?? 0,
    unitsCount: unitsCount ?? 0,
    sessionsCount: sessionsCount ?? 0,
    sessionsThisWeek: sessionsThisWeek ?? 0,
    daysSinceLastSession,
    deadlineWithinDays,
    unitProgress,
  }

  const { data: rules } = await supabase
    .from('curator_rules')
    .select('*')
    .eq('surface', 'dashboard')
    .eq('is_active', true)
    .order('priority', { ascending: true })

  if (!rules?.length) return null

  const now = new Date()

  for (const rule of rules as CuratorRule[]) {
    if (!matchesConditions(state, rule.conditions)) continue

    const cooldownSince = new Date(
      now.getTime() - (rule.cooldown_hours ?? 24) * 60 * 60 * 1000
    ).toISOString()

    const { count: recentShows } = await supabase
      .from('curator_message_events')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('rule_key', rule.key)
      .eq('event_type', 'shown')
      .gte('created_at', cooldownSince)

    if ((recentShows ?? 0) > 0) continue

    const weekSince = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const { count: weeklyShows } = await supabase
      .from('curator_message_events')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('rule_key', rule.key)
      .eq('event_type', 'shown')
      .gte('created_at', weekSince)

    if ((weeklyShows ?? 0) >= (rule.max_shows_per_week ?? 3)) continue

    const { data: templates } = await supabase
      .from('curator_message_templates')
      .select('id, key, title, body, body_lines, primary_cta_href, weight')
      .eq('surface', 'dashboard')
      .eq('category', rule.category)
      .eq('is_active', true)

    if (!templates?.length) continue

    const typedTemplates = templates as CuratorTemplate[]
    const selectedTemplate = weightedPick(typedTemplates)

    return {
      ruleKey: rule.key,
      category: rule.category,
      templateId: selectedTemplate.id,
      templateKey: selectedTemplate.key ?? selectedTemplate.id,
      title: selectedTemplate.title ?? 'The Curator',
      body: selectedTemplate.body ?? '',
      bodyLines: selectedTemplate.body_lines ?? undefined,
      ctaLabel: rule.cta_label ?? 'Continue',
      ctaHref: getFallbackCtaHref(rule, selectedTemplate),
      autoOpen: rule.auto_open,
      state,
    }
  }

  return null
}
