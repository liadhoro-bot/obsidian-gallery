// Builds recipe_steps / recipe_step_paints values from an editor card.
// Shared by the deck saves and the guide editor's single-card save, and kept
// free of server-only imports so it can be unit tested.

export type CreateDeckCardInput = {
  // The saved recipe_steps id when editing an existing card; absent for new cards.
  id?: string
  paintAlignment?: 'left' | 'right'
  paintVerticalAlignment?: 'top' | 'center' | 'bottom'
  subtitle?: string | null
  title: string
  template: string
  body: string
  image: string | null
  videoUrl?: string | null
  paints?: Array<{
    id: string
    ratio_text?: string | null
  }>
  imageFocalX?: number
  imageFocalY?: number
}

// Theme card kicker (recipe_steps.subtitle). Null renders the default
// "Color Reference"; other card types don't show a subtitle.
export function safeThemeSubtitle(card: CreateDeckCardInput) {
  if (card.template !== 'theme' && card.template !== 'theme-alt') return null
  return card.subtitle?.trim().slice(0, 60) || null
}

export function cleanText(value: string | null | undefined, fallback: string) {
  const trimmed = value?.trim()
  return trimmed || fallback
}

export function safePersistedImage(value: string | null | undefined) {
  const trimmed = value?.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('/')) return trimmed
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed
  return null
}

// image_focal_x/y and cover_focal_x/y are smallint columns - a drag-computed
// percentage (e.g. 46.868551169312454) fails that insert, so clamp and round
// here too rather than trusting the client sent a whole number.
export function safeFocalValue(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 50
  return Math.round(Math.max(0, Math.min(100, value)))
}

export function safePersistedYoutubeUrl(value: string | null | undefined) {
  let trimmed = value?.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('www.youtube.com/')) {
    trimmed = `https://${trimmed}`
  }
  if (trimmed.startsWith('youtube.com/')) {
    trimmed = `https://${trimmed}`
  }
  if (trimmed.startsWith('youtu.be/')) {
    trimmed = `https://${trimmed}`
  }

  try {
    const parsed = new URL(trimmed)
    const isYoutube =
      (parsed.protocol === 'https:' || parsed.protocol === 'http:') &&
      (parsed.hostname === 'youtube.com' ||
        parsed.hostname.endsWith('.youtube.com') ||
        parsed.hostname === 'youtu.be')

    if (!isYoutube) return null
    parsed.protocol = 'https:'

    return parsed.toString()
  } catch {
    return null
  }
}

const deckCardMetaPrefix = 'OG_DECK_CARD_META:'

export function encodeDeckCardInstructions(card: CreateDeckCardInput) {
  const body = cleanText(card.body, 'No instructions yet.')
  const template = safeCardTemplate(card.template)
  const youtubeUrl =
    template === 'video' ? safePersistedYoutubeUrl(card.videoUrl) : null

  if (template === 'step') return body

  const metadata: {
    template: string
    youtubeUrl?: string
    paintAlignment?: 'left' | 'right'
    paintVerticalAlignment?: 'top' | 'center' | 'bottom'
  } = { template }

  if (template === 'theme' || template === 'theme-alt') {
    metadata.paintAlignment = card.paintAlignment === 'right' ? 'right' : 'left'
  }

  if (template === 'theme-alt' && (card.paintVerticalAlignment === 'center' || card.paintVerticalAlignment === 'bottom')) {
    metadata.paintVerticalAlignment = card.paintVerticalAlignment
  }

  if (youtubeUrl) {
    metadata.youtubeUrl = youtubeUrl
  }

  return `${deckCardMetaPrefix}${JSON.stringify(metadata)}\n\n${body}`
}

export function safeCardTemplate(value: string | null | undefined) {
  if (
    value === 'step' ||
    value === 'theme' ||
    value === 'theme-alt' ||
    value === 'image' ||
    value === 'small-image' ||
    value === 'paints' ||
    value === 'video'
  ) {
    return value
  }

  return 'step'
}

export function parsePaintSelection(rawValue: string | null | undefined) {
  if (!rawValue || rawValue.startsWith('paint:')) return null

  if (rawValue.includes(':')) {
    const [source, id] = rawValue.split(':')

    if (source === 'catalog' && id) {
      return {
        paint_source: 'catalog',
        paint_catalog_id: id,
        custom_paint_id: null,
      }
    }

    if (source === 'custom' && id) {
      return {
        paint_source: 'custom',
        paint_catalog_id: null,
        custom_paint_id: id,
      }
    }
  }

  return {
    paint_source: 'catalog',
    paint_catalog_id: rawValue,
    custom_paint_id: null,
  }
}

// The recipe_steps columns an editor card sets, for an insert or an
// in-place update (recipe_id, user_id and step_number are the caller's).
export function deckCardStepFields(card: CreateDeckCardInput, index: number) {
  return {
    title: cleanText(card.title, `Card ${index + 1}`),
    // Older schemas restrict card_template to the original template names.
    // Type B is restored from its existing OG_DECK_CARD_META instructions.
    card_template: card.template === 'theme-alt' ? null : safeCardTemplate(card.template),
    instructions: encodeDeckCardInstructions(card),
    image_url: safePersistedImage(card.image),
    youtube_url: card.template === 'video' ? safePersistedYoutubeUrl(card.videoUrl) : null,
    image_focal_x: safeFocalValue(card.imageFocalX),
    image_focal_y: safeFocalValue(card.imageFocalY),
    subtitle: safeThemeSubtitle(card),
  }
}

// recipe_step_paints rows for one saved card, in the card's paint order.
// Empty placeholder slots (paint:...) are skipped.
export function deckCardPaintRows(stepId: string, userId: string, paints: CreateDeckCardInput['paints']) {
  return (paints ?? []).flatMap((paint, paintIndex) => {
    const parsedPaint = parsePaintSelection(paint.id)
    if (!parsedPaint) return []

    return {
      recipe_step_id: stepId,
      user_id: userId,
      paint_source: parsedPaint.paint_source,
      paint_catalog_id: parsedPaint.paint_catalog_id,
      custom_paint_id: parsedPaint.custom_paint_id,
      paint_order: paintIndex + 1,
      ratio_text: paint.ratio_text?.trim() || null,
    }
  })
}
