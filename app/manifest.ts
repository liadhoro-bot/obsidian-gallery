import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Obsidian Gallery',
    short_name: 'Obsidian',
    description: 'Miniature painting and hobby companion',
    start_url: '/',
    display: 'standalone',
    background_color: '#0f0f10',
    theme_color: '#0f0f10',
    orientation: 'portrait',
    icons: [
      {
        src: '/icon.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/apple-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  }
}