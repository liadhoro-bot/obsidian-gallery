import { parseSourceUrl } from './url'

export const NEWS_BOT_USER_AGENT =
  'ObsidianGalleryNewsBot/1.0 (+https://obsidian-gallery-v3.vercel.app/community/news)'

const MAX_REDIRECTS = 3

export class SourceFetchError extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message)
    this.name = 'SourceFetchError'
  }
}

export type FetchTextOptions = {
  domain: string
  maxBytes?: number
  timeoutMs?: number
  accept?: string
  fetchImpl?: typeof fetch
}

export type FetchedText = { url: string; status: number; contentType: string; text: string }

async function readLimited(response: Response, maxBytes: number) {
  const declared = Number(response.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > maxBytes) {
    await response.body?.cancel()
    throw new SourceFetchError(`Response too large (${declared} bytes)`)
  }
  if (!response.body) return ''

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxBytes) {
      await reader.cancel()
      throw new SourceFetchError(`Response too large (over ${maxBytes} bytes)`)
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes)
}

// Fetches one page or feed from a source. Every hop, redirects included, must
// stay on the source's own domain over HTTPS, and responses are capped in
// time and size.
export async function fetchSourceText(url: string, options: FetchTextOptions): Promise<FetchedText> {
  const {
    domain,
    maxBytes = 4 * 1024 * 1024,
    timeoutMs = 10_000,
    accept = 'application/atom+xml, application/rss+xml, application/xml, text/xml, text/html;q=0.9, */*;q=0.5',
    fetchImpl = fetch,
  } = options

  let current = parseSourceUrl(url, domain)
  if (!current) throw new SourceFetchError(`Refused to fetch an address outside ${domain}`)

  for (let redirects = 0; ; redirects += 1) {
    let response: Response
    try {
      response = await fetchImpl(current, {
        redirect: 'manual',
        cache: 'no-store',
        headers: { 'user-agent': NEWS_BOT_USER_AGENT, accept },
        signal: AbortSignal.timeout(timeoutMs),
      })
    } catch (error) {
      const reason = error instanceof Error && error.name === 'TimeoutError' ? 'Timed out' : 'Network error'
      throw new SourceFetchError(`${reason} fetching ${current.pathname}`)
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      await response.body?.cancel()
      if (!location) throw new SourceFetchError(`Redirect without a location (${response.status})`, response.status)
      if (redirects >= MAX_REDIRECTS) throw new SourceFetchError('Too many redirects')
      const next = parseSourceUrl(location, domain, current.toString())
      if (!next) throw new SourceFetchError(`Refused a redirect outside ${domain}`)
      current = next
      continue
    }

    if (!response.ok) {
      await response.body?.cancel()
      throw new SourceFetchError(`HTTP ${response.status} for ${current.pathname}`, response.status)
    }

    return {
      url: current.toString(),
      status: response.status,
      contentType: response.headers.get('content-type') ?? '',
      text: await readLimited(response, maxBytes),
    }
  }
}
