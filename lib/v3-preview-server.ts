import { cookies, headers } from 'next/headers'
import {
  V3_PREVIEW_COOKIE,
  isV3DeploymentHost,
  isV3PreviewValue,
} from './v3-preview'

export async function hasV3PreviewSession(preview?: string | null) {
  if (isV3PreviewValue(preview)) {
    return true
  }

  const headerStore = await headers()
  if (isV3DeploymentHost(headerStore.get('host'))) {
    return true
  }

  const cookieStore = await cookies()
  return cookieStore.get(V3_PREVIEW_COOKIE)?.value === '1'
}
