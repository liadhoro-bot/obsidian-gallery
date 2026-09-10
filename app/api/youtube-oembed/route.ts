import { NextResponse } from 'next/server'

function normalizeYoutubeVideoId(value: string | null) {
  const id = typeof value === 'string' ? value.trim() : ''
  return /^[a-zA-Z0-9_-]{6,20}$/.test(id) ? id : null
}

function extractYoutubeAvatarUrl(html: string) {
  const avatarMatch = html.match(/"avatar":\{"thumbnails":\[(.*?)]}/)
  const thumbnails = avatarMatch?.[1]
  if (!thumbnails) return null

  const urls = Array.from(thumbnails.matchAll(/"url":"(https?:\\?\/\\?\/[^"]+)"/g))
    .map((match) => match[1])
    .filter((url): url is string => Boolean(url))
    .map((url) => url.replaceAll('\\u0026', '&').replaceAll('\\/', '/'))

  return urls.at(-1) ?? null
}

function extractYoutubeDurationSeconds(html: string) {
  const durationMatch = html.match(/"lengthSeconds":"(\d+)"/)
  const durationSeconds = durationMatch?.[1] ? Number(durationMatch[1]) : null
  return durationSeconds && Number.isFinite(durationSeconds) ? durationSeconds : null
}

function formatDuration(seconds: number | null) {
  if (!seconds) return null

  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = seconds % 60
  const paddedSeconds = String(remainingSeconds).padStart(2, '0')

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${paddedSeconds}`
  }

  return `${minutes}:${paddedSeconds}`
}

async function fetchYoutubeAvatarUrl(authorUrl: string | null) {
  if (!authorUrl) return null

  try {
    const parsed = new URL(authorUrl)
    const isYoutubeAuthorUrl =
      parsed.protocol === 'https:' &&
      (parsed.hostname === 'www.youtube.com' || parsed.hostname === 'youtube.com')

    if (!isYoutubeAuthorUrl) return null

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 2400)

    try {
      const response = await fetch(parsed, {
        signal: controller.signal,
        next: { revalidate: 86400 },
      })

      if (!response.ok) return null

      return extractYoutubeAvatarUrl(await response.text())
    } finally {
      clearTimeout(timeout)
    }
  } catch {
    return null
  }
}

async function fetchYoutubeWatchMetadata(videoId: string) {
  const watchUrl = new URL('https://www.youtube.com/watch')
  watchUrl.searchParams.set('v', videoId)

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 2400)

    try {
      const response = await fetch(watchUrl, {
        signal: controller.signal,
        next: { revalidate: 86400 },
      })

      if (!response.ok) return { durationSeconds: null }

      const html = await response.text()
      return {
        durationSeconds: extractYoutubeDurationSeconds(html),
      }
    } finally {
      clearTimeout(timeout)
    }
  } catch {
    return { durationSeconds: null }
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const videoId = normalizeYoutubeVideoId(searchParams.get('videoId'))

  if (!videoId) {
    return NextResponse.json({ title: null, authorName: null }, { status: 400 })
  }

  const oembedUrl = new URL('https://www.youtube.com/oembed')
  oembedUrl.searchParams.set('url', `https://www.youtube.com/watch?v=${videoId}`)
  oembedUrl.searchParams.set('format', 'json')

  try {
    const response = await fetch(oembedUrl, {
      next: { revalidate: 86400 },
    })

    if (!response.ok) {
      return NextResponse.json(
        { title: null, authorName: null },
        { status: response.status },
      )
    }

    const data = await response.json()

    const authorUrl = typeof data.author_url === 'string' ? data.author_url : null
    const [authorAvatarUrl, watchMetadata] = await Promise.all([
      fetchYoutubeAvatarUrl(authorUrl),
      fetchYoutubeWatchMetadata(videoId),
    ])
    const durationSeconds = watchMetadata.durationSeconds

    return NextResponse.json(
      {
        title: typeof data.title === 'string' ? data.title : null,
        authorName: typeof data.author_name === 'string' ? data.author_name : null,
        authorUrl,
        authorAvatarUrl,
        durationSeconds,
        durationLabel: formatDuration(durationSeconds),
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
        },
      },
    )
  } catch {
    return NextResponse.json({ title: null, authorName: null }, { status: 502 })
  }
}
