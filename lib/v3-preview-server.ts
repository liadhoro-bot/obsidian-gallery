import { cookies } from 'next/headers'
import { V3_PREVIEW_COOKIE, isV3PreviewValue } from './v3-preview'

export async function hasV3PreviewSession(preview?: string | null) {
  if (isV3PreviewValue(preview)) {
    return true
  }

  const cookieStore = await cookies()
  return cookieStore.get(V3_PREVIEW_COOKIE)?.value === '1'
}
