import 'server-only'

import { createClient } from '../../utils/supabase/server'
import { getGuidesV3DeckDetail, type GuidesV3DeckDetail } from '../guides/guides-v3-detail-data'

// Golden fixtures only: a real guide of the signed-in user for the sample
// unit - the requested one, else the newest with a few cards and paints.
export async function loadFixtureGuideDeck(userId: string, requestedId: string | null): Promise<GuidesV3DeckDetail | null> {
  if (requestedId) {
    return getGuidesV3DeckDetail(requestedId, userId)
  }

  const supabase = await createClient()
  const { data } = await supabase
    .from('recipes')
    .select('id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(12)

  for (const row of data ?? []) {
    const deck = await getGuidesV3DeckDetail(row.id as string, userId)
    if (deck && deck.steps.length >= 2 && deck.paintList.length >= 2) {
      return deck
    }
  }
  return null
}
