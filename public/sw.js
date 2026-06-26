const CACHE_VERSION = 'obsidian-gallery-pwa-v2.8.6'
const STATIC_CACHE = `${CACHE_VERSION}-static`
const IMAGE_CACHE = `${CACHE_VERSION}-images`
const OFFLINE_URL = '/offline'

const PRECACHE_URLS = [
  OFFLINE_URL,
  '/manifest.webmanifest',
  '/favicon-16x16.png',
  '/favicon-32x32.png',
  '/apple-touch-icon.png',
  '/icon-192.png',
  '/icon-512.png',
  '/maskable-icon-512.png',
  '/bookmark.svg',
  '/icons/nav/dashboard.svg',
  '/icons/nav/projects.svg',
  '/icons/nav/recipes.svg',
  '/icons/nav/themes.svg',
  '/icons/nav/vault.svg',
]

const STATIC_EXTENSIONS = [
  '.css',
  '.js',
  '.mjs',
  '.woff',
  '.woff2',
  '.ico',
  '.svg',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
]

const PUBLIC_IMAGE_PREFIXES = [
  '/badges/',
  '/curator/',
  '/icons/',
  '/onboarding/',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((cacheName) => !cacheName.startsWith(CACHE_VERSION))
            .map((cacheName) => caches.delete(cacheName))
        )
      )
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event

  if (request.method !== 'GET') {
    return
  }

  const url = new URL(request.url)

  if (!['http:', 'https:'].includes(url.protocol)) {
    return
  }

  if (shouldBypassServiceWorker(url, request)) {
    return
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkOnlyNavigation(request))
    return
  }

  // Public artwork used by the marketing/onboarding shell can render instantly
  // on repeat views while a fresh copy is fetched for the next visit.
  if (isSafePublicImage(url, request)) {
    event.respondWith(staleWhileRevalidate(request, IMAGE_CACHE))
    return
  }

  // Next chunks, CSS, icons, and other same-origin public assets are versioned
  // or safe to refresh on service worker updates, so cache-first is appropriate.
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE))
  }
})

function shouldBypassServiceWorker(url, request) {
  const isSameOrigin = url.origin === self.location.origin
  const pathname = url.pathname

  // Never cache Supabase auth/session refresh, direct database calls, or storage
  // responses. Some storage URLs can contain user uploads that are technically
  // public but still user-specific, so they stay network-only for this pass.
  if (url.hostname.endsWith('.supabase.co')) {
    return true
  }

  // Keep all app API handlers and auth/magic-link routes outside service worker
  // caching so login, onboarding, mutations, and session exchange remain fresh.
  if (
    isSameOrigin &&
    (pathname.startsWith('/api/') ||
      pathname.startsWith('/auth/') ||
      pathname.startsWith('/login') ||
      pathname.startsWith('/onboarding') ||
      pathname.startsWith('/_next/data/'))
  ) {
    return true
  }

  // Server Actions and React/Next internals can carry user-specific payloads.
  if (
    request.headers.has('Next-Action') ||
    request.headers.get('RSC') === '1' ||
    request.headers.get('Accept')?.includes('text/x-component')
  ) {
    return true
  }

  return false
}

function isStaticAsset(url) {
  const pathname = url.pathname

  return (
    url.origin === self.location.origin &&
    (pathname.startsWith('/_next/static/') ||
      STATIC_EXTENSIONS.some((extension) => pathname.endsWith(extension)))
  )
}

function isSafePublicImage(url, request) {
  if (url.origin !== self.location.origin || !request.destination) {
    return false
  }

  return (
    request.destination === 'image' &&
    PUBLIC_IMAGE_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))
  )
}

async function cacheFirst(request, cacheName) {
  const cachedResponse = await caches.match(request)

  if (cachedResponse) {
    return cachedResponse
  }

  const networkResponse = await fetch(request)

  if (networkResponse.ok) {
    const cache = await caches.open(cacheName)
    cache.put(request, networkResponse.clone())
  }

  return networkResponse
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cachedResponse = await cache.match(request)

  const networkResponsePromise = fetch(request).then((networkResponse) => {
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone())
    }

    return networkResponse
  })

  return cachedResponse || networkResponsePromise
}

async function networkOnlyNavigation(request) {
  // Documents may contain authenticated or user-specific data, so they are not
  // stored. If the network is unavailable, show the precached offline screen.
  try {
    return await fetch(request)
  } catch {
    const cache = await caches.open(STATIC_CACHE)
    return cache.match(OFFLINE_URL)
  }
}
