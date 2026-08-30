import type { MetadataRoute } from 'next'

type ObsidianManifest = Omit<MetadataRoute.Manifest, 'display'> & {
  display: 'fullscreen' | 'standalone'
  display_override?: Array<'fullscreen' | 'standalone' | 'minimal-ui' | 'browser'>
}

export default function manifest(): ObsidianManifest {
  return {
    name: 'Obsidian Gallery V3',
    short_name: 'Obsidian V3',
    description: 'The V3 miniature painting and hobby companion.',
    id: '/',
    start_url: '/dashboard?source=pwa',
    scope: '/',
    display: 'standalone',
    display_override: ['fullscreen', 'standalone'],
    orientation: 'portrait',
    background_color: '#071015',
    theme_color: '#071015',
    categories: ['productivity', 'lifestyle'],
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-256.png',
        sizes: '256x256',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-384.png',
        sizes: '384x384',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/maskable-icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
