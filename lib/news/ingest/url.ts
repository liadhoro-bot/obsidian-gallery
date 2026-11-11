// URL rules for collecting news. A source may only be fetched over HTTPS on
// its own domain (or that domain's www. form), so a feed, sitemap or redirect
// can never send the collector to another host.

const TRACKING_PARAM = /^(utm_[a-z_]+|fbclid|gclid|dclid|msclkid|mc_cid|mc_eid|_hsenc|_hsmi|igshid|ref|ref_src|si)$/i

export function hostMatchesDomain(host: string, domain: string) {
  const normalizedHost = host.toLowerCase().replace(/\.$/, '')
  const normalizedDomain = domain.toLowerCase()
  return normalizedHost === normalizedDomain || normalizedHost === `www.${normalizedDomain}`
}

// Belt and braces: source domains come from the admin-only registry, but an
// IP literal or internal-looking name is never a news site.
export function isBlockedHost(host: string) {
  const value = host.toLowerCase()
  return (
    !value.includes('.') ||
    value.startsWith('[') ||
    /^\d{1,3}(\.\d{1,3}){3}$/.test(value) ||
    value === 'localhost' ||
    /\.(localhost|local|internal|lan|home|corp|test|invalid)$/.test(value)
  )
}

export function parseSourceUrl(value: string, domain: string, base?: string): URL | null {
  let url: URL
  try {
    url = base ? new URL(value.trim(), base) : new URL(value.trim())
  } catch {
    return null
  }
  if (url.protocol !== 'https:') return null
  if (url.username || url.password || url.port) return null
  if (isBlockedHost(url.hostname) || !hostMatchesDomain(url.hostname, domain)) return null
  return url
}

// The stable form used for deduplication: no fragment, no tracking
// parameters, sorted query, no trailing slash.
export function canonicalizeUrl(value: string, domain: string, base?: string): string | null {
  const url = parseSourceUrl(value, domain, base)
  if (!url) return null
  url.hash = ''
  url.hostname = url.hostname.toLowerCase()
  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAM.test(key)) url.searchParams.delete(key)
  }
  url.searchParams.sort()
  if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, '')
  return url.toString()
}
