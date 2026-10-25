// A guide's own visibility (guides.visibility). Only 'public' guides are
// listed in Discover, creator pages and contest entries. Public and unlisted
// guides allow direct share links. Draft and private guides stay readable to their owner and to people
// who saved them or assigned them to a unit or project.
export type GuideVisibility = 'draft' | 'private' | 'unlisted' | 'public'
export type GuideStatus = 'Draft' | 'Private' | 'Unlisted' | 'Public'

export const GUIDE_STATUSES: GuideStatus[] = ['Draft', 'Private', 'Unlisted', 'Public']

export function guideVisibilityOf(value: unknown): GuideVisibility {
  return value === 'public' || value === 'private' || value === 'unlisted' ? value : 'draft'
}

export function statusFromVisibility(visibility: GuideVisibility): GuideStatus {
  return visibility === 'public' ? 'Public' : visibility === 'unlisted' ? 'Unlisted' : visibility === 'private' ? 'Private' : 'Draft'
}

export function visibilityFromStatus(status: string | null | undefined): GuideVisibility {
  return status === 'Public' ? 'public' : status === 'Unlisted' ? 'unlisted' : status === 'Private' ? 'private' : 'draft'
}

export function allowsGuideShareLink(value: unknown) {
  return value === 'public' || value === 'unlisted'
}
