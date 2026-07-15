export type UnitCompletedShareImage = {
  id: string
  url: string
  label: string
  alt: string
  source: 'featured' | 'gallery' | 'stage' | 'project' | 'placeholder'
}

export type UnitCompletedShareData = {
  unitId: string
  unitName: string
  completedAt: string
  totalSeconds: number
  sessionCount: number
  images: UnitCompletedShareImage[]
  selectedImage: UnitCompletedShareImage
}

export const UNIT_COMPLETED_SHARE_TYPE = 'unit_completed'

export const CURATOR_UNIT_COMPLETED_QUOTES = [
  'The grey has retreated. The shelf shall remember this day.',
  'A finished unit is a small rebellion against entropy.',
  'Brushes down. Standards raised. Try not to look smug.',
  'From primer dust to parade ground glory. Adequate. Almost suspiciously so.',
  'Another unit escapes the unfinished dark. Mark the date.',
  'The pile is lighter, the cabinet is louder, and I am briefly impressed.',
  'The dead remember. The backlog pretends not to notice.',
  'Finished, photographed, and suspiciously proud of itself.',
]

export function getRandomCuratorQuote(previousQuote?: string) {
  const availableQuotes =
    CURATOR_UNIT_COMPLETED_QUOTES.length > 1 && previousQuote
      ? CURATOR_UNIT_COMPLETED_QUOTES.filter((quote) => quote !== previousQuote)
      : CURATOR_UNIT_COMPLETED_QUOTES

  return availableQuotes[Math.floor(Math.random() * availableQuotes.length)]
}

export function formatShareDuration(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(safeSeconds / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)

  if (hours <= 0) {
    return `${minutes}m`
  }

  return `${hours}h ${minutes}m`
}

export function formatShareCompletedDate(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Completed'
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
  }).format(date)
}

export function formatExactShareCompletedDate(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Completed'
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

export function buildUnitCompletedCaption({
  unitName,
  totalSeconds,
  sessionCount,
  completedAt,
}: {
  unitName: string
  totalSeconds: number
  sessionCount: number
  completedAt: string
}) {
  return `${unitName} completed in ${formatShareDuration(totalSeconds)} across ${sessionCount} ${
    sessionCount === 1 ? 'session' : 'sessions'
  }. ${formatExactShareCompletedDate(completedAt)}. Obsidian Gallery.`
}

export function buildShareFileName(unitName: string) {
  const slug = unitName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)

  return `${slug || 'unit'}-completed.png`
}
