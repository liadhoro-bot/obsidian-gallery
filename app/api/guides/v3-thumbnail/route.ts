import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseImageUrl } from '../../../../utils/images/supabase-image'

const fallbackThumbnail = '/onboarding/pains/tough-choices.jpeg'
const supabaseHost =
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host
const allowedStoragePrefixes = [
  '/storage/v1/object/public/',
  '/storage/v1/render/image/public/',
]

function fallback(request: NextRequest) {
  return NextResponse.redirect(new URL(fallbackThumbnail, request.url))
}

function isAllowedSupabaseImage(url: URL) {
  return (
    Boolean(supabaseHost) &&
    url.protocol === 'https:' &&
    url.host === supabaseHost &&
    allowedStoragePrefixes.some((prefix) => url.pathname.startsWith(prefix))
  )
}

export async function GET(request: NextRequest) {
  const rawSrc = request.nextUrl.searchParams.get('src')

  if (!rawSrc) return fallback(request)

  let sourceUrl: URL
  try {
    sourceUrl = new URL(rawSrc)
  } catch {
    return fallback(request)
  }

  if (!isAllowedSupabaseImage(sourceUrl)) {
    return fallback(request)
  }

  const thumbnailUrl = getSupabaseImageUrl(sourceUrl.toString(), {
    width: 112,
    height: 112,
    quality: 58,
    resize: 'cover',
  })

  if (!thumbnailUrl) return fallback(request)

  try {
    const response = await fetch(thumbnailUrl, {
      next: { revalidate: 60 * 60 * 24 },
    })

    if (!response.ok || !response.body) return fallback(request)

    return new Response(response.body, {
      headers: {
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
        'Content-Type': response.headers.get('Content-Type') ?? 'image/jpeg',
      },
    })
  } catch {
    return fallback(request)
  }
}
