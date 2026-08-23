import { createClient } from '../../utils/supabase/server'
import type { FeatureGuideEntry } from './feature-guide-types'

const featureGuideSelect =
  'uid, feature_name, location_reference, component_reference, explanation, place_in_page, coach_mark_area, popup_placement, display_order'

export async function getFeatureGuidesForPage(
  pagePath: string,
  fallbackGuides: FeatureGuideEntry[] = []
) {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('feature_guide')
      .select(featureGuideSelect)
      .eq('page_path', pagePath)
      .order('display_order', { ascending: true })

    if (error || !data?.length) {
      return fallbackGuides
    }

    const pageKey = pagePath.split('/').filter(Boolean)[0]
    const pageUid = pageKey ? `${pageKey}.page` : null

    const filteredGuides = (data as FeatureGuideEntry[])
      .filter(
        (guide) =>
          !guide.uid.startsWith('global.') && guide.uid !== `${pageKey}.help`
      )
      .sort((first, second) => {
        if (first.uid === pageUid) return -1
        if (second.uid === pageUid) return 1
        const firstIsTab = first.uid.includes('.tabs.')
        const secondIsTab = second.uid.includes('.tabs.')
        if (firstIsTab && !secondIsTab) return -1
        if (!firstIsTab && secondIsTab) return 1
        return first.display_order - second.display_order
      })

    if (!fallbackGuides.length) {
      return filteredGuides
    }

    const guideMap = new Map(filteredGuides.map((guide) => [guide.uid, guide]))

    return fallbackGuides.map((fallbackGuide) => ({
      ...guideMap.get(fallbackGuide.uid),
      ...fallbackGuide,
    }))
  } catch {
    return fallbackGuides
  }
}
