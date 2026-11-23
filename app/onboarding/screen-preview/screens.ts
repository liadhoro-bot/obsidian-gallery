export const PREVIEW_SCREENS = [
  'terms',
  'goal',
  'first_unit',
  'first_guide',
  'notifications',
  'notifications_proposed',
  'curator',
] as const
export type PreviewScreen = (typeof PREVIEW_SCREENS)[number]
