import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    'localhost',
    '127.0.0.1',
    '192.168.58.105',
    '192.168.1.7',
    '192.168.1.8',
  ],

  experimental: {
    serverActions: {
      bodySizeLimit: '8mb',
    },
  },

  images: {
    formats: ['image/webp'],
    minimumCacheTTL: 60 * 60 * 24,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'ckzrvjisesooqcmmtvwl.supabase.co',
        pathname: '/storage/v1/object/**',
      },
      {
        protocol: 'https',
        hostname: 'ckzrvjisesooqcmmtvwl.supabase.co',
        pathname: '/storage/v1/render/image/**',
      },
    ],
    // This local API route proxies a single already-allow-listed Supabase
    // image (it validates its own `src` param server-side), so next/image
    // needs an explicit localPatterns entry to optimize it - without one
    // it 400s any local image src carrying a query string.
    localPatterns: [{ pathname: '/api/paints/v3-swatch' }],
  },

  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/javascript; charset=utf-8',
          },
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
        ],
      },
    ]
  },
}

export default nextConfig
