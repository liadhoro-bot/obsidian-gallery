const CACHE_VERSION = 'obsidian-gallery-v3-launch-fixes-2026-09-17'
const STATIC_CACHE = `${CACHE_VERSION}-static`
const IMAGE_CACHE = `${CACHE_VERSION}-images`
const OFFLINE_URL = '/offline'

const PRECACHE_URLS = [
  OFFLINE_URL,
  '/manifest.webmanifest',
  '/favicon-16x16.png',
  '/favicon-32x32.png',
  '/apple-touch-icon.png',
  '/favicon-48x48.png',
  '/icon-192.png',
  '/icon-256.png',
  '/icon-384.png',
  '/icon-512.png',
  '/maskable-icon-512.png',
  '/splash/apple-splash-750x1334.png',
  '/splash/apple-splash-828x1792.png',
  '/splash/apple-splash-1125x2436.png',
  '/splash/apple-splash-1170x2532.png',
  '/splash/apple-splash-1242x2688.png',
  '/splash/apple-splash-1290x2796.png',
  '/splash/apple-splash-1536x2048.png',
  '/splash/apple-splash-1668x2388.png',
  '/splash/apple-splash-2048x2732.png',
  '/bookmark.svg',
  '/icons/nav/dashboard.svg',
  '/icons/nav/dashboard-active.svg',
  '/icons/nav/projects.svg',
  '/icons/nav/projects-active.svg',
  '/icons/nav/vault.svg',
  '/icons/nav/vault-active.svg',
  '/icons/nav/recipes.svg',
  '/icons/nav/recipes-active.svg',
  '/icons/nav/community.svg',
  '/icons/nav/community-active.svg',
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

  // Only fingerprinted Next build assets are immutable. Public URLs can change
  // without sw.js changing, so always refresh those from the network first.
  if (isStaticAsset(url)) {
    event.respondWith(
      url.pathname.startsWith('/_next/static/')
        ? cacheFirst(request, STATIC_CACHE)
        : networkFirstAsset(request, STATIC_CACHE)
    )
  }
})

function shouldBypassServiceWorker(url, request) {
  const isSameOrigin = url.origin === self.location.origin
  const pathname = url.pathname

  if (
    isSameOrigin &&
    (self.location.hostname === 'localhost' ||
      self.location.hostname === '127.0.0.1' ||
      self.location.hostname === '[::1]')
  ) {
    return true
  }

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
  const cache = await caches.open(cacheName)
  const cachedResponse = await cache.match(request)

  if (cachedResponse) {
    return cachedResponse
  }

  const networkResponse = await fetch(request)

  if (networkResponse.ok) {
    await cache.put(request, networkResponse.clone()).catch(() => {})
  }

  return networkResponse
}

async function networkFirstAsset(request, cacheName) {
  const cache = await caches.open(cacheName)
  try {
    const response = await fetch(request)
    if (response.ok) await cache.put(request, response.clone()).catch(() => {})
    return response
  } catch (error) {
    const cachedResponse = await cache.match(request)
    if (cachedResponse) return cachedResponse
    throw error
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cachedResponse = await cache.match(request)

  const networkResponsePromise = fetch(request).then(async (networkResponse) => {
    if (networkResponse.ok) {
      await cache.put(request, networkResponse.clone()).catch(() => {})
    }

    return networkResponse
  }).catch((error) => {
    if (cachedResponse) return cachedResponse
    throw error
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
