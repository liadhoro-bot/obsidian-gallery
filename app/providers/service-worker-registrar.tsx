'use client'

import { useEffect } from 'react'

export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      return
    }

    const canRegister =
      window.location.protocol === 'https:' ||
      window.location.hostname === 'localhost'

    if (!canRegister) {
      return
    }

    const registerServiceWorker = () => {
      navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'none',
      })
    }

    if (document.readyState === 'complete') {
      registerServiceWorker()
      return
    }

    window.addEventListener('load', registerServiceWorker)

    return () => {
      window.removeEventListener('load', registerServiceWorker)
    }
  }, [])

  return null
}
