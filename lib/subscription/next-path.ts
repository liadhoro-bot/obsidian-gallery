/** Same-origin path to continue to after a gate page; defaults to /dashboard. */
export function safeNextPath(value: string | undefined) {
  if (
    !value?.startsWith('/') ||
    value.startsWith('//') ||
    value.startsWith('/\\')
  ) {
    return '/dashboard'
  }

  return value
}
