import { cookies, headers } from 'next/headers'
import {
  V3_PREVIEW_COOKIE,
  canUseV3PreviewCookie,
  isV3DeploymentHost,
  isV3PreviewValue,
} from './v3-preview'

export async function hasV3PreviewSession(preview?: string | null) {
  if (isV3PreviewValue(preview)) {
    return true
  }

  const headerStore = await headers()
  const host = headerStore.get('host')

  if (isV3DeploymentHost(host)) {
    return true
  }

  const cookieStore = await cookies()
  return (
    canUseV3PreviewCookie(host) &&
    cookieStore.get(V3_PREVIEW_COOKIE)?.value === '1'
  )
}
