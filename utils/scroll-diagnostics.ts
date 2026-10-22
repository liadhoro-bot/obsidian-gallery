const STORAGE_KEY = 'obsidian-scroll-diagnostics'

// Capture layout and software versions only; never page text, inputs or cookies.
export function captureScrollDiagnostics() {
  const describe = (element: Element) => {
    const style = getComputedStyle(element)
    const rect = element.getBoundingClientRect()
    return {
      tag: element.tagName,
      className: element.getAttribute('class')?.slice(0, 300),
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      scrollTop: element.scrollTop,
      rect: { top: rect.top, height: rect.height },
      overflow: style.overflow,
      touchAction: style.touchAction,
      pointerEvents: style.pointerEvents,
      position: style.position,
      overscrollBehavior: style.overscrollBehavior,
      inert: element.hasAttribute('inert'),
    }
  }
  const deployments = [...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')]
    .map(link => new URL(link.href).searchParams.get('dpl')).filter(Boolean)
  const report = {
    format: 'scroll-diagnostics-v1',
    capturedAt: new Date().toISOString(),
    origin: location.origin,
    path: location.pathname,
    userAgent: navigator.userAgent,
    standalone: (navigator as Navigator & { standalone?: boolean }).standalone === true,
    displayMode: ['standalone', 'fullscreen', 'browser'].find(mode => matchMedia(`(display-mode: ${mode})`).matches),
    deployment: [...new Set(deployments)],
    viewport: { width: innerWidth, height: innerHeight, visualHeight: visualViewport?.height, scale: visualViewport?.scale },
    scrollY,
    scrollingElement: document.scrollingElement?.tagName,
    root: describe(document.documentElement),
    body: describe(document.body),
    center: document.elementsFromPoint(innerWidth / 2, innerHeight / 2).slice(0, 10).map(describe),
    overlays: [...document.querySelectorAll('[inert], [data-navigation-overlay], dialog[open], [aria-modal="true"]')].slice(0, 10).map(describe),
    serviceWorker: navigator.serviceWorker?.controller?.scriptURL,
  }
  const serialized = JSON.stringify(report, null, 2)
  try { sessionStorage.setItem(STORAGE_KEY, serialized) } catch { /* Reporting must work when storage is unavailable. */ }
  return serialized
}

export function readScrollDiagnostics() {
  try {
    const saved = sessionStorage.getItem(STORAGE_KEY)
    if (!saved) return ''
    const report = JSON.parse(saved)
    if (report.origin !== location.origin || Date.now() - Date.parse(report.capturedAt) > 10 * 60 * 1000) return ''
    return saved
  } catch { return '' }
}
