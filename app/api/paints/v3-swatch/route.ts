const allowedSupabaseHost = 'ckzrvjisesooqcmmtvwl.supabase.co'
const allowedSupabasePathPrefixes = [
  '/storage/v1/render/image/public/',
  '/storage/v1/object/public/',
]
const transparentSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="2" height="1" viewBox="0 0 2 1"/>`

function transparentImageResponse() {
  return new Response(transparentSvg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=300',
    },
  })
}

function getAllowedSwatchUrl(request: Request) {
  const requestUrl = new URL(request.url)
  const source = requestUrl.searchParams.get('src')

  if (!source) {
    return null
  }

  let swatchUrl: URL

  try {
    swatchUrl = new URL(source)
  } catch {
    return null
  }

  if (
    swatchUrl.protocol !== 'https:' ||
    swatchUrl.hostname !== allowedSupabaseHost ||
    !allowedSupabasePathPrefixes.some((prefix) =>
      swatchUrl.pathname.startsWith(prefix)
    )
  ) {
    return null
  }

  return swatchUrl
}

export async function GET(request: Request) {
  const swatchUrl = getAllowedSwatchUrl(request)

  if (!swatchUrl) {
    return transparentImageResponse()
  }

  try {
    const response = await fetch(swatchUrl, {
      next: { revalidate: 60 * 60 * 24 * 30 },
    })

    if (!response.ok || !response.body) {
      return transparentImageResponse()
    }

    return new Response(response.body, {
      headers: {
        'Content-Type': response.headers.get('Content-Type') ?? 'image/png',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch {
    return transparentImageResponse()
  }
}
