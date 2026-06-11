import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Obsidian Gallery',
    short_name: 'Obsidian',
    description: 'Miniature painting and hobby companion',
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#081018',
    theme_color: '#081018',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
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
