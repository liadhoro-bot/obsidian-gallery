import 'server-only'

import { createClient } from '../../../utils/supabase/server'

export type CuratorMessage = {
  key: string
  ruleKey?: string
  surface: string
  category: string
  variant: string
  title: string
  bodyLines: string[]
  question?: string | null
  primaryCtaLabel?: string | null
  primaryCtaHref?: string | null
  secondaryCtaLabel?: string | null
  imageUrl?: string | null
}

type GetCuratorMessageArgs = {
  surface?: string
  entityId?: string | null
  auto?: boolean
}

type GetCuratorMessageResult = {
  message: CuratorMessage | null
  shouldOpen: boolean
}

type CuratorTemplate = {
  key: string
  surface: string
  category: string
  variant: string | null
  title: string | null
  body_lines: string[] | null
  question: string | null
  primary_cta_label: string | null
  primary_cta_href: string | null
  secondary_cta_label: string | null
  image_url: string | null
}

type ConditionOperator = {
  eq?: unknown
  gt?: number
  gte?: number
  lt?: number
  lte?: number
}

function matchesConditions(
  metadata: Record<string, unknown>,
  conditions: Record<string, ConditionOperator>,
) {
  return Object.entries(conditions).every(([key, rule]) => {
    const value = metadata[key]

    if ('eq' in rule) return value === rule.eq
    if ('gt' in rule) return Number(value) > Number(rule.gt)
    if ('gte' in rule) return Number(value) >= Number(rule.gte)
    if ('lt' in rule) return Number(value) < Number(rule.lt)
    if ('lte' in rule) return Number(value) <= Number(rule.lte)

    return false
  })
}

function mapTemplateToMessage(
  template: CuratorTemplate,
  ruleKey?: string
): CuratorMessage {
  return {
    key: template.key,
    ruleKey,
    surface: template.surface,
    category: template.category,
    variant: template.variant ?? 'standard',
    title: template.title ?? 'The Curator',
    bodyLines: template.body_lines ?? [],
    question: template.question,
    primaryCtaLabel: template.primary_cta_label,
    primaryCtaHref: template.primary_cta_href,
    secondaryCtaLabel: template.secondary_cta_label ?? 'Not Now',
    imageUrl: template.image_url ?? '/curator/the-curator.png',
  }
}

async function getTemplateByKey(
  supabase: Awaited<ReturnType<typeof createClient>>,
  key: string
) {
  const { data, error } = await supabase
    .from('curator_message_templates')
    .select(
      'key, surface, category, variant, title, body_lines, question, primary_cta_label, primary_cta_href, secondary_cta_label, image_url'
    )
    .eq('key', key)
    .eq('is_active', true)
    .maybeSingle()

  if (error || !data) return null

  return data
}

export async function getCuratorMessage({
  surface = 'dashboard',
  entityId = null,
  auto = false,
}: GetCuratorMessageArgs = {}): Promise<GetCuratorMessageResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      message: null,
      shouldOpen: false,
    }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('curator_intro_seen_at')
    .eq('id', user.id)
    .maybeSingle()

  const { count: unitsCount } = await supabase
    .from('units')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)

  const hasSeenIntro = Boolean(profile?.curator_intro_seen_at)
  const hasUnits = (unitsCount ?? 0) > 0

  if (auto && !hasSeenIntro) {
    let introKey = 'intro_existing_user_v1'

    if (surface === 'unit' && entityId) {
      introKey = 'intro_unit_created_v1'
    } else if (surface === 'dashboard' && !hasUnits) {
      introKey = 'intro_no_unit_v1'
    }

    const template = await getTemplateByKey(supabase, introKey)

    if (template) {
      await supabase
        .from('profiles')
        .update({ curator_intro_seen_at: new Date().toISOString() })
        .eq('id', user.id)

      await supabase.from('curator_message_events').insert({
        user_id: user.id,
        message_key: template.key,
        rule_key: 'curator_intro_gate',
        surface,
        event_type: 'shown',
        entity_id: entityId,
        metadata: {
          auto,
          introKey,
          hasUnits,
          unitsCount: unitsCount ?? 0,
        },
      })

      return {
        message: mapTemplateToMessage(template, 'curator_intro_gate'),
        shouldOpen: true,
      }
    }
  }

  const weekStart = new Date()
  weekStart.setDate(weekStart.getDate() - 7)

  const { count: sessionsThisWeek } = await supabase
    .from('unit_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', weekStart.toISOString())

  const metadata = {
    sessionsThisWeek: sessionsThisWeek ?? 0,
    unitsCount: unitsCount ?? 0,
    hasUnits,
    surface,
    entityId,
  }

  const { data: rules, error: rulesError } = await supabase
    .from('curator_rules')
    .select('key, category, conditions')
    .eq('surface', surface)
    .eq('is_active', true)
    .order('priority', { ascending: false })

  if (rulesError || !rules?.length) {
    return {
      message: null,
      shouldOpen: false,
    }
  }

  const matchedRule = rules.find((rule) =>
    matchesConditions(
      metadata,
      rule.conditions as Record<string, ConditionOperator>,
    ),
  )

  if (!matchedRule) {
    return {
      message: null,
      shouldOpen: false,
    }
  }

  const { data: templates, error: templatesError } = await supabase
    .from('curator_message_templates')
    .select(
      'key, surface, category, variant, title, body_lines, question, primary_cta_label, primary_cta_href, secondary_cta_label, image_url'
    )
    .eq('surface', surface)
    .eq('category', matchedRule.category)
    .eq('is_active', true)
    .order('weight', { ascending: false })
    .limit(1)

  if (templatesError || !templates?.length) {
    return {
      message: null,
      shouldOpen: false,
    }
  }

  const template = templates[0]

  await supabase.from('curator_message_events').insert({
    user_id: user.id,
    message_key: template.key,
    rule_key: matchedRule.key,
    surface,
    event_type: 'shown',
    entity_id: entityId,
    metadata,
  })

  return {
    message: mapTemplateToMessage(template, matchedRule.key),
    shouldOpen: false,
  }
}
