// Where a Start Painting button sends the painter once the unit's session is
// running. Without a return path, Paint Mode closes back to the dashboard.
export function paintModeHref(unitId: string, { preview = false, returnPath }: { preview?: boolean; returnPath?: string } = {}) {
  const params = new URLSearchParams()
  if (preview) params.set('preview', '1')
  params.set('unit', unitId)
  if (returnPath) params.set('return', returnPath)
  return `/paint-mode?${params}`
}
