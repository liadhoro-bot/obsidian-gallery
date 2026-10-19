// A guide's own visibility (guides.visibility). Only 'public' guides are
// listed - Discover, creator pages, contest entries and the logged-out share
// link. Draft and private guides stay readable to their owner and to people
// who saved them or assigned them to a unit or project.
export type GuideVisibility = 'draft' | 'private' | 'public'
export type GuideStatus = 'Draft' | 'Private' | 'Public'

export const GUIDE_STATUSES: GuideStatus[] = ['Draft', 'Private', 'Public']

export function guideVisibilityOf(value: unknown): GuideVisibility {
  return value === 'public' || value === 'private' ? value : 'draft'
}

export function statusFromVisibility(visibility: GuideVisibility): GuideStatus {
  return visibility === 'public' ? 'Public' : visibility === 'private' ? 'Private' : 'Draft'
}

export function visibilityFromStatus(status: string | null | undefined): GuideVisibility {
  return status === 'Public' ? 'public' : status === 'Private' ? 'private' : 'draft'
}
