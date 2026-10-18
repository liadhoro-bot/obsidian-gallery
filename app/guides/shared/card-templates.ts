// The card types a creator can add, shared by the guide editor, the deck
// editor and the server action that adds a guide's own cards. Pure data, so
// server code can import it.
export type CardTypeId = 'cover' | 'step' | 'theme' | 'theme-alt' | 'image' | 'small-image' | 'paints' | 'video'

export const cardTypeOptions: CardTypeId[] = ['cover', 'step', 'theme', 'theme-alt', 'image', 'small-image', 'paints', 'video']

// What "Add New Card" offers, top to bottom (the Index Card sits right under
// Cover). Theme Type A is retired from new cards; existing ones still render
// and stay editable.
export const addableCardTypes: CardTypeId[] = cardTypeOptions.filter((template) => template !== 'theme')

export function isCardTypeId(value: string): value is CardTypeId {
  return (cardTypeOptions as string[]).includes(value)
}

export function cardTypeLabel(template: CardTypeId) {
  if (template === 'cover') return 'Cover'
  if (template === 'theme') return 'Theme Type A'
  if (template === 'theme-alt') return 'Theme'
  if (template === 'image') return 'Big Image'
  if (template === 'small-image') return 'Small Image'
  if (template === 'paints') return 'Paints'
  if (template === 'video') return 'Video'
  return 'Step'
}

export function cardTypeDescription(template: CardTypeId) {
  if (template === 'cover') return 'Title, cover image, and description'
  if (template === 'theme') return 'Square paint swatches with full-width glass labels'
  if (template === 'theme-alt') return 'Textured paint daubs with compact glass labels'
  if (template === 'image') return 'Full-card image with a small title and notes panel'
  if (template === 'small-image') return 'Cover-style image above title and longer notes'
  if (template === 'paints') return 'Deck paints and current ownership status'
  if (template === 'video') return 'YouTube walkthrough with a short caption'
  return 'Instruction, paints, ratios, and optional image'
}

// Starting text for a freshly added card of each type.
export function cardTypeDefaultBody(template: CardTypeId) {
  if (template === 'cover') return 'Describe the deck at a glance: subject, style, and promise.'
  if (template === 'theme' || template === 'theme-alt') return 'Describe the palette, mood, finish, and visual intent.'
  if (template === 'image') return 'Add the visual checkpoint notes for this card.'
  if (template === 'small-image') return 'Add the reference notes, comparison cues, or longer explanation for this image.'
  if (template === 'paints') return 'The full palette for this deck, at a glance.'
  if (template === 'video') return 'Add a short caption for the video.'
  return 'Describe the painting action, timing, and result to check.'
}

export const GUIDE_INDEX_TYPE_DESCRIPTION = 'Numbered list of the guides inside, kept up to date automatically'
