'use server'

import { createClient } from '../../utils/supabase/server'
import type { CuratorMessageEventType } from '../../utils/curator/types'

export async function logCuratorMessageEvent(input: {
  ruleKey?: string
  category?: string
  templateId?: string
  messageKey?: string
  surface?: string
  eventType: CuratorMessageEventType
  metadata?: Record<string, unknown>
}) {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    console.error('Curator event not logged: no authenticated user', userError)
    return { ok: false, error: 'not_authenticated' }
  }

  const { error } = await supabase.from('curator_message_events').insert({
    user_id: user.id,
    message_key: input.messageKey ?? input.templateId ?? input.ruleKey ?? input.eventType,
    rule_key: input.ruleKey ?? null,
    category: input.category ?? null,
    template_id: input.templateId ?? null,
    surface: input.surface ?? 'dashboard',
    event_type: input.eventType,
    metadata: {
      category: input.category ?? null,
      templateId: input.templateId ?? null,
      ...(input.metadata ?? {}),
    },
  })

  if (error) {
    console.error('Failed to log Curator message event:', error)
    return {
      ok: false,
      error: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    }
  }

  return { ok: true }
}
