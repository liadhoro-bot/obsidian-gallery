type SupabaseImageTransformOptions = {
  width?: number
  height?: number
  quality?: number
  resize?: 'cover' | 'contain' | 'fill'
}

const SUPABASE_PUBLIC_OBJECT_SEGMENT = '/storage/v1/object/public/'

export function getSupabaseImageUrl(
  imageUrl: string | null | undefined,
  {
    width,
    height,
    quality,
    resize,
  }: SupabaseImageTransformOptions = {}
) {
  if (!imageUrl) {
    return null
  }

  let parsedUrl: URL

  try {
    parsedUrl = new URL(imageUrl)
  } catch {
    return imageUrl
  }

  const publicSegmentIndex = parsedUrl.pathname.indexOf(
    SUPABASE_PUBLIC_OBJECT_SEGMENT
  )

  if (publicSegmentIndex === -1) {
    return imageUrl
  }

  const publicPath = parsedUrl.pathname.slice(
    publicSegmentIndex + SUPABASE_PUBLIC_OBJECT_SEGMENT.length
  )

  if (!publicPath) {
    return imageUrl
  }

  const transformedUrl = new URL(
    `/storage/v1/render/image/public/${publicPath}`,
    parsedUrl.origin
  )

  if (width && width > 0) {
    transformedUrl.searchParams.set('width', String(Math.round(width)))
  }

  if (height && height > 0) {
    transformedUrl.searchParams.set('height', String(Math.round(height)))
  }

  if (quality && quality > 0) {
    transformedUrl.searchParams.set('quality', String(Math.round(quality)))
  }

  if (resize) {
    transformedUrl.searchParams.set('resize', resize)
  }

  return transformedUrl.toString()
}
