import type { Metadata, Viewport } from 'next'
import './globals.css'

import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'
import ClientShell from './providers/client-shell'

const enableProductionTelemetry = process.env.VERCEL_ENV === 'production'

export const metadata: Metadata = {
  title: 'Obsidian Gallery',
  description: 'Miniature painting and hobby companion',

  applicationName: 'Obsidian Gallery',
  generator: 'Next.js',

  manifest: '/manifest.webmanifest',

  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Obsidian Gallery',
  },

  icons: {
    icon: [
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],

    apple: [
      {
        url: '/apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
    ],

    other: [
      {
        rel: 'mask-icon',
        url: '/bookmark.svg',
        color: '#22d3ee',
      },
    ],
  },

  formatDetection: {
    telephone: false,
  },
}

export const viewport: Viewport = {
  themeColor: '#081018',
  colorScheme: 'dark',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <ClientShell enableProductionTelemetry={enableProductionTelemetry} />
        {children}

        {enableProductionTelemetry ? (
          <>
            <Analytics />
            <SpeedInsights />
          </>
        ) : null}
      </body>
    </html>
  )
}

