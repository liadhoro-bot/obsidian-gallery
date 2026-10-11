import 'server-only'

import type { createClient } from '../../utils/supabase/server'
import { createServiceRoleClient } from '../../utils/supabase/service-role'

// Read client for the logged-out share route (/s/guides/[id]). Production RLS
// only lets *authenticated* users read public recipes, steps, step paints and
// images, so an anonymous visitor's own client sees nothing. This bypasses
// RLS instead of opening those tables to the anon key: every caller MUST
// filter to is_public itself (getSharedGuideFile, loadDeckDetail with a null
// viewer) and must never be reachable with an id the visitor can't share.
export function createSharedReadClient() {
  return createServiceRoleClient() as unknown as Awaited<ReturnType<typeof createClient>>
}
