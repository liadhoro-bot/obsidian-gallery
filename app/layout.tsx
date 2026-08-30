import type { Metadata, Viewport } from 'next'
import {
  Cormorant_Garamond,
  IBM_Plex_Mono,
  Source_Sans_3,
} from 'next/font/google'
import './globals.css'

import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'
import ClientShell from './providers/client-shell'

const ogDisplayFont = Cormorant_Garamond({
  display: 'swap',
  subsets: ['latin'],
  variable: '--font-og-display',
  weight: '600',
})

const ogUiFont = Source_Sans_3({
  display: 'swap',
  subsets: ['latin'],
  variable: '--font-og-ui',
  weight: 'variable',
})

const ogMonoFont = IBM_Plex_Mono({
  display: 'swap',
  subsets: ['latin'],
  variable: '--font-og-mono',
  weight: ['400', '500'],
})

const enableProductionTelemetry = process.env.VERCEL_ENV === 'production'

export const metadata: Metadata = {
  title: 'Obsidian Gallery V3',
  description: 'The V3 miniature painting and hobby companion.',

  applicationName: 'Obsidian Gallery V3',
  generator: 'Next.js',

  manifest: '/manifest.webmanifest',

  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Obsidian V3',
    startupImage: [
      {
        url: '/splash/apple-splash-1170x2532.png',
        media:
          '(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)',
      },
      {
        url: '/splash/apple-splash-1290x2796.png',
        media:
          '(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)',
      },
      {
        url: '/splash/apple-splash-1125x2436.png',
        media:
          '(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3)',
      },
      {
        url: '/splash/apple-splash-1242x2688.png',
        media:
          '(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3)',
      },
      {
        url: '/splash/apple-splash-828x1792.png',
        media:
          '(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2)',
      },
      {
        url: '/splash/apple-splash-750x1334.png',
        media:
          '(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)',
      },
      {
        url: '/splash/apple-splash-1536x2048.png',
        media:
          '(device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2)',
      },
      {
        url: '/splash/apple-splash-1668x2388.png',
        media:
          '(device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2)',
      },
      {
        url: '/splash/apple-splash-2048x2732.png',
        media:
          '(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2)',
      },
    ],
  },

  icons: {
    icon: [
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-48x48.png', sizes: '48x48', type: 'image/png' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-256.png', sizes: '256x256', type: 'image/png' },
      { url: '/icon-384.png', sizes: '384x384', type: 'image/png' },
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
        color: '#c79a54',
      },
    ],
  },

  formatDetection: {
    telephone: false,
  },

  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black-translucent',
    'apple-mobile-web-app-title': 'Obsidian V3',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#071015',
  colorScheme: 'dark',
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${ogDisplayFont.variable} ${ogUiFont.variable} ${ogMonoFont.variable} h-full antialiased`}
    >
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
