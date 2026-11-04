import type { createClient } from '../supabase/server'

const URLS_PER_QUERY = 40

// A guide started from a unit shows the unit's photos at their original URLs,
// so a stored file can outlive its unit photo. Returns only the images no guide
// of this user still shows, which are the ones safe to remove from storage.
export async function withoutImagesUsedByGuides<T extends { image_url: string | null }>(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  images: T[]
): Promise<T[]> {
  const urls = [...new Set(images.flatMap((image) => (image.image_url ? [image.image_url] : [])))]
  const used = new Set<string>()

  for (let start = 0; start < urls.length; start += URLS_PER_QUERY) {
    const batch = urls.slice(start, start + URLS_PER_QUERY)
    const results = await Promise.all(
      (['recipes', 'recipe_steps', 'guides'] as const).map((table) =>
        supabase.from(table).select('image_url').eq('user_id', userId).in('image_url', batch)
      )
    )
    for (const { data, error } of results) {
      if (error) throw error
      for (const row of data ?? []) {
        if (row.image_url) used.add(row.image_url)
      }
    }
  }

  return images.filter((image) => !image.image_url || !used.has(image.image_url))
}
