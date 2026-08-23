import type { MetadataRoute } from 'next'

type ObsidianManifest = Omit<MetadataRoute.Manifest, 'display'> & {
  display: 'fullscreen' | 'standalone'
  display_override?: Array<'fullscreen' | 'standalone' | 'minimal-ui' | 'browser'>
}

export default function manifest(): ObsidianManifest {
  return {
    name: 'Obsidian Gallery',
    short_name: 'Obsidian',
    description: 'Miniature painting and hobby companion',
    id: '/',
    start_url: '/dashboard?source=pwa',
    scope: '/',
    display: 'fullscreen',
    display_override: ['fullscreen', 'standalone'],
    orientation: 'portrait',
    background_color: '#24150b',
    theme_color: '#24150b',
    categories: ['productivity', 'lifestyle'],
    icons: [
      {
        src: '/icon-192-v4.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512-v4.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/maskable-icon-512-v4.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
