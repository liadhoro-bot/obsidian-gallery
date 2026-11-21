import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { targetKind } from './candidates'
import {
  MESSAGE_COLUMNS,
  type EngagementMessage,
  type MessageContext,
} from './types'

export async function loadMessages(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('engagement_messages')
    .select(MESSAGE_COLUMNS)
    .order('v1_number', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as EngagementMessage[]
}

/** Resolves the unit / guide a message talks about to its name. */
export async function resolveContext(
  supabase: SupabaseClient,
  message: EngagementMessage,
  targetId: string | null
): Promise<MessageContext> {
  if (!targetId) return {}

  if (targetKind(message) === 'recipe') {
    const { data } = await supabase.from('recipes').select('id, name').eq('id', targetId).maybeSingle()
    return { recipeId: targetId, guideName: (data as { name?: string } | null)?.name ?? null }
  }

  const { data } = await supabase.from('units').select('id, name').eq('id', targetId).maybeSingle()
  return { unitId: targetId, unitName: (data as { name?: string } | null)?.name ?? null }
}
